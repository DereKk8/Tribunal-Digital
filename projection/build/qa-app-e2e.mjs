#!/usr/bin/env node
// Prueba de extremo a extremo contra la APLICACIÓN REAL del Agente B (no un simulacro).
// Requisitos: un árbol que contenga a la vez la aplicación (src/server.js) y este paquete, la clave
// privada real en content/answer-key.private.json y Playwright.
//
//   node projection/build/qa-app-e2e.mjs [--root /ruta/al/arbol-integrado]
//
// Qué hace: arranca el servidor en modo real con una base de datos temporal, crea una partida,
// inicia sesión con los cinco equipos, juega TODAS las fases por la API (respuestas y objeciones
// variadas), abre la proyección como moderación con ?follow=1 y comprueba en cada fase:
//   · que la proyección sigue la diapositiva que indica el servidor;
//   · que el marcador, las respuestas, las objeciones y los resultados se ven en vivo;
//   · que los puntos que calcula la aplicación coinciden con la clave (puntuador de referencia).
// No imprime respuestas: solo el resultado de cada comprobación.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { setKey } from '../../content/tools/lib/key-rules.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', HERE));
const PORT = Number(arg('--port', 3971));
const PASSWORD = 'prueba-e2e-' + Math.random().toString(36).slice(2, 12);
const base = `http://127.0.0.1:${PORT}`;

function loadPlaywright() {
  for (const c of [ROOT + '/', HERE + '/', '/opt/node-tools/node_modules/']) {
    try { return createRequire(c)('playwright'); } catch { /* siguiente */ }
  }
  console.error('✗ No encuentro Playwright.');
  process.exit(2);
}
const { chromium, request } = loadPlaywright();

const pub = JSON.parse(readFileSync(path.join(ROOT, 'content/public.json'), 'utf8'));
const key = JSON.parse(readFileSync(path.join(ROOT, 'content/answer-key.private.json'), 'utf8'));
const idx = {};
for (const r of pub.rounds) {
  const k = key.rounds[r.id];
  idx[r.id] = {
    args: new Set(k.accepted_arguments.map((a) => `${a.claim_id}|${setKey(a.evidence_ids)}`)),
    acts: new Set(k.accepted_actions),
    objs: new Set(k.accepted_objections.map((o) => `${o.target_claim_id}|${setKey(o.target_evidence_ids)}|${o.target_action_id}|${o.objection_kind}|${o.cited_evidence_id}`)),
  };
}

// ── Servidor real en modo real con datos temporales ──────────────────────────
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tribunal-e2e-real-'));
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js', '--modo=real'], {
  cwd: ROOT,
  env: { ...process.env, MODERATOR_PASSWORD: PASSWORD, DATA_DIR: dataDir, PORT: String(PORT), HOST: '127.0.0.1', LOGIN_MAX_FAILURES: '200' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let srvLog = '';
srv.stdout.on('data', (d) => { srvLog += d; });
srv.stderr.on('data', (d) => { srvLog += d; });
const waitUp = async () => {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return r.json(); } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('El servidor no arrancó:\n' + srvLog);
};

const fail = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail.push(m); };

let browser;
try {
  const health = await waitUp();
  ok(health.content_mode === 'real' && health.demo === false, 'la aplicación arranca en modo REAL con este paquete');

  const mod = await request.newContext({ baseURL: base });
  ok((await mod.post('/api/moderator/login', { data: { password: PASSWORD } })).ok(), 'inicio de sesión de moderación');
  ok((await mod.post('/api/moderator/game', { data: {} })).ok(), 'partida creada');
  const st = await (await mod.get('/api/moderator/state')).json();
  const codes = Object.fromEntries(st.teams.map((t) => [t.id, t.code]));
  const teamIds = pub.teams.map((t) => t.id);
  const team = {};
  for (const t of teamIds) {
    team[t] = await request.newContext({ baseURL: base });
    const r = await team[t].post('/api/team/login', { data: { code: codes[t] } });
    if (!r.ok()) throw new Error(`login ${t} falló`);
  }
  ok(true, 'los cinco equipos inician sesión con sus códigos');

  // Proyección como moderación (misma cookie que la sesión de moderación)
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const state = await mod.storageState();
  await ctx.addCookies(state.cookies);
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const teamCtx = await browser.newContext();
  await teamCtx.addCookies((await team.azul.storageState()).cookies);
  const teamPage = await teamCtx.newPage();
  const denied = await teamPage.goto(`${base}/projection/`);
  ok(denied.status() === 403, 'un código de equipo NO abre la proyección (403)');
  const resp = await page.goto(`${base}/projection/?follow=1`);
  ok(resp.status() === 200, 'la moderación abre la proyección en /projection/');
  const served = await resp.body();
  ok(served.equals(readFileSync(path.join(ROOT, 'projection/index.html'))), 'el HTML se sirve byte a byte, sin cambios');
  await page.waitForFunction(() => document.getElementById('live-badge').textContent.startsWith('En vivo'), null, { timeout: 10000 });
  ok(true, 'la proyección pasa a «En vivo» con /api/public-state del servidor real');

  const pubState = async () => (await (await mod.get('/api/public-state')).json());
  const activeId = () => page.evaluate(() => document.querySelector('.slide.active').id);
  const waitSlide = async (id) => { try { await page.waitForFunction((i) => document.querySelector('.slide.active').id === i, id, { timeout: 8000 }); return true; } catch { return false; } };
  const advance = async () => {
    const s = await (await mod.get('/api/moderator/state')).json();
    const i = s.game?.stage_index ?? s.stage_index;
    const r = await mod.post('/api/moderator/advance', { data: { expected_stage_index: i } });
    if (!r.ok()) throw new Error('advance: ' + (await r.text()));
    return pubState();
  };

  // Estrategias de juego por equipo (variadas; derivadas en ejecución, sin respuestas fijas en el código).
  const released = [];
  const choose = (t, r) => {
    const k = key.rounds[r.id];
    const avail = [...released];
    const accArg = k.accepted_arguments[0];
    const wrongAction = r.actions.find((a) => !k.accepted_actions.includes(a.id));
    const wrongClaim = r.claims.find((c) => !k.accepted_arguments.some((a) => a.claim_id === c.id));
    switch (t) {
      case 'azul': return { claim_id: accArg.claim_id, evidence_ids: accArg.evidence_ids, action_id: k.accepted_actions[0] };
      case 'rojo': return { claim_id: accArg.claim_id, evidence_ids: [avail[avail.length - 1]], action_id: k.accepted_actions[0] };
      case 'verde': return { claim_id: wrongClaim.id, evidence_ids: avail.slice(0, 2), action_id: wrongAction.id };
      case 'amarillo': return { claim_id: r.claims[r.claims.length - 1].id, evidence_ids: avail.slice(-2), action_id: r.actions[r.actions.length - 1].id };
      default: return { claim_id: r.claims[0].id, evidence_ids: [avail[0]], action_id: r.actions[0].id }; // morado (ausente en R2 y R4)
    }
  };

  const expected = Object.fromEntries(teamIds.map((t) => [t, 0]));
  const tokens = Object.fromEntries(teamIds.map((t) => [t, 3]));
  let s = await pubState();
  // tutorial → avanzar por todas las etapas
  let guard = 0;
  while (s.phase !== 'closing' && guard++ < 60) {
    s = await advance();
    const round = pub.rounds.find((r) => r.id === s.round_id);
    if (s.phase === 'reveal' || (s.phase === 'deliberation' && s.round_id === 'FINAL')) {
      if (!released.includes(round.evidence[0].id)) released.push(...round.evidence.map((e) => e.id));
    }
    const mapped = s.slide;
    const followed = await waitSlide(mapped);
    ok(followed, `${s.round_id || '—'} · ${s.phase}: la proyección sigue la diapositiva del servidor (${mapped})`);
    if (s.phase === 'deliberation') {
      for (const t of teamIds) {
        const c = choose(t, round);
        if (t === 'morado' && ['R2', 'R4'].includes(round.id)) continue;
        const body = { round_id: round.id, ...c };
        const r = await team[t].post('/api/team/response', { data: body });
        if (!r.ok()) ok(false, `${t} no pudo bloquear su respuesta: ${await r.text()}`);
      }
    }
    if (s.phase === 'defense') {
      await page.waitForTimeout(3500);
      const rows = await page.$$eval('.slide.active .resp-row', (els) => els.map((e) => e.textContent));
      const absent = round.id === 'R2' || round.id === 'R4';
      ok(rows.length === 5 && rows.filter((x) => x.includes('Sin respuesta bloqueada')).length === (absent ? 1 : 0), `${round.id} · Defensa: respuestas bloqueadas en pantalla${absent ? ' (Morado ausente)' : ''}`);
    }
    if (s.phase === 'objection') {
      // Respuestas bloqueadas reales, leídas del estado público
      const locked = Object.fromEntries((s.responses || []).filter((x) => x.status === 'submitted').map((x) => [x.team_id, x]));
      const plan = [];
      // Dos equipos con fichas objetan: el primero busca una objeción válida según la clave;
      // el segundo hace una objeción probablemente inválida. Se respetan las 3 fichas por equipo.
      const k = idx[round.id];
      const withTokens = teamIds.filter((t) => tokens[t] > 0).sort((a, b) => tokens[b] - tokens[a] || teamIds.indexOf(a) - teamIds.indexOf(b));
      const [first, second] = withTokens;
      if (first) {
        let found = null;
        for (const target of teamIds) {
          const tr = locked[target];
          if (target === first || !tr || found) continue;
          for (const kind of ['contradiction', 'logical_leap', 'unjustified_certainty', 'unsafe_action']) {
            for (const e of released) if (!found && k.objs.has(`${tr.claim_id}|${setKey(tr.evidence_ids)}|${tr.action_id}|${kind}|${e}`)) found = { target, kind, e, tr };
          }
        }
        if (found) plan.push({ t: first, target: found.target, kind: found.kind, cited: found.e, snapshot: found.tr });
      }
      if (second) {
        const target = second === 'azul' ? 'rojo' : 'azul';
        if (locked[target]) plan.push({ t: second, target, kind: 'contradiction', cited: released[0], snapshot: locked[target] });
      }
      for (const p of plan) {
        const r = await team[p.t].post('/api/team/objection', { data: { round_id: round.id, target_team_id: p.target, objection_kind: p.kind, cited_evidence_id: p.cited } });
        p.accepted = r.ok();
        if (!r.ok()) ok(false, `objeción de ${p.t} rechazada por la API: ${await r.text()}`);
        else tokens[p.t] -= 1;
        p.valid = k.objs.has(`${p.snapshot.claim_id}|${setKey(p.snapshot.evidence_ids)}|${p.snapshot.action_id}|${p.kind}|${p.cited}`);
      }
      round._plan = plan;
    }
    if (s.phase === 'resolution') {
      // Puntos esperados con el puntuador de referencia
      const k = idx[round.id];
      const rr = Object.fromEntries((s.round_results || []).map((x) => [x.team_id, x]));
      const locked = Object.fromEntries((s.responses || []).filter((x) => x.status === 'submitted').map((x) => [x.team_id, x]));
      let mismatch = [];
      for (const t of teamIds) {
        const lr = locked[t];
        const arg = lr && k.args.has(`${lr.claim_id}|${setKey(lr.evidence_ids)}`) ? 3 : 0;
        const act = lr && k.acts.has(lr.action_id) ? 2 : 0;
        const obj = (round._plan || []).filter((p) => p.t === t && p.accepted && p.valid).length * 3;
        expected[t] += arg + act + obj;
        const got = rr[t] || { argument_points: 0, action_points: 0, objection_points: 0 };
        if ((got.argument_points ?? 0) !== arg || (got.action_points ?? 0) !== act || (got.objection_points ?? 0) !== obj) mismatch.push(`${t}: app ${got.argument_points}/${got.action_points}/${got.objection_points} vs clave ${arg}/${act}/${obj}`);
      }
      ok(mismatch.length === 0, `${round.id} · la aplicación puntúa exactamente como la clave${mismatch.length ? ' → ' + mismatch.join('; ') : ''}`);
      await page.waitForTimeout(3500);
      const pts = await page.$$eval('.slide.active .round-pts', (els) => els.length);
      const chips = await page.$$eval('.slide.active .obj-chip', (els) => els.map((e) => e.className));
      const nObj = (round._plan || []).filter((p) => p.accepted).length;
      ok(pts >= 1 && chips.length === nObj, `${round.id} · Resultados en pantalla: puntos de la ronda y ${nObj} objeción(es) con ✓/✗`);
      const board = await page.$$eval('.slide.active .board-row', (els) => els.map((e) => [e.querySelector('.team').textContent.trim(), e.querySelector('.score').firstChild.textContent]));
      const totals = Object.fromEntries((s.scoreboard || []).map((x) => [x.team_id, x.score]));
      ok(board.length === 5 && board.every(([name, sc]) => String(totals[pub.teams.find((t) => t.name === name).id]) === sc), `${round.id} · marcador en pantalla = marcador del servidor`);
    }
  }
  s = await pubState();
  ok(s.phase === 'closing', 'la partida llega al cierre');
  await page.waitForTimeout(3500);
  const totals = Object.fromEntries(s.scoreboard.map((x) => [x.team_id, x.score]));
  ok(teamIds.every((t) => totals[t] === expected[t]), `totales finales = clave (${teamIds.map((t) => `${t} ${totals[t]}`).join(', ')})`);
  ok((await activeId()) === 'cierre-podio', 'la proyección muestra el podio en el cierre');
  const winners = await page.$$eval('#cierre-podio .board-row.winner', (els) => els.length);
  ok(winners === (s.winners || []).length && winners >= 1, `ganador(es) destacados en el podio (${winners})`);
  ok(pageErrors.length === 0, `sin errores de JavaScript en la proyección (${pageErrors.join(' | ') || 'ninguno'})`);
} catch (e) {
  ok(false, 'error inesperado: ' + e.message);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(fail.length ? `\n✗ ${fail.length} fallos` : '\n✓ Integración de extremo a extremo con la aplicación real verificada.');
process.exit(fail.length ? 1 : 0);
