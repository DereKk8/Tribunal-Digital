#!/usr/bin/env node
// Comprueba que ningún secreto ni respuesta real esté versionado (archivos actuales,
// cambios preparados e historial completo de Git). Ejecútalo antes de cada push.
//
//   node content/tools/check-leaks.mjs
//
// Sin la clave local solo revisa rutas y patrones genéricos; con la clave local, además
// busca en todo el historial las firmas exactas de las respuestas reales.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const problems = [];

let hasHead = true;
try { git('rev-parse', '--verify', 'HEAD'); } catch { hasHead = false; }

// 1. Rutas privadas versionadas, preparadas o presentes en cualquier commit.
const PRIVATE_PATH = /(^|\/)[^/]*\.private\.[^/]*$|^content\/private\/|^content\/handoff\/|(^|\/)\.env($|\.)|\.(sqlite3?|db|pem|key)$/;
const allowed = (p) => p === '.env.example' || p.startsWith('fixtures/demo/');
const tracked = git('ls-files', '--cached').split('\n').filter(Boolean);
for (const p of tracked) if (PRIVATE_PATH.test(p) && !allowed(p)) problems.push(`versionado o preparado: ${p}`);
if (hasHead) {
  const historic = new Set(git('log', '--all', '--pretty=format:', '--name-only').split('\n').filter(Boolean));
  for (const p of historic) if (PRIVATE_PATH.test(p) && !allowed(p)) problems.push(`presente en el historial: ${p}`);
}

// 2. Patrones genéricos de secretos en archivos versionados.
const GENERIC = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\b\s*[:=]\s*['"][^'"]{12,}/i];
for (const p of tracked) {
  if (allowed(p) || /\.(png|jpe?g|webp|woff2?|ico)$/.test(p) || !existsSync(path.join(ROOT, p))) continue;
  const t = readFileSync(path.join(ROOT, p), 'utf8');
  for (const re of GENERIC) if (re.test(t)) problems.push(`posible secreto en ${p} (${re})`);
}

// 3. Firmas exactas de las respuestas reales (solo si la clave está en este equipo).
const KEY = path.join(ROOT, 'content/answer-key.private.json');
const RULES = path.join(ROOT, 'content/answer-rules.private.json');
const RAT = path.join(ROOT, 'content/rationales.private.md');
if (existsSync(KEY)) {
  const key = JSON.parse(readFileSync(KEY, 'utf8'));
  const needles = new Set();
  for (const r of Object.values(key.rounds)) {
    for (const a of r.accepted_arguments) {
      needles.add(`"claim_id":"${a.claim_id}","evidence_ids":${JSON.stringify(a.evidence_ids)}`);
      needles.add(`"claim_id": "${a.claim_id}", "evidence_ids": ${JSON.stringify(a.evidence_ids).replace(/,/g, ', ')}`);
    }
    needles.add(`"accepted_actions":${JSON.stringify(r.accepted_actions)}`);
    needles.add(`"accepted_actions": ${JSON.stringify(r.accepted_actions).replace(/,/g, ', ')}`);
  }
  // (se compone en tiempo de ejecución para que este archivo no coincida consigo mismo)
  if (existsSync(RULES)) needles.add(['"status": "', 'sound", "accepted', '_sets"'].join(''));
  if (existsSync(RAT)) {
    const rat = readFileSync(RAT, 'utf8');
    for (const m of rat.matchAll(/\*\*Guion de 30 s:\*\* «([^»]{40,80})/g)) needles.add(m[1]);
  }
  const revs = hasHead ? git('rev-list', '--all').split('\n').filter(Boolean) : [];
  for (const n of needles) {
    // árbol de trabajo versionado + índice
    try { const hit = git('grep', '-l', '-F', '--cached', '-e', n); if (hit) problems.push(`firma de respuesta real en archivos preparados: ${hit.split('\n').join(', ')}`); } catch { /* sin coincidencias */ }
    if (revs.length) {
      try { const hit = git('grep', '-l', '-F', '-e', n, ...revs); if (hit) problems.push(`firma de respuesta real en el historial: ${hit.split('\n').slice(0, 5).join(', ')}`); } catch { /* sin coincidencias */ }
    }
  }
  console.log(`· Clave local encontrada: ${needles.size} firmas buscadas en ${revs.length} commits y en el índice.`);
} else {
  console.log('· Sin clave local: solo se revisan rutas y patrones genéricos.');
}

if (problems.length) {
  console.error('✗ Posibles filtraciones:\n  - ' + [...new Set(problems)].join('\n  - '));
  process.exit(1);
}
console.log(`✓ Sin filtraciones: ${tracked.length} archivos versionados/preparados revisados${hasHead ? ' e historial completo' : ''}.`);
