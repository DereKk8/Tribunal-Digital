#!/usr/bin/env node
// Genera content/rationales.private.md (PRIVADO) a partir de:
//   · content/rationales.private.src.md   (explicaciones redactadas a mano, PRIVADO)
//   · content/answer-rules.private.json   (estado y evidencias de cada opción, PRIVADO)
//   · content/public.json                 (textos públicos)
// Los marcadores {{opcion:<id>}} se sustituyen por el texto de la opción y la ficha de la
// clave derivada de las reglas, para que explicación y clave no puedan divergir.
// Uso: node content/tools/build-rationales.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (p) => path.join(ROOT, p);
for (const f of ['content/rationales.private.src.md', 'content/answer-rules.private.json']) {
  if (!existsSync(P(f))) { console.error(`✗ Falta ${f} (privado).`); process.exit(2); }
}
const src = readFileSync(P('content/rationales.private.src.md'), 'utf8');
const rules = JSON.parse(readFileSync(P('content/answer-rules.private.json'), 'utf8'));
const pub = JSON.parse(readFileSync(P('content/public.json'), 'utf8'));

const texts = {};
for (const r of pub.rounds) {
  for (const c of r.claims) texts[c.id] = { round: r.id, text: c.text, kind: 'claim' };
  for (const a of r.actions) texts[a.id] = { round: r.id, text: a.text, kind: 'action' };
}
const list = (ids) => (ids && ids.length ? ids.join(', ') : '—');
const STATUS = { sound: 'SÓLIDA (puntúa +3)', false: 'FALSA', unsupported: 'NO SOSTENIDA', accepted: 'PROTECTORA (puntúa +2)', unsafe: 'INSEGURA' };

function card(id) {
  const t = texts[id];
  if (!t) throw new Error(`Opción desconocida en la plantilla: ${id}`);
  const rr = rules.rounds[t.round];
  const lines = [`> **${id}** · «${t.text}»`, '>'];
  if (t.kind === 'claim') {
    const r = rr.claims[id];
    lines.push(`> **Estado:** ${STATUS[r.status]}${r.overcertain ? ' · además afirma con certeza algo que la evidencia no establece' : ''}`);
    if (r.status === 'sound') {
      lines.push(`> **Conjuntos aceptados (+3):** ${r.accepted_sets.map((s) => `{${s.join(', ')}}`).join(' o ')}`);
      lines.push(`> **Objeciones válidas:** solo «salto lógico» si el equipo NO usó un conjunto aceptado, citando una de sus evidencias o la que falta (${list([...new Set(r.accepted_sets.flat())])}). Con un conjunto aceptado, toda objeción contra la afirmación falla.`);
    } else if (r.status === 'false') {
      lines.push(`> **Objeciones válidas:** «contradicción» citando ${list(r.refuting)}${r.overcertain ? `; «certeza injustificada» citando ${list([...new Set([...r.refuting, ...(r.exposing || [])])])} o cualquiera de las evidencias del equipo objetado` : ''}. «Salto lógico» NO vale (la afirmación es falsa, no solo mal sostenida).`);
    } else {
      lines.push(`> **Objeciones válidas:** «salto lógico»${r.overcertain ? ' o «certeza injustificada»' : ''} citando ${list(r.exposing)} o cualquiera de las evidencias del equipo objetado. «Contradicción» NO vale (ningún dato es falso).${r.overcertain ? '' : ' «Certeza injustificada» NO vale (no afirma identidad, intención ni culpa como un hecho).'}`);
    }
  } else {
    const r = rr.actions[id];
    lines.push(`> **Estado:** ${STATUS[r.status]}`);
    lines.push(r.status === 'unsafe'
      ? `> **Objeción válida:** «acción insegura» citando ${list(r.risk)}.`
      : '> **Objeción válida:** ninguna. Toda objeción contra esta acción falla.');
  }
  return lines.join('\n');
}

const outText = src.replace(/\{\{opcion:([A-Z0-9-]+)\}\}/g, (_, id) => card(id));
const missing = Object.keys(texts).filter((id) => !src.includes(`{{opcion:${id}}}`));
if (missing.length) { console.error(`✗ La plantilla no explica: ${missing.join(', ')}`); process.exit(1); }
writeFileSync(P('content/rationales.private.md'), outText, 'utf8');
console.log('✓ content/rationales.private.md generado (PRIVADO, no subir a Git)');
