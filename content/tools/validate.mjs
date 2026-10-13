#!/usr/bin/env node
// Validación completa del paquete de contenido de Tribunal Digital (sin dependencias).
//
//   node content/tools/validate.mjs            → valida todo lo público y, si existen en local,
//                                                 la clave y las reglas privadas.
//   node content/tools/validate.mjs --public    → solo lo público (para CI o colaboradores sin la clave).
//
// Comprueba: esquema (content/schema.json), referencias cruzadas, liberación de evidencias,
// coherencia del mapa de proyección con projection/index.html, fidelidad al tema gradient-pop,
// ausencia de respuestas en archivos públicos y, con la clave local, su integridad y exhaustividad.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate } from './lib/mini-schema.mjs';
import { expandRound, setKey } from './lib/key-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(readFileSync(P(p), 'utf8'));
const PUBLIC_ONLY = process.argv.includes('--public');

const results = [];
const check = (name, errors) => {
  results.push({ name, errors });
  console.log(`${errors.length ? '✗' : '✓'} ${name}${errors.length ? '\n    - ' + errors.slice(0, 15).join('\n    - ') + (errors.length > 15 ? `\n    … y ${errors.length - 15} más` : '') : ''}`);
};

const schema = readJson('content/schema.json');
const sub = (def) => ({ $ref: `#/$defs/${def}` });
const vs = (def, data) => validate(sub(def), data, schema);

// ── 1. Esquemas ──────────────────────────────────────────────────────────────
const pub = readJson('content/public.json');
const map = readJson('content/projection-map.json');
check('Esquema · content/public.json', vs('publicPackage', pub));
check('Esquema · content/projection-map.json', vs('projectionMap', map));
check('Esquema · el documento raíz acepta public.json y el mapa (oneOf)', [...validate(schema, pub), ...validate(schema, map)]);
if (existsSync(P('content/answer-key.example.json'))) {
  check('Esquema · content/answer-key.example.json (sintético)', vs('answerKey', readJson('content/answer-key.example.json')));
}

// ── 2. Referencias cruzadas del paquete público ──────────────────────────────
{
  const e = [];
  const ROUND_ORDER = ['R1', 'R2', 'R3', 'R4', 'FINAL'];
  const seen = new Set();
  const order = pub.rounds.map((r) => r.id);
  if (JSON.stringify(order) !== JSON.stringify(ROUND_ORDER)) e.push(`orden de rondas inesperado: ${order}`);
  const teamIds = pub.teams.map((t) => t.id);
  if (new Set(teamIds).size !== teamIds.length) e.push('ids de equipo repetidos');
  for (const r of pub.rounds) {
    for (const ev of r.evidence) {
      if (seen.has(ev.id)) e.push(`id repetido ${ev.id}`);
      seen.add(ev.id);
      if (ev.revealed_in !== r.id) e.push(`${ev.id}: revealed_in=${ev.revealed_in} pero aparece en ${r.id}`);
      if (!existsSync(P(ev.asset_path))) e.push(`${ev.id}: no existe ${ev.asset_path}`);
      else {
        const svg = readFileSync(P(ev.asset_path), 'utf8');
        if (!svg.includes(`<title id="${ev.id}-title">`)) e.push(`${ev.asset_path}: falta <title> accesible`);
        if (!svg.includes(`<desc id="${ev.id}-desc">`)) e.push(`${ev.asset_path}: falta <desc> accesible`);
      }
      if (!ev.body.startsWith(`${ev.id} · `)) e.push(`${ev.id}: el body debe empezar por «${ev.id} · »`);
    }
    r.claims.forEach((c, i) => {
      if (seen.has(c.id)) e.push(`id repetido ${c.id}`);
      seen.add(c.id);
      if (c.id !== `${r.id}-C${i + 1}`) e.push(`${c.id}: se esperaba ${r.id}-C${i + 1}`);
    });
    r.actions.forEach((a, i) => {
      if (seen.has(a.id)) e.push(`id repetido ${a.id}`);
      seen.add(a.id);
      if (a.id !== `${r.id}-A${i + 1}`) e.push(`${a.id}: se esperaba ${r.id}-A${i + 1}`);
    });
    if (r.claims.length < 3 || r.claims.length > 5) e.push(`${r.id}: ${r.claims.length} afirmaciones (se recomiendan 3–5)`);
    if (r.actions.length < 3 || r.actions.length > 4) e.push(`${r.id}: ${r.actions.length} acciones (se recomiendan 3–4)`);
  }
  // evidencias numeradas de forma continua (sin huecos que delaten contenido retirado)
  const evIds = [...seen].filter((x) => /^E\d\d$/.test(x)).sort();
  evIds.forEach((id, i) => { if (id !== `E${String(i + 1).padStart(2, '0')}`) e.push(`numeración de evidencias con huecos en ${id}`); });
  check('Referencias cruzadas y liberación de evidencias', e);
}

// ── 3. Mapa de proyección ↔ projection/index.html ───────────────────────────
const html = readFileSync(P('projection/index.html'), 'utf8');
const SLIDE_RE = /<div class="slide(?: [^"]*)?" id="([^"]+)"([^>]*)>/g;
const slideIds = [...html.matchAll(SLIDE_RE)].map((m) => m[1]);
{
  const e = [];
  if (map.slide_count !== slideIds.length) e.push(`slide_count=${map.slide_count} pero el HTML tiene ${slideIds.length}`);
  if (new Set(slideIds).size !== slideIds.length) e.push('ids de diapositiva repetidos en el HTML');
  for (const [rid, phases] of Object.entries(map.rounds)) {
    if (rid !== 'FINAL' && !phases.reveal) e.push(`${rid}: falta reveal`);
    for (const [ph, entry] of Object.entries(phases)) {
      const idx = slideIds.indexOf(entry.slide_id);
      if (idx < 0) e.push(`${rid}.${ph}: ${entry.slide_id} no existe en el HTML`);
      else if (idx !== entry.slide_index) e.push(`${rid}.${ph}: índice ${entry.slide_index} ≠ ${idx}`);
      if (entry.slides[0] !== entry.slide_id) e.push(`${rid}.${ph}: slides[0] debe ser slide_id`);
      for (const s of entry.slides) if (!slideIds.includes(s)) e.push(`${rid}.${ph}: ${s} no existe`);
      const re = new RegExp(`id="${entry.slide_id}"[^>]*data-round="${rid}"[^>]*data-phase="${ph}"`);
      if (!re.test(html)) e.push(`${rid}.${ph}: la diapositiva ${entry.slide_id} no declara data-round/data-phase coherentes`);
    }
  }
  check('Mapa de proyección coherente con el HTML generado', e);
}

// ── 4. Proyección: fidelidad make-slide / gradient-pop y contenido ───────────
{
  const e = [];
  const ref = readFileSync(P('projection/build/vendor/gradient-pop-reference.html'), 'utf8');
  const refCss = ref.match(/<style>([\s\S]*?)<\/style>/)[1];
  const cut = refCss.indexOf('/* ========================================\n       RESPONSIVE');
  const themeCss = refCss.slice(0, cut).trimEnd();
  if (!html.includes(themeCss)) e.push('el CSS original de gradient-pop no está incluido literalmente');
  for (const tok of ['--grad-start: #6366f1', '--grad-mid: #ec4899', '--grad-end: #f97316', '--accent: #fbbf24', 'backdrop-filter: blur(16px)']) {
    if (!html.includes(tok)) e.push(`falta el token del tema ${tok}`);
  }
  if (!/window\.open\('', 'SpeakerNotes'/.test(html)) e.push('las notas deben abrirse en ventana emergente (make-slide core-features)');
  for (const fn of ['function goTo(', 'function updateProgress(', 'function updateCounter(', 'function toggleFullscreen(', 'function toggleNotes(', 'function updateNotes(']) {
    if (!html.includes(fn)) e.push(`falta ${fn}…) de core-features`);
  }
  const slidesWithoutNotes = [...html.matchAll(SLIDE_RE)].filter((m) => !/data-notes="[^"]{20,}"/.test(m[2])).map((m) => m[1]);
  if (slidesWithoutNotes.length) e.push(`diapositivas sin notas: ${slidesWithoutNotes.join(', ')}`);
  const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  for (const r of pub.rounds) {
    for (const c of r.claims) if (!html.includes(escHtml(c.text))) e.push(`${c.id}: el texto no aparece en la proyección`);
    for (const a of r.actions) if (!html.includes(escHtml(a.text))) e.push(`${a.id}: el texto no aparece en la proyección`);
    for (const ev of r.evidence) if (!html.includes(`<title id="${ev.id}-title">`)) e.push(`${ev.id}: la imagen no está incrustada`);
  }
  // Todas las opciones se dibujan igual: sin clases ni atributos que distingan alguna.
  const optTags = [...html.matchAll(/<div class="opt(?: [^"]*)?"[^>]*>/g)].map((m) => m[0]);
  if (new Set(optTags).size !== 1) e.push(`las opciones no tienen marcado uniforme: ${[...new Set(optTags)].join(' | ')}`);
  if (/https?:\/\/(?!cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard)[^\s"')]+\.(js|css)/.test(html)) e.push('recursos externos no permitidos por make-slide');
  if (/\bfetch\([^)]*private/i.test(html)) e.push('la proyección intenta leer un archivo privado');
  check('Proyección: tema gradient-pop, funciones make-slide, notas y contenido', e);
}

// ── 5. Archivos públicos sin respuestas ──────────────────────────────────────
{
  const e = [];
  const publicTexts = {
    'content/public.json': readFileSync(P('content/public.json'), 'utf8'),
    'content/projection-map.json': readFileSync(P('content/projection-map.json'), 'utf8'),
    'projection/index.html': html,
  };
  const forbidden = [/accepted_(arguments|actions|objections)/, /"(status|overcertain|refuting|exposing|risk)"\s*:/, /\b(correcta|incorrecta|respuesta correcta)\b.*\b(C\d|A\d)\b/i, /data-(correct|answer|accepted|score)/i];
  for (const [f, t] of Object.entries(publicTexts)) for (const re of forbidden) if (re.test(t)) e.push(`${f}: coincide con ${re}`);
  check('Archivos públicos sin campos ni marcas de respuesta', e);
}

// ── 6. Clave privada local (opcional) ────────────────────────────────────────
if (!PUBLIC_ONLY) {
  const keyPath = 'content/answer-key.private.json';
  const rulesPath = 'content/answer-rules.private.json';
  if (!existsSync(P(keyPath))) {
    console.log(`· ${keyPath} no está en este equipo (normal en el repositorio público): se omite su validación.`);
  } else {
    const key = readJson(keyPath);
    check('Esquema · clave privada local', vs('answerKey', key));
    const e = [];
    if (key.game_id !== pub.game_id || key.schema_version !== pub.schema_version) e.push('game_id/schema_version no coinciden con public.json');
    const released = [];
    for (const r of pub.rounds) {
      released.push(...r.evidence.map((x) => x.id));
      const avail = new Set(released);
      const k = key.rounds[r.id];
      const claims = new Set(r.claims.map((c) => c.id));
      const actions = new Set(r.actions.map((a) => a.id));
      if (!k.accepted_arguments.length) e.push(`${r.id}: ninguna afirmación puntúa`);
      if (!k.accepted_actions.length) e.push(`${r.id}: ninguna acción puntúa`);
      for (const a of k.accepted_arguments) {
        if (!claims.has(a.claim_id)) e.push(`${r.id}: afirmación desconocida ${a.claim_id}`);
        for (const ev of a.evidence_ids) if (!avail.has(ev)) e.push(`${r.id}: ${a.claim_id} usa ${ev}, no publicada aún`);
      }
      for (const a of k.accepted_actions) if (!actions.has(a)) e.push(`${r.id}: acción desconocida ${a}`);
      const seenObj = new Set();
      for (const o of k.accepted_objections) {
        const sig = `${o.target_claim_id}|${setKey(o.target_evidence_ids)}|${o.target_action_id}|${o.objection_kind}|${o.cited_evidence_id}`;
        if (seenObj.has(sig)) e.push(`${r.id}: objeción repetida ${sig}`);
        seenObj.add(sig);
        if (!claims.has(o.target_claim_id)) e.push(`${r.id}: objeción contra afirmación desconocida ${o.target_claim_id}`);
        if (!actions.has(o.target_action_id)) e.push(`${r.id}: objeción contra acción desconocida ${o.target_action_id}`);
        for (const ev of [...o.target_evidence_ids, o.cited_evidence_id]) if (!avail.has(ev)) e.push(`${r.id}: objeción con evidencia no disponible ${ev}`);
      }
      // Ninguna respuesta totalmente correcta puede ser objetada con éxito.
      const accArgs = new Set(k.accepted_arguments.map((a) => `${a.claim_id}|${setKey(a.evidence_ids)}`));
      const accActs = new Set(k.accepted_actions);
      const bad = k.accepted_objections.filter((o) => accArgs.has(`${o.target_claim_id}|${setKey(o.target_evidence_ids)}`) && accActs.has(o.target_action_id));
      if (bad.length) e.push(`${r.id}: ${bad.length} objeciones válidas contra respuestas correctas`);
      const badAct = k.accepted_objections.filter((o) => o.objection_kind === 'unsafe_action' && accActs.has(o.target_action_id));
      if (badAct.length) e.push(`${r.id}: acción aceptada objetada como insegura`);
      // La demostración incrustada en la proyección no debe reproducir argumentos aceptados.
      const deckData = JSON.parse(html.match(/<script type="application\/json" id="deck-data">([\s\S]*?)<\/script>/)[1]);
      for (const d of deckData.demo[r.id]?.responses || []) {
        if (accArgs.has(`${d.claim_id}|${setKey(d.evidence_ids)}`)) e.push(`${r.id}: la demostración reproduce un argumento aceptado`);
      }
    }
    check('Integridad de la clave privada frente al paquete público', e);

    if (existsSync(P(rulesPath))) {
      const rules = readJson(rulesPath);
      const e2 = [];
      const rel = [];
      for (const r of pub.rounds) {
        rel.push(...r.evidence.map((x) => x.id));
        const expected = expandRound(rules.rounds[r.id], [...rel]);
        const norm = (rk) => JSON.stringify({
          a: rk.accepted_arguments.map((x) => `${x.claim_id}|${setKey(x.evidence_ids)}`).sort(),
          c: [...rk.accepted_actions].sort(),
          o: rk.accepted_objections.map((o) => `${o.target_claim_id}|${setKey(o.target_evidence_ids)}|${o.target_action_id}|${o.objection_kind}|${o.cited_evidence_id}`).sort(),
        });
        if (norm(expected) !== norm(key.rounds[r.id])) e2.push(`${r.id}: la clave no coincide con la expansión de las reglas (vuelve a ejecutar build-answer-key.mjs)`);
        // Exhaustividad: toda respuesta con algún defecto admite al menos una objeción válida.
        const claimsByStatus = rules.rounds[r.id].claims;
        for (const [cid, cr] of Object.entries(claimsByStatus)) {
          if (cr.status !== 'sound') {
            const hits = key.rounds[r.id].accepted_objections.filter((o) => o.target_claim_id === cid && o.objection_kind !== 'unsafe_action');
            if (!hits.length) e2.push(`${cid}: afirmación defectuosa sin ninguna objeción válida`);
          }
        }
        for (const [aid, ar] of Object.entries(rules.rounds[r.id].actions)) {
          if (ar.status === 'unsafe' && !key.rounds[r.id].accepted_objections.some((o) => o.target_action_id === aid && o.objection_kind === 'unsafe_action')) {
            e2.push(`${aid}: acción insegura sin objeción válida`);
          }
        }
      }
      check('Clave = expansión determinista de las reglas privadas (exhaustividad)', e2);
    }

    const ratPath = 'content/rationales.private.md';
    if (existsSync(P(ratPath))) {
      const rat = readFileSync(P(ratPath), 'utf8');
      const e3 = [];
      for (const r of pub.rounds) {
        for (const c of r.claims) if (!rat.includes(c.id)) e3.push(`fundamentos: falta ${c.id}`);
        for (const a of r.actions) if (!rat.includes(a.id)) e3.push(`fundamentos: falta ${a.id}`);
      }
      // Ninguna frase larga de los fundamentos privados aparece en archivos públicos.
      const sentences = rat.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 60 && !s.startsWith('|') && !s.includes('«'));
      for (const s of sentences) if (html.includes(s) || JSON.stringify(pub).includes(s)) e3.push(`frase privada visible en público: «${s.slice(0, 60)}…»`);
      check('Fundamentos privados: cubren todas las opciones y no se filtran', e3);
    }
  }
}

const failed = results.filter((r) => r.errors.length);
console.log(failed.length ? `\n✗ ${failed.length} comprobaciones con errores.` : `\n✓ ${results.length} comprobaciones superadas.`);
process.exit(failed.length ? 1 : 0);
