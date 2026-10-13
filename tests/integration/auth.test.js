import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { startApp, setupGame, loginModerator, Client, PASSWORD, randomSecret } from '../helpers.js';

let srv;
let g;
before(async () => {
  srv = await startApp();
  g = await setupGame(srv.base);
});
after(async () => srv.close());

test('sin partida activa, el login de equipo explica que falta crearla', async () => {
  const s2 = await startApp();
  try {
    const r = await new Client(s2.base).post('/api/team/login', { code: 'ABCDEF' });
    assert.equal(r.status, 409);
    assert.equal(r.data.error.code, 'no_game');
  } finally {
    await s2.close();
  }
});

test('código incorrecto: 401; correcto: cookie HttpOnly + SameSite=Strict', async () => {
  const c = new Client(srv.base);
  const bad = await c.post('/api/team/login', { code: 'ZZZZZZ' });
  assert.equal(bad.status, 401);
  assert.match(bad.data.error.message, /incorrecto/);
  const ok = await c.post('/api/team/login', { code: g.codes.verde.toLowerCase().slice(0, 3) + ' ' + g.codes.verde.slice(3) });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(ok.data.team.id, 'verde');
});

test('limita los intentos fallidos de inicio de sesión por IP', async () => {
  const s2 = await startApp({ env: { LOGIN_MAX_FAILURES: '3' } });
  try {
    const mod = await loginModerator(s2.base);
    await mod.post('/api/moderator/game', {});
    const code = (await mod.get('/api/moderator/state')).data.teams[0].code;
    const c = new Client(s2.base);
    for (let i = 0; i < 3; i++) assert.equal((await c.post('/api/team/login', { code: 'XXXXXX' })).status, 401);
    const blocked = await c.post('/api/team/login', { code });
    assert.equal(blocked.status, 429);
    const m = new Client(s2.base);
    for (let i = 0; i < 3; i++) assert.equal((await m.post('/api/moderator/login', { password: randomSecret() })).status, 401);
    assert.equal((await m.post('/api/moderator/login', { password: PASSWORD })).status, 429);
  } finally {
    await s2.close();
  }
});

test('un equipo no accede a la API de moderación', async () => {
  const t = g.teams.azul;
  assert.equal((await t.get('/api/moderator/state')).status, 401);
  assert.equal((await t.post('/api/moderator/advance', { expected_stage_index: 0 })).status, 401);
  assert.equal((await t.post('/api/moderator/reset', { confirm: 'REINICIAR' })).status, 401);
  assert.equal((await t.post('/api/moderator/score', { round_id: 'R1' })).status, 401);
  assert.equal((await t.get('/api/moderator/export.json')).status, 401);
  assert.equal((await t.get('/api/moderator/export.csv')).status, 401);
});

test('no se puede forjar el rol: el token de equipo en la cookie de moderación no sirve', async () => {
  const teamToken = g.teams.rojo.cookies.get('td_team');
  const forged = new Client(srv.base);
  forged.cookies.set('td_mod', teamToken);
  assert.equal((await forged.get('/api/moderator/state')).status, 401);
  assert.equal((await forged.get('/projection/')).status, 403);
  const modToken = g.mod.cookies.get('td_mod');
  const forged2 = new Client(srv.base);
  forged2.cookies.set('td_team', modToken);
  assert.equal((await forged2.get('/api/team/state')).status, 401);
  const random = new Client(srv.base);
  random.cookies.set('td_mod', 'a'.repeat(43));
  random.cookies.set('td_team', 'b'.repeat(43));
  assert.equal((await random.get('/api/moderator/state')).status, 401);
  assert.equal((await random.get('/api/team/state')).status, 401);
});

test('el cuerpo no puede elevar privilegios ni enviar puntos, fases o fichas', async () => {
  const t = g.teams.azul;
  const r = await t.post('/api/team/response', { round_id: 'R1', claim_id: 'R1-C1', evidence_ids: ['R1-E1'], action_id: 'R1-A1', role: 'moderator' });
  assert.equal(r.status, 400);
  assert.equal(r.data.error.code, 'field_not_allowed');
  for (const extra of [{ score: 3 }, { phase: 'resolution' }, { tokens: 3 }, { target_snapshot: {} }]) {
    const o = await t.post('/api/team/objection', { round_id: 'R1', target_team_id: 'rojo', objection_kind: 'contradiction', cited_evidence_id: 'R1-E1', ...extra });
    assert.equal(o.data.error.code, 'field_not_allowed');
  }
});

test('/projection: denegada a equipos y anónimos; la moderación recibe el HTML sin cambios', async () => {
  for (const c of [new Client(srv.base), g.teams.amarillo]) {
    const r = await c.get('/projection/');
    assert.equal(r.status, 403);
    assert.ok(!r.text.includes('demo-r1-reveal'));
    assert.equal((await c.get('/projection')).status, 403);
    assert.equal((await c.get('/projection/index.html')).status, 403);
    assert.equal((await c.get('/assets/demo-r4-e1.svg')).status, 403);
  }
  const redirect = await g.mod.get('/projection');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/projection/');
  const r = await g.mod.get('/projection/');
  assert.equal(r.status, 200);
  assert.equal(Buffer.compare(r.body, readFileSync(srv.config.content.projectionHtmlPath)), 0);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await g.mod.get('/projection/assets/demo-r4-e1.svg')).status, 200);
  assert.equal((await g.mod.get('/assets/demo-r4-e1.svg')).status, 200);
});

test('protección CSRF: origen ajeno, Sec-Fetch-Site cross-site y tipo de contenido no JSON', async () => {
  const t = g.teams.azul;
  const body = { round_id: 'R1', claim_id: 'R1-C1', evidence_ids: ['R1-E1'], action_id: 'R1-A1' };
  const evil = await t.post('/api/team/response', body, { headers: { origin: 'http://malicioso.example' } });
  assert.equal(evil.status, 403);
  const cross = await t.post('/api/team/response', body, { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(cross.status, 403);
  const form = await t.req('POST', '/api/team/response', undefined, { rawBody: 'claim_id=R1-C1', contentType: 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  const big = await t.req('POST', '/api/team/response', undefined, { rawBody: JSON.stringify({ x: 'a'.repeat(40000) }), contentType: 'application/json' });
  assert.equal(big.status, 413);
  const malformed = await t.req('POST', '/api/team/response', undefined, { rawBody: '{"round_id":', contentType: 'application/json' });
  assert.equal(malformed.status, 400);
});

test('métodos no permitidos', async () => {
  const r = await new Promise((resolve) => {
    const req = http.request(srv.base + '/api/public-state', { method: 'DELETE' }, (res) => { res.resume(); resolve(res.statusCode); });
    req.end();
  });
  assert.equal(r, 405);
});

test('cabeceras de seguridad en páginas y API', async () => {
  const page = await new Client(srv.base).get('/');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const api = await new Client(srv.base).get('/api/public-state');
  assert.equal(api.headers.get('cache-control'), 'no-store');
  assert.equal(api.headers.get('access-control-allow-origin'), null);
});

test('reinicio protegido: exige escribir REINICIAR e invalida las sesiones y códigos anteriores', async () => {
  const s2 = await startApp();
  try {
    const g2 = await setupGame(s2.base);
    const no = await g2.mod.post('/api/moderator/reset', { confirm: 'si' });
    assert.equal(no.status, 400);
    assert.equal((await g2.teams.azul.get('/api/team/state')).status, 200);
    const yes = await g2.mod.post('/api/moderator/reset', { confirm: 'REINICIAR' });
    assert.equal(yes.status, 200);
    assert.notEqual(yes.data.game_id, yes.data.archived_game_id);
    assert.equal((await g2.teams.azul.get('/api/team/state')).status, 401);
    const st = (await g2.mod.get('/api/moderator/state')).data;
    assert.equal(st.stage_index, 0);
    const newCode = st.teams.find((t) => t.id === 'azul').code;
    const old = await new Client(s2.base).post('/api/team/login', { code: g2.codes.azul });
    // Los códigos son aleatorios: el antiguo solo podría servir si coincidiera por azar con el nuevo.
    if (newCode !== g2.codes.azul) assert.equal(old.status, 401);
    assert.equal((await new Client(s2.base).post('/api/team/login', { code: newCode })).status, 200);
  } finally {
    await s2.close();
  }
});

test('las sesiones caducan (12 h)', async () => {
  let now = Date.parse('2026-10-14T08:00:00Z');
  const s2 = await startApp({ clock: () => new Date(now) });
  try {
    const g2 = await setupGame(s2.base);
    assert.equal((await g2.teams.rojo.get('/api/team/state')).status, 200);
    now += 13 * 3600 * 1000;
    assert.equal((await g2.teams.rojo.get('/api/team/state')).status, 401);
    assert.equal((await g2.mod.get('/api/moderator/state')).status, 401);
  } finally {
    await s2.close();
  }
});

test('detrás de un proxy HTTPS (despliegue en la nube): cookie Secure y tope global de intentos', async () => {
  const s2 = await startApp({ env: { TRUST_PROXY: '1', LOGIN_MAX_FAILURES: '3', LOGIN_GLOBAL_MAX_FAILURES: '5' } });
  try {
    const mod = await loginModerator(s2.base);
    await mod.post('/api/moderator/game', {});
    const code = (await mod.get('/api/moderator/state')).data.teams[0].code;
    const ok = await new Client(s2.base).post('/api/team/login', { code }, { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.7' } });
    assert.match(ok.headers.getSetCookie()[0], /; Secure/);
    const plain = await new Client(s2.base).post('/api/team/login', { code });
    assert.doesNotMatch(plain.headers.getSetCookie()[0], /Secure/);
    // Falsear X-Forwarded-For en cada intento no evita el tope global.
    for (let i = 0; i < 5; i++) {
      const r = await new Client(s2.base).post('/api/team/login', { code: 'XXXXXX' }, { headers: { 'x-forwarded-for': `198.51.100.${i}` } });
      assert.equal(r.status, 401);
    }
    const blocked = await new Client(s2.base).post('/api/team/login', { code }, { headers: { 'x-forwarded-for': '198.51.100.99' } });
    assert.equal(blocked.status, 429);
  } finally {
    await s2.close();
  }
});
