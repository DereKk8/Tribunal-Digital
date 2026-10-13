#!/usr/bin/env node
// Ensayo adversarial de la clave privada (herramienta de QA del contenido, NO es el motor
// de puntuación de la aplicación). Requiere la clave y las reglas privadas en local.
//
//   node content/tools/rehearsal.mjs
//
// Imprime solo estadísticas agregadas (no revelan respuestas) y escribe el detalle con
// respuestas en content/private/ensayo.private.md, que está excluido de Git.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evidenceSets, setKey, OBJECTION_KINDS } from './lib/key-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (p) => path.join(ROOT, p);
for (const f of ['content/answer-key.private.json', 'content/answer-rules.private.json']) {
  if (!existsSync(P(f))) { console.error(`✗ Falta ${f} (privado). El ensayo necesita la clave local.`); process.exit(2); }
}
const pub = JSON.parse(readFileSync(P('content/public.json'), 'utf8'));
const key = JSON.parse(readFileSync(P('content/answer-key.private.json'), 'utf8'));
const rules = JSON.parse(readFileSync(P('content/answer-rules.private.json'), 'utf8'));

// ── Puntuador de referencia (idéntico al contrato: +3 / +2 / +3 / 0) ─────────
const idx = {};
for (const r of pub.rounds) {
  const k = key.rounds[r.id];
  idx[r.id] = {
    args: new Set(k.accepted_arguments.map((a) => `${a.claim_id}|${setKey(a.evidence_ids)}`)),
    acts: new Set(k.accepted_actions),
    objs: new Set(k.accepted_objections.map((o) => `${o.target_claim_id}|${setKey(o.target_evidence_ids)}|${o.target_action_id}|${o.objection_kind}|${o.cited_evidence_id}`)),
  };
}
const argOk = (rid, resp) => idx[rid].args.has(`${resp.claim_id}|${setKey(resp.evidence_ids)}`);
const actOk = (rid, resp) => idx[rid].acts.has(resp.action_id);
const objOk = (rid, target, kind, cited) => idx[rid].objs.has(`${target.claim_id}|${setKey(target.evidence_ids)}|${target.action_id}|${kind}|${cited}`);

const lines = [];
const out = (s = '') => lines.push(s);
const pct = (a, b) => `${((100 * a) / b).toFixed(1)} %`;

// ── 1. Invariantes exhaustivas ───────────────────────────────────────────────
out('# Ensayo adversarial · detalle PRIVADO (no subir a Git)');
out('');
out('## 1. Invariantes exhaustivas por ronda');
out('');
out('| Ronda | Respuestas posibles | Totalmente correctas | Objeciones válidas contra correctas | Afirmaciones defectuosas sin objeción | Acciones inseguras sin objeción | P(+3 al azar) | P(+2 al azar) | P(objeción al azar válida) |');
out('|---|---|---|---|---|---|---|---|---|');
const released = [];
const stats = [];
let invariantFailures = 0;
for (const r of pub.rounds) {
  released.push(...r.evidence.map((e) => e.id));
  const avail = [...released];
  const sets = evidenceSets(avail);
  const claims = r.claims.map((c) => c.id);
  const actions = r.actions.map((a) => a.id);
  let total = 0, correct = 0, objAgainstCorrect = 0, argHits = 0, objCombos = 0, objValid = 0;
  const flawedNoObj = new Set();
  const unsafeNoObj = new Set();
  for (const c of claims) for (const s of sets) for (const a of actions) {
    total++;
    const resp = { claim_id: c, evidence_ids: s, action_id: a };
    const full = argOk(r.id, resp) && actOk(r.id, resp);
    if (argOk(r.id, resp)) argHits++;
    let anyClaimObj = false, anyActObj = false;
    for (const k of OBJECTION_KINDS) for (const e of avail) {
      objCombos++;
      if (objOk(r.id, resp, k, e)) {
        objValid++;
        if (full) objAgainstCorrect++;
        if (k === 'unsafe_action') anyActObj = true; else anyClaimObj = true;
      }
    }
    const cr = rules.rounds[r.id].claims[c];
    if (cr.status !== 'sound' && !anyClaimObj) flawedNoObj.add(c);
    if (cr.status === 'sound' && !argOk(r.id, resp) && !anyClaimObj) flawedNoObj.add(`${c}+{${s}}`);
    if (rules.rounds[r.id].actions[a].status === 'unsafe' && !anyActObj) unsafeNoObj.add(a);
    if (full) correct++;
  }
  invariantFailures += objAgainstCorrect + flawedNoObj.size + unsafeNoObj.size;
  const pArg = argHits / total;
  const pAct = key.rounds[r.id].accepted_actions.length / actions.length;
  const pObj = objValid / objCombos;
  stats.push({ id: r.id, total, correct, pArg, pAct, pObj });
  out(`| ${r.id} | ${total} | ${correct} | ${objAgainstCorrect} | ${flawedNoObj.size} | ${unsafeNoObj.size} | ${pct(argHits, total)} | ${pct(key.rounds[r.id].accepted_actions.length, actions.length)} | ${pct(objValid, objCombos)} |`);
}

// ── 2. Heurísticas «sin leer la evidencia» (señales de tono/longitud) ────────
out('');
out('## 2. ¿Se adivina la respuesta por la forma del texto?');
out('');
const H = {
  'afirmación más larga': (r) => [...r.claims].sort((a, b) => b.text.length - a.text.length)[0].id,
  'afirmación más corta': (r) => [...r.claims].sort((a, b) => a.text.length - b.text.length)[0].id,
  'primera afirmación con matiz («no», «aunque», «sin», «todavía», «podría», «determinará»)': (r) => (r.claims.find((c) => /(^|[^\p{L}])(no|aunque|sin|todavía|podría|determinará)(?=[^\p{L}]|$)/iu.test(c.text)) || r.claims[0]).id,
  'afirmación con más marcas de matiz': (r) => [...r.claims].sort((a, b) => (b.text.match(/(^|[^\p{L}])(no|aunque|sin|todavía|podría|determinará)(?=[^\p{L}]|$)/giu) || []).length - (a.text.match(/(^|[^\p{L}])(no|aunque|sin|todavía|podría|determinará)(?=[^\p{L}]|$)/giu) || []).length)[0].id,
  'evitar palabras de certeza': (r) => (r.claims.find((c) => !/(demuestra|probado|demostrado|no puede|seguro|claro|miente|nunca)/i.test(c.text)) || r.claims[0]).id,
  'acción más larga': (r) => [...r.actions].sort((a, b) => b.text.length - a.text.length)[0].id,
  'acción que menciona club/madre/canal oficial': (r) => (r.actions.find((a) => /(club|madre|canal oficial|policía)/i.test(a.text)) || r.actions[0]).id,
  'acción con «para …»': (r) => (r.actions.find((a) => /\bpara\b/.test(a.text)) || r.actions[0]).id,
};
const sound = (rid, cid) => rules.rounds[rid].claims[cid].status === 'sound';
const accepted = (rid, aid) => rules.rounds[rid].actions[aid].status === 'accepted';
out('| Heurística | Aciertos (5 fases) |');
out('|---|---|');
const heurSummary = [];
for (const [name, f] of Object.entries(H)) {
  const isAction = name.startsWith('acción');
  const hits = pub.rounds.filter((r) => (isAction ? accepted(r.id, f(r)) : sound(r.id, f(r)))).length;
  heurSummary.push(`${name}: ${hits}/5`);
  out(`| ${name} | ${hits}/5 |`);
}

// ── 3. Estrategias de objeción «sin razonar» ─────────────────────────────────
out('');
out('## 3. Estrategias de objeción automáticas (contra todas las respuestas incorrectas posibles)');
out('');
const strat = {
  'salto lógico citando la 1.ª evidencia del objetivo': (r, resp) => ['logical_leap', resp.evidence_ids[0]],
  'certeza injustificada citando la 1.ª evidencia del objetivo': (r, resp) => ['unjustified_certainty', resp.evidence_ids[0]],
  'contradicción citando la evidencia más reciente': (r, resp, avail) => ['contradiction', avail[avail.length - 1]],
  'acción insegura citando la 1.ª evidencia de la ronda': (r, resp) => ['unsafe_action', r.evidence[0]?.id || 'E01'],
};
out('| Estrategia | R1 | R2 | R3 | R4 | FINAL |');
out('|---|---|---|---|---|---|');
const rel2 = [];
const stratRows = Object.fromEntries(Object.keys(strat).map((k) => [k, []]));
for (const r of pub.rounds) {
  rel2.push(...r.evidence.map((e) => e.id));
  const avail = [...rel2];
  const sets = evidenceSets(avail);
  for (const [name, f] of Object.entries(strat)) {
    let n = 0, ok = 0;
    for (const c of r.claims) for (const s of sets) for (const a of r.actions) {
      const resp = { claim_id: c.id, evidence_ids: s, action_id: a.id };
      if (argOk(r.id, resp) && actOk(r.id, resp)) continue;
      n++;
      const [k, e] = f(r, resp, avail);
      if (objOk(r.id, resp, k, e)) ok++;
    }
    stratRows[name].push(pct(ok, n));
  }
}
for (const [name, row] of Object.entries(stratRows)) out(`| ${name} | ${row.join(' | ')} |`);

// ── 4. Simulación de cinco equipos ───────────────────────────────────────────
out('');
out('## 4. Simulación de cinco equipos con estilos distintos');
out('');
let seed = 20261013;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
// Los estilos se derivan en tiempo de ejecución de las reglas privadas y de rasgos del texto
// público; este archivo no contiene ninguna elección concreta (sería revelar respuestas).
const statusOf = (rid, id) => (id.includes('-C') ? rules.rounds[rid].claims[id] : rules.rounds[rid].actions[id]);
function persona(style, r, avail) {
  const claims = r.claims;
  const actions = r.actions;
  const sound = claims.filter((c) => statusOf(r.id, c.id).status === 'sound');
  const flawed = claims.filter((c) => statusOf(r.id, c.id).status !== 'sound');
  const good = actions.filter((a) => statusOf(r.id, a.id).status === 'accepted');
  const bad = actions.filter((a) => statusOf(r.id, a.id).status === 'unsafe');
  const recent = avail.slice(-2);
  if (style === 'calibrado') {
    const c = sound[0];
    const set = statusOf(r.id, c.id).accepted_sets[0];
    // error humano deliberado en la ronda 3: cita solo una de las dos evidencias necesarias
    return { claim_id: c.id, evidence_ids: r.id === 'R3' ? set.slice(0, 1) : set, action_id: good[0].id };
  }
  const digits = (t) => (t.match(/\d/g) || []).length;
  const longest = (arr) => [...arr].sort((a, b) => b.text.length - a.text.length)[0];
  const shortest = (arr) => [...arr].sort((a, b) => a.text.length - b.text.length)[0];
  if (style === 'detective') {
    // la afirmación defectuosa con más cifras (fechas, horas) y la acción insegura más larga
    const c = [...flawed].sort((a, b) => digits(b.text) - digits(a.text))[0];
    return { claim_id: c.id, evidence_ids: recent, action_id: longest(bad).id };
  }
  if (style === 'moralista') {
    const c = flawed.find((x) => statusOf(r.id, x.id).overcertain) || flawed[0];
    return { claim_id: c.id, evidence_ids: [avail[avail.length - 1]], action_id: shortest(bad).id };
  }
  if (style === 'minimizador') {
    const c = flawed.find((x) => !statusOf(r.id, x.id).overcertain) || flawed[flawed.length - 1];
    return { claim_id: c.id, evidence_ids: [avail[0]], action_id: bad[bad.length - 1].id };
  }
  return { claim_id: pick(claims).id, evidence_ids: pick(evidenceSets(avail)), action_id: pick(actions).id };
}
const plan = {
  azul: { estilo: 'Calibrado (cita de forma incompleta en R3)', style: 'calibrado' },
  rojo: { estilo: 'Detective impulsivo', style: 'detective' },
  verde: { estilo: 'Moralista (ve grooming en todo)', style: 'moralista' },
  amarillo: { estilo: 'Minimizador', style: 'minimizador' },
  morado: { estilo: 'Azar (semilla fija)', style: 'azar' },
};
const teams = pub.teams.map((t) => t.id);
const score = Object.fromEntries(teams.map((t) => [t, { pts: 0, tokens: 3, validObj: 0, args: 0 }]));
const rel3 = [];
for (const r of pub.rounds) {
  rel3.push(...r.evidence.map((e) => e.id));
  const avail = [...rel3];
  const resp = {};
  for (const t of teams) resp[t] = persona(plan[t].style, r, avail);
  out(`### ${r.id}`);
  out('');
  out('| Equipo | Respuesta | Argumento | Acción |');
  out('|---|---|---|---|');
  for (const t of teams) {
    const ok1 = argOk(r.id, resp[t]); const ok2 = actOk(r.id, resp[t]);
    if (ok1) { score[t].pts += 3; score[t].args++; }
    if (ok2) score[t].pts += 2;
    out(`| ${t} | ${resp[t].claim_id} {${resp[t].evidence_ids}} ${resp[t].action_id} | ${ok1 ? '+3' : '0'} | ${ok2 ? '+2' : '0'} |`);
  }
  // Objeciones según estilo
  const objections = [];
  const rr = rules.rounds[r.id];
  const tryObj = (att, target, kind, cited) => {
    if (score[att].tokens <= 0) return;
    score[att].tokens--;
    const ok = objOk(r.id, resp[target], kind, cited);
    if (ok) { score[att].pts += 3; score[att].validObj++; }
    objections.push(`${att} → ${target}: ${kind} citando ${cited} → ${ok ? 'VÁLIDA +3' : 'falla (ficha perdida)'}`);
  };
  // Calibrado: objeta en R1, R3 y FINAL al primer equipo con afirmación defectuosa que pueda probar.
  if (['R1', 'R3', 'FINAL'].includes(r.id)) {
    const tgt = teams.find((t) => t !== 'azul' && rr.claims[resp[t].claim_id].status !== 'sound');
    if (tgt) {
      const cr = rr.claims[resp[tgt].claim_id];
      if (cr.status === 'false') tryObj('azul', tgt, 'contradiction', cr.refuting[0]);
      else tryObj('azul', tgt, cr.overcertain ? 'unjustified_certainty' : 'logical_leap', resp[tgt].evidence_ids[0]);
    }
  }
  // Detective: siempre «contradicción» contra el equipo que va primero, citando la evidencia más nueva.
  { const leader = teams.filter((t) => t !== 'rojo').sort((a, b) => score[b].pts - score[a].pts)[0]; tryObj('rojo', leader, 'contradiction', avail[avail.length - 1]); }
  // Moralista: «acción insegura» contra el primer equipo cuya acción no menciona club/policía/madre.
  { const tgt = teams.find((t) => t !== 'verde' && !/(club|policía|madre|canal oficial)/i.test(r.actions.find((a) => a.id === resp[t].action_id).text)); if (tgt && r.id !== 'R2') tryObj('verde', tgt, 'unsafe_action', r.evidence[0]?.id || avail[0]); }
  // Minimizador: solo en la final, «certeza injustificada» contra la afirmación con «demostrado/probado/seguro».
  if (r.id === 'FINAL') { const tgt = teams.find((t) => t !== 'amarillo' && /(demostrado|probado|seguro)/i.test(r.claims.find((c) => c.id === resp[t].claim_id).text)); if (tgt) tryObj('amarillo', tgt, 'unjustified_certainty', resp[tgt].evidence_ids[0]); }
  // Azar: 50 % de probabilidad de objetar con categoría y evidencia al azar.
  if (rnd() < 0.5) tryObj('morado', pick(teams.filter((t) => t !== 'morado')), pick(OBJECTION_KINDS), pick(avail));
  out('');
  for (const o of objections) out(`- ${o}`);
  out('');
}
const ranking = teams.slice().sort((a, b) => score[b].pts - score[a].pts || score[b].validObj - score[a].validObj || score[b].args - score[a].args);
out('### Clasificación final');
out('');
out('| Puesto | Equipo | Estilo | Puntos | Objeciones válidas | Argumentos sostenidos | Fichas restantes |');
out('|---|---|---|---|---|---|---|');
ranking.forEach((t, i) => out(`| ${i + 1} | ${t} | ${plan[t].estilo} | ${score[t].pts} | ${score[t].validObj} | ${score[t].args} | ${score[t].tokens} |`));

mkdirSync(P('content/private'), { recursive: true });
writeFileSync(P('content/private/ensayo.private.md'), lines.join('\n') + '\n', 'utf8');

// ── Salida pública (agregada, sin respuestas) ────────────────────────────────
console.log('Ensayo adversarial (resumen sin respuestas)');
for (const s of stats) console.log(`  ${s.id}: ${s.total} respuestas posibles · ${s.correct} totalmente correctas · P(+3 al azar) ${(100 * s.pArg).toFixed(1)} % · P(+2 al azar) ${(100 * s.pAct).toFixed(0)} % · P(objeción al azar válida) ${(100 * s.pObj).toFixed(1)} %`);
console.log('  Heurísticas de forma: ' + heurSummary.join(' · '));
console.log('  Estilos simulados (puntos): ' + ranking.map((t) => `${plan[t].estilo.split(' ')[0]} ${score[t].pts}`).join(' · '));
console.log(invariantFailures ? `✗ ${invariantFailures} fallos de invariantes (ver content/private/ensayo.private.md)` : '✓ Invariantes: ninguna respuesta correcta es objetable; todo defecto tiene al menos una objeción válida.');
console.log('  Detalle con respuestas: content/private/ensayo.private.md (privado, excluido de Git)');
process.exit(invariantFailures ? 1 : 0);
