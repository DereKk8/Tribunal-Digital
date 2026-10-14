// Carga y verificación del paquete de contenido (DEMO o real).
// Falla cerrado: cualquier problema lanza ContentError con diagnósticos en español.
import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { checkWithSchema } from './schema-check.js';
import { validatePackage, evidenceSetKey } from './validate.js';
import { ROUND_IDS, FINAL_ROUND_ID } from '../constants.js';

export class ContentError extends Error {
  constructor(errors, warnings = []) {
    super(`Contenido inválido:\n- ${errors.join('\n- ')}`);
    this.name = 'ContentError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

function readText(filePath, label, errors) {
  if (!filePath || !existsSync(filePath)) {
    errors.push(`Falta el archivo ${label}: ${filePath ?? '(sin ruta)'}`);
    return undefined;
  }
  return readFileSync(filePath, 'utf8').replace(/^﻿/, '');
}

function parseJson(text, label, errors) {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    errors.push(`${label}: JSON inválido (${e.message})`);
    return undefined;
  }
}

/** Resuelve una ruta de recurso dentro de la raíz del paquete sin permitir salir de ella. */
export function resolveInside(rootDir, relPath) {
  const abs = path.resolve(rootDir, relPath);
  const rel = path.relative(rootDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

/**
 * Carga el paquete.
 * @param {object} p
 * @param {'demo'|'real'} p.mode
 * @param {string} p.packageRoot  raíz contra la que se resuelven los asset_path
 * @param {string} p.publicPath
 * @param {string} p.keyPath
 * @param {string} p.schemaPath
 * @param {string} p.projectionMapPath
 * @param {string} p.projectionHtmlPath
 * @param {string} [p.rationalesPath]  opcional, solo para buscar fugas
 */
export function loadContent(p) {
  const errors = [];
  const publicText = readText(p.publicPath, 'public.json', errors);
  const keyText = readText(p.keyPath, 'de clave privada', errors);
  const schemaText = readText(p.schemaPath, 'schema.json', errors);
  const mapText = readText(p.projectionMapPath, 'projection-map.json', errors);
  const projectionHtml = readText(p.projectionHtmlPath, 'de proyección (index.html)', errors);
  const rationalesText = p.rationalesPath && existsSync(p.rationalesPath) ? readFileSync(p.rationalesPath, 'utf8') : undefined;

  const publicCase = parseJson(publicText, 'public.json', errors);
  const answerKey = parseJson(keyText, 'clave privada', errors);
  const schema = parseJson(schemaText, 'schema.json', errors);
  const projectionMap = parseJson(mapText, 'projection-map.json', errors);
  if (errors.length) throw new ContentError(errors);

  const warnings = [];
  const sc = checkWithSchema(schema, { publicCase, answerKey, projectionMap });
  errors.push(...sc.errors);
  warnings.push(...sc.warnings);

  const assetExists = (rel) => {
    const abs = resolveInside(p.packageRoot, rel);
    if (!abs || !existsSync(abs) || !statSync(abs).isFile()) return false;
    // Un enlace simbólico no puede sacar el recurso de la raíz del paquete.
    return resolveInside(realpathSync(p.packageRoot), realpathSync(abs)) !== null;
  };
  const vr = validatePackage({ publicCase, answerKey, projectionMap, projectionHtml, assetExists, rationalesText, publicText });
  errors.push(...vr.errors);
  warnings.push(...vr.warnings);
  if (errors.length) throw new ContentError(errors, warnings);

  return buildModel({ mode: p.mode, paths: p, publicCase, answerKey, projectionMap, publicText, keyText, warnings });
}

function evidenceSummary(evidence) {
  if (evidence.summary) return evidence.summary;
  // Los paquetes anteriores pueden tener ya una frase breve como transcripción.
  const sentences = new Intl.Segmenter('es', { granularity: 'sentence' });
  if (evidence.body.length <= 160 && !/[\r\n]/.test(evidence.body) && [...sentences.segment(evidence.body)].length === 1) return evidence.body;
  return `Revisemos la evidencia ${evidence.id}.`;
}

function buildModel({ mode, paths, publicCase, answerKey, projectionMap, publicText, keyText, warnings }) {
  const fingerprint = createHash('sha256').update(publicText).update('\0').update(keyText).digest('hex');
  const teams = publicCase.teams.map((t) => ({ id: t.id, name: t.name }));
  const rounds = publicCase.rounds.map((r, index) => ({
    id: r.id,
    index,
    title: r.title,
    question: r.question ?? null,
    context: r.context ?? null,
    evidence: r.evidence.map((e) => ({ id: e.id, title: e.title ?? `Pista ${e.id}`, summary: evidenceSummary(e), facts: e.facts ?? [], body: e.body, asset_path: e.asset_path, revealed_in: e.revealed_in })),
    claims: r.claims.map((c) => ({ id: c.id, text: c.text })),
    actions: r.actions.map((a) => ({ id: a.id, text: a.text })),
  }));
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const evidenceById = new Map();
  const claimById = new Map();
  const actionById = new Map();
  for (const r of rounds) {
    for (const e of r.evidence) evidenceById.set(e.id, { ...e, roundIndex: r.index });
    for (const c of r.claims) claimById.set(c.id, { ...c, round_id: r.id });
    for (const a of r.actions) actionById.set(a.id, { ...a, round_id: r.id });
  }
  // Clave normalizada: conjuntos de evidencias como claves ordenadas.
  const key = {};
  for (const rid of ROUND_IDS) {
    const k = answerKey.rounds[rid];
    key[rid] = {
      accepted_arguments: k.accepted_arguments.map((a, i) => ({
        ref: `${rid}.accepted_arguments[${i}]`, claim_id: a.claim_id, evidence_ids: [...a.evidence_ids], evidence_key: evidenceSetKey(a.evidence_ids),
      })),
      accepted_actions: k.accepted_actions.map((id, i) => ({ ref: `${rid}.accepted_actions[${i}]`, action_id: id })),
      accepted_objections: k.accepted_objections.map((o, i) => ({
        ref: `${rid}.accepted_objections[${i}]`,
        target_claim_id: o.target_claim_id,
        target_evidence_ids: [...o.target_evidence_ids],
        target_evidence_key: evidenceSetKey(o.target_evidence_ids),
        target_action_id: o.target_action_id,
        objection_kind: o.objection_kind,
        cited_evidence_id: o.cited_evidence_id,
      })),
    };
  }
  return Object.freeze({
    mode,
    paths,
    fingerprint,
    title: typeof publicCase.title === 'string' ? publicCase.title : null,
    introduction: publicCase.introduction ?? null,
    teams,
    teamById: new Map(teams.map((t) => [t.id, t])),
    rounds,
    roundById,
    evidenceById,
    claimById,
    actionById,
    key,
    projectionMap,
    finalRoundId: FINAL_ROUND_ID,
    warnings,
  });
}
