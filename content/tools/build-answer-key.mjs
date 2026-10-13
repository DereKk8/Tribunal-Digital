#!/usr/bin/env node
// Expande content/answer-rules.private.json (privado, compacto) a
// content/answer-key.private.json (privado, exhaustivo, contrato v1.0).
// Ambos archivos están excluidos de Git. Este script es público: no contiene respuestas.
//
// Uso: node content/tools/build-answer-key.mjs [--rules ruta] [--out ruta]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expandRound } from './lib/key-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
};

const rulesPath = path.resolve(arg('--rules', path.join(ROOT, 'content', 'answer-rules.private.json')));
const outPath = path.resolve(arg('--out', path.join(ROOT, 'content', 'answer-key.private.json')));
const publicPath = path.join(ROOT, 'content', 'public.json');

if (!existsSync(rulesPath)) {
  console.error(`✗ No existe ${rulesPath}. Las reglas privadas no se distribuyen por Git; pídelas a la organización.`);
  process.exit(2);
}

const pub = JSON.parse(readFileSync(publicPath, 'utf8'));
const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
const errors = [];

if (rules.game_id !== pub.game_id || rules.schema_version !== pub.schema_version) {
  errors.push('Las reglas no corresponden al mismo game_id / schema_version que public.json.');
}

const order = pub.rounds.map((r) => r.id);
const released = [];
const key = { schema_version: pub.schema_version, game_id: pub.game_id, rounds: {} };

for (const round of pub.rounds) {
  released.push(...round.evidence.map((e) => e.id));
  const available = [...released];
  const rr = rules.rounds[round.id];
  if (!rr) { errors.push(`Faltan reglas para ${round.id}`); continue; }

  const claimIds = round.claims.map((c) => c.id);
  const actionIds = round.actions.map((a) => a.id);
  const ruleClaims = Object.keys(rr.claims);
  const ruleActions = Object.keys(rr.actions);
  for (const id of claimIds) if (!ruleClaims.includes(id)) errors.push(`${round.id}: la afirmación ${id} no tiene regla`);
  for (const id of ruleClaims) if (!claimIds.includes(id)) errors.push(`${round.id}: regla para afirmación inexistente ${id}`);
  for (const id of actionIds) if (!ruleActions.includes(id)) errors.push(`${round.id}: la acción ${id} no tiene regla`);
  for (const id of ruleActions) if (!actionIds.includes(id)) errors.push(`${round.id}: regla para acción inexistente ${id}`);

  const checkEv = (where, ids) => {
    for (const e of ids) if (!available.includes(e)) errors.push(`${round.id} ${where}: ${e} no está disponible en esta ronda`);
  };
  for (const [id, r] of Object.entries(rr.claims)) {
    if (r.status === 'sound') {
      if (!r.accepted_sets?.length) errors.push(`${id}: afirmación sólida sin conjuntos aceptados`);
      for (const s of r.accepted_sets || []) {
        if (s.length < 1 || s.length > 2 || new Set(s).size !== s.length) errors.push(`${id}: conjunto inválido ${s}`);
        checkEv(id, s);
      }
    } else if (r.status === 'false') {
      if (!r.refuting?.length) errors.push(`${id}: afirmación falsa sin evidencia que la contradiga`);
      if (typeof r.overcertain !== 'boolean') errors.push(`${id}: falta overcertain`);
      checkEv(id, [...(r.refuting || []), ...(r.exposing || [])]);
    } else if (r.status === 'unsupported') {
      if (!r.exposing?.length) errors.push(`${id}: afirmación no sostenida sin evidencia que muestre el hueco`);
      if (typeof r.overcertain !== 'boolean') errors.push(`${id}: falta overcertain`);
      checkEv(id, r.exposing || []);
    } else errors.push(`${id}: estado desconocido ${r.status}`);
  }
  for (const [id, r] of Object.entries(rr.actions)) {
    if (r.status === 'unsafe') {
      if (!r.risk?.length) errors.push(`${id}: acción insegura sin evidencia de riesgo`);
      checkEv(id, r.risk || []);
    } else if (r.status !== 'accepted') errors.push(`${id}: estado desconocido ${r.status}`);
  }
  if (!Object.values(rr.claims).some((r) => r.status === 'sound')) errors.push(`${round.id}: ninguna afirmación puntúa`);
  if (!Object.values(rr.actions).some((r) => r.status === 'accepted')) errors.push(`${round.id}: ninguna acción puntúa`);

  key.rounds[round.id] = expandRound(rr, available);
}
for (const id of Object.keys(rules.rounds)) if (!order.includes(id)) errors.push(`Reglas para ronda inexistente ${id}`);

if (errors.length) {
  console.error('✗ Reglas inválidas:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}

writeFileSync(outPath, JSON.stringify(key) + '\n', 'utf8');
const stats = Object.entries(key.rounds)
  .map(([id, r]) => `${id}: ${r.accepted_arguments.length} argumentos, ${r.accepted_actions.length} acciones, ${r.accepted_objections.length} objeciones`)
  .join('\n  ');
console.log(`✓ Clave privada escrita en ${path.relative(ROOT, outPath)} (NO subir a Git)\n  ${stats}`);
