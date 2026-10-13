// Recorre la aplicación real (HTTP) como visitante anónimo y como equipo en
// TODAS las etapas, y comprueba que no se filtra la clave, evidencia futura,
// respuestas sin bloquear ni archivos privados. Es genérico: funciona igual con
// el paquete DEMO y con el real.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { Client } from './http-client.js';

/** Petición sin normalizar la ruta (fetch convierte «..» y «%2e%2e» antes de enviar). */
export function rawGet(port, rawPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: rawPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
  });
}

// Datos de la clave o secretos: no pueden aparecer en NINGUNA respuesta pública.
const MARKERS = [
  'accepted_arguments', 'accepted_actions', 'accepted_objections',
  'target_claim_id', 'target_evidence_ids', 'target_action_id',
  'answer-key', 'answer_key', 'rationales', 'MODERATOR_PASSWORD',
];
// Campos de explicación exclusivos de moderación: no pueden aparecer en respuestas JSON
// de la API pública o de equipo (el código del panel sí los nombra).
const API_MARKERS = ['rule_ref', 'reason_label'];
const RULE_REF = /accepted_(arguments|actions|objections)\[/;

const FORBIDDEN_PATHS = [
  '/content/answer-key.private.json',
  '/content/rationales.private.md',
  '/content/public.json',
  '/fixtures/demo/content/answer-key.private.json',
  '/answer-key.private.json',
  '/.env',
  '/.env.example',
  '/.git/config',
  '/data/tribunal-demo.sqlite',
  '/data/tribunal-real.sqlite',
  '/package.json',
  '/src/server.js',
  '/src/config.js',
  '/node_modules/ajv/package.json',
  '/static/../config.js',
  '/static/%2e%2e/%2e%2e/package.json',
  '/static/..%2f..%2fpackage.json',
  '/static/equipo.js.map',
  '/assets/../content/answer-key.private.json',
  '/projection/../content/answer-key.private.json',
  '/projection/%2e%2e/content/answer-key.private.json',
  '/media/..%2fcontent%2fanswer-key.private.json',
  '/media/%2e%2e/%2e%2e/package.json',
  '/api/moderator/state',
  '/api/moderator/export.json',
  '/api/moderator/export.csv',
];

function leakIn(label, text, errors, { api = false } = {}) {
  if (typeof text !== 'string') text = JSON.stringify(text);
  for (const m of api ? [...MARKERS, ...API_MARKERS] : MARKERS) if (text.includes(m)) errors.push(`${label}: contiene «${m}»`);
  if (RULE_REF.test(text)) errors.push(`${label}: contiene una referencia de regla de la clave`);
}

export async function crawlForLeaks({ app, password, webDir }) {
  const errors = [];
  const stats = { requests: 0, stages: 0 };
  const content = app.content;
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const anon = new Client(base);
  const team = new Client(base);
  const other = new Client(base);
  const mod = new Client(base);
  const get = async (c, p) => { stats.requests += 1; return c.get(p); };

  // 1) Rutas privadas o inexistentes: nunca 200 ni contenido sensible.
  for (const p of FORBIDDEN_PATHS) {
    stats.requests += 1;
    const r = await rawGet(app.server.address().port, p);
    if (r.status === 200) errors.push(`anónimo GET ${p}: respondió 200`);
    leakIn(`anónimo GET ${p}`, r.text, errors);
  }

  // 2) Páginas, estáticos y estado público como anónimo.
  const statics = readdirSync(path.join(webDir, 'static')).map((f) => `/static/${f}`);
  for (const p of ['/', '/moderador', '/api/public-state', '/api/health', ...statics]) {
    const r = await get(anon, p);
    if (r.status !== 200) errors.push(`anónimo GET ${p}: HTTP ${r.status}`);
    leakIn(`anónimo GET ${p}`, r.text, errors, { api: p.startsWith('/api/') });
    if (p.endsWith('.js') && r.text.includes('sourceMappingURL')) errors.push(`${p}: referencia a mapa de fuentes`);
    if (r.headers.get('cache-control') !== 'no-store' && p.startsWith('/api/')) errors.push(`${p}: falta Cache-Control: no-store`);
  }
  for (const p of ['/projection/', '/projection', '/assets/']) {
    const r = await get(anon, p);
    if (r.status !== 403) errors.push(`anónimo GET ${p}: se esperaba 403 y fue ${r.status}`);
  }

  // 3) Partida completa vista por equipos.
  await mod.post('/api/moderator/login', { password });
  await mod.post('/api/moderator/game', {});
  let ms = (await mod.get('/api/moderator/state')).data;
  const [t1, t2] = ms.teams;
  await team.post('/api/team/login', { code: t1.code });
  await other.post('/api/team/login', { code: t2.code });

  // Proyección: denegada al equipo, entregada sin cambios a la moderación.
  const projTeam = await get(team, '/projection/');
  if (projTeam.status !== 403) errors.push(`equipo GET /projection/: se esperaba 403 y fue ${projTeam.status}`);
  if (projTeam.text.includes('<div class="slide') || projTeam.text.includes('class="slide')) errors.push('equipo GET /projection/: el cuerpo de la denegación contiene diapositivas');
  const projMod = await mod.get('/projection/');
  const original = readFileSync(content.paths.projectionHtmlPath);
  if (projMod.status !== 200 || Buffer.compare(projMod.body, original) !== 0) {
    errors.push('moderación GET /projection/: el HTML servido no es idéntico al archivo de la proyección');
  }
  const firstEvidence = content.rounds[0].evidence[0];
  const assetRel = firstEvidence.asset_path.replace(/^assets\//, '');
  for (const p of [`/assets/${assetRel}`, `/projection/assets/${assetRel}`]) {
    const rt = await get(team, p);
    if (rt.status !== 403) errors.push(`equipo GET ${p}: se esperaba 403 y fue ${rt.status}`);
  }

  for (let guard = 0; guard < 60; guard++) {
    stats.stages += 1;
    const stageIndex = ms.stage_index;
    const stage = ms.stages[stageIndex];
    const s = await get(team, '/api/team/state');
    const pub = await get(team, '/api/public-state');
    const label = `etapa ${stageIndex} (${stage.round_id ?? '-'}/${stage.phase})`;
    leakIn(`${label} estado de equipo`, s.text, errors, { api: true });
    leakIn(`${label} estado público`, pub.text, errors, { api: true });
    const released = stage.phase === 'tutorial' ? -1 : stage.phase === 'closing' ? content.rounds.length - 1 : stage.round_index;
    for (const r of content.rounds) {
      if (r.index <= released) continue;
      const texts = [r.title, ...r.evidence.map((e) => e.body), ...r.claims.map((c) => c.text), ...r.actions.map((a) => a.text)];
      const ids = [...r.evidence, ...r.claims, ...r.actions].map((x) => `"${x.id}"`);
      for (const t of [...texts, ...ids]) {
        if (s.text.includes(t) || pub.text.includes(t)) errors.push(`${label}: se filtra contenido futuro de ${r.id}: ${t.slice(0, 60)}`);
      }
      for (const e of r.evidence) {
        const m = await get(team, `/media/${encodeURIComponent(e.id)}`);
        if (m.status !== 404) errors.push(`${label}: /media/${e.id} (no revelada) respondió ${m.status}`);
      }
    }
    for (const r of content.rounds) {
      if (r.index > released) continue;
      const m = await get(team, `/media/${encodeURIComponent(r.evidence[0].id)}`);
      if (m.status !== 200) errors.push(`${label}: /media/${r.evidence[0].id} (revelada) respondió ${m.status}`);
    }
    // Una respuesta enviada no es visible para otros equipos antes del bloqueo.
    if (stage.phase === 'deliberation') {
      const r0 = content.roundById.get(stage.round_id);
      await team.post('/api/team/response', { round_id: stage.round_id, claim_id: r0.claims[0].id, evidence_ids: [r0.evidence[0].id], action_id: r0.actions[0].id });
      const o = (await get(other, '/api/team/state')).data;
      const p2 = (await get(anon, '/api/public-state')).data;
      if ((o.responses ?? []).length || (p2.responses ?? []).length) errors.push(`${label}: respuestas visibles antes del bloqueo`);
    }
    if (stage.phase === 'objection') {
      const tokensOf = (st) => st.scoreboard.find((x) => x.team_id === t2.id).objection_tokens_remaining;
      const before = tokensOf((await get(anon, '/api/public-state')).data);
      await other.post('/api/team/objection', { round_id: stage.round_id, target_team_id: t1.id, objection_kind: 'contradiction', cited_evidence_id: content.roundById.get(stage.round_id).evidence[0].id });
      const p2 = (await get(anon, '/api/public-state')).data;
      if ((p2.objections ?? []).length) errors.push(`${label}: objeciones visibles antes de cerrar la ventana`);
      if (tokensOf(p2) !== before) errors.push(`${label}: las fichas públicas revelan una objeción de la ventana abierta`);
    }
    if (!ms.next_stage) break;
    const adv = await mod.post('/api/moderator/advance', { expected_stage_index: stageIndex });
    if (adv.status !== 200) {
      errors.push(`${label}: no se pudo avanzar (${adv.status})`);
      break;
    }
    ms = (await mod.get('/api/moderator/state')).data;
  }
  if (ms.phase !== 'closing') errors.push('el recorrido no llegó al cierre');
  return { errors, stats };
}
