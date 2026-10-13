import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, setupGame, advanceTo, Client } from '../helpers.js';

let srv;
let g;
before(async () => {
  srv = await startApp();
  g = await setupGame(srv.base);
});
after(async () => srv.close());

const count = (sql, ...args) => srv.app.db.prepare(sql).get(...args).n;

test('20 envíos idénticos simultáneos (doble clic / reintentos): una sola respuesta', async () => {
  await advanceTo(g.mod, 'R1', 'deliberation');
  const payload = { round_id: 'R1', claim_id: 'R1-C1', evidence_ids: ['R1-E1'], action_id: 'R1-A1' };
  const results = await Promise.all(Array.from({ length: 20 }, () => g.teams.azul.post('/api/team/response', payload)));
  const statuses = results.map((r) => r.status).sort();
  assert.equal(statuses.filter((s) => s === 201).length, 1);
  assert.equal(statuses.filter((s) => s === 200).length, 19);
  assert.equal(count("SELECT COUNT(*) AS n FROM responses WHERE team_id = 'azul'"), 1);
});

test('el mismo equipo desde dos teléfonos con respuestas distintas: gana exactamente una', async () => {
  // Segundo teléfono del mismo equipo (misma partida, sesión distinta).
  const phone2 = new Client(srv.base);
  await phone2.post('/api/team/login', { code: g.codes.rojo });
  const a = { round_id: 'R1', claim_id: 'R1-C2', evidence_ids: ['R1-E2'], action_id: 'R1-A1' };
  const b = { round_id: 'R1', claim_id: 'R1-C3', evidence_ids: ['R1-E1'], action_id: 'R1-A2' };
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? phone2 : g.teams.rojo).post('/api/team/response', i % 2 ? b : a)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  const stored = srv.app.db.prepare("SELECT claim_id FROM responses WHERE team_id = 'rojo'").all();
  assert.equal(stored.length, 1);
  for (const r of results) {
    if (r.status === 201) continue;
    const sameAsWinner = r.status === 200 && r.data.response.claim_id === stored[0].claim_id;
    const conflict = r.status === 409 && r.data.error.code === 'already_submitted';
    assert.ok(sameAsWinner || conflict, JSON.stringify(r.data));
  }
});

test('cinco equipos envían a la vez: cinco respuestas', async () => {
  const p = (c, e, a) => ({ round_id: 'R1', claim_id: c, evidence_ids: e, action_id: a });
  await Promise.all([
    g.teams.verde.post('/api/team/response', p('R1-C3', ['R1-E1'], 'R1-A2')),
    g.teams.amarillo.post('/api/team/response', p('R1-C2', ['R1-E2'], 'R1-A1')),
    g.teams.morado.post('/api/team/response', p('R1-C4', ['R1-E1', 'R1-E2'], 'R1-A1')),
  ]);
  assert.equal(count('SELECT COUNT(*) AS n FROM responses'), 5);
});

test('10 avances simultáneos con la misma fase esperada: avanza una sola vez', async () => {
  const st = (await g.mod.get('/api/moderator/state')).data;
  const results = await Promise.all(Array.from({ length: 10 }, () => g.mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 9);
  assert.equal((await g.mod.get('/api/moderator/state')).data.stage_index, st.stage_index + 1);
  assert.equal(count('SELECT COUNT(*) AS n FROM stage_log'), st.stage_index + 2);
});

test('objeciones repetidas simultáneas: una objeción y una sola ficha descontada', async () => {
  await advanceTo(g.mod, 'R1', 'objection');
  const payload = { round_id: 'R1', target_team_id: 'verde', objection_kind: 'unjustified_certainty', cited_evidence_id: 'R1-E2' };
  const results = await Promise.all(Array.from({ length: 15 }, () => g.teams.azul.post('/api/team/objection', payload)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 200).length, 14);
  assert.ok(results.every((r) => r.data.tokens_remaining === 2));
  assert.equal(count("SELECT COUNT(*) AS n FROM objections WHERE attacking_team_id = 'azul'"), 1);
});

test('dos objeciones distintas simultáneas del mismo equipo: solo una entra', async () => {
  const a = { round_id: 'R1', target_team_id: 'verde', objection_kind: 'unsafe_action', cited_evidence_id: 'R1-E1' };
  const b = { round_id: 'R1', target_team_id: 'amarillo', objection_kind: 'contradiction', cited_evidence_id: 'R1-E2' };
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => g.teams.rojo.post('/api/team/objection', i % 2 ? b : a)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(count("SELECT COUNT(*) AS n FROM objections WHERE attacking_team_id = 'rojo'"), 1);
  assert.equal((await g.teams.rojo.get('/api/team/state')).data.tokens_remaining, 2);
});

test('resultados: avances y recálculos simultáneos no duplican puntos', async () => {
  await advanceTo(g.mod, 'R1', 'confrontation');
  const st = (await g.mod.get('/api/moderator/state')).data;
  const results = await Promise.all([
    ...Array.from({ length: 5 }, () => g.mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index })),
    ...Array.from({ length: 5 }, () => g.mod.post('/api/moderator/score', { round_id: 'R1' })),
  ]);
  assert.equal(results.slice(0, 5).filter((r) => r.status === 200).length, 1);
  assert.equal(count("SELECT COUNT(*) AS n FROM round_results WHERE round_id = 'R1'"), 1);
  // 5 equipos × (argumento + acción) + 2 objeciones
  assert.equal(count("SELECT COUNT(*) AS n FROM score_events WHERE round_id = 'R1'"), 12);
  const extra = await Promise.all(Array.from({ length: 5 }, () => g.mod.post('/api/moderator/score', { round_id: 'R1' })));
  assert.ok(extra.every((r) => r.status === 200 && r.data.already === true));
  assert.equal(count("SELECT COUNT(*) AS n FROM score_events WHERE round_id = 'R1'"), 12);
  const azul = (await g.mod.get('/api/public-state')).data.scoreboard.find((r) => r.team_id === 'azul');
  assert.equal(azul.score, 8);
});
