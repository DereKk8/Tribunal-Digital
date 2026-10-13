import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { startApp, setupGame, advanceTo, tempDir, copyDemoPackage, mutate } from '../helpers.js';
import { StartupError } from '../../src/game/service.js';

test('un reinicio accidental del servidor conserva partida, sesiones, respuestas, fichas y puntos', async () => {
  const dataDir = tempDir('tribunal-persist-');
  let srv;
  try {
    srv = await startApp({ dataDir });
    const g = await setupGame(srv.base);
    await advanceTo(g.mod, 'R1', 'deliberation');
    await g.teams.azul.post('/api/team/response', { round_id: 'R1', claim_id: 'R1-C1', evidence_ids: ['R1-E1'], action_id: 'R1-A1' });
    await g.teams.verde.post('/api/team/response', { round_id: 'R1', claim_id: 'R1-C3', evidence_ids: ['R1-E1'], action_id: 'R1-A2' });
    await advanceTo(g.mod, 'R1', 'objection');
    await g.teams.azul.post('/api/team/objection', { round_id: 'R1', target_team_id: 'verde', objection_kind: 'unjustified_certainty', cited_evidence_id: 'R1-E2' });
    await advanceTo(g.mod, 'R1', 'resolution');
    const before = (await g.mod.get('/api/public-state')).data;
    const beforeTeam = (await g.teams.azul.get('/api/team/state')).data;
    await srv.close({ keepData: true });
    srv = undefined;

    // Mismo puerto no es necesario: las cookies siguen siendo válidas en el nuevo proceso.
    srv = await startApp({ dataDir });
    for (const c of [g.mod, g.teams.azul, g.teams.verde]) {
      c.base = srv.base;
    }
    const after = (await g.mod.get('/api/public-state')).data;
    assert.deepEqual(after.scoreboard, before.scoreboard);
    assert.deepEqual(after.round_results, before.round_results);
    assert.equal(after.stage_index, before.stage_index);
    const afterTeam = await g.teams.azul.get('/api/team/state');
    assert.equal(afterTeam.status, 200, 'la sesión del equipo sobrevive al reinicio');
    assert.equal(afterTeam.data.tokens_remaining, beforeTeam.tokens_remaining);
    assert.deepEqual(afterTeam.data.my_response, beforeTeam.my_response);
    // Reintentos tras el reinicio: idempotentes.
    const again = await g.mod.post('/api/moderator/score', { round_id: 'R1' });
    assert.equal(again.data.already, true);
    const retry = await g.teams.azul.post('/api/team/objection', { round_id: 'R1', target_team_id: 'verde', objection_kind: 'unjustified_certainty', cited_evidence_id: 'R1-E2' });
    assert.equal(retry.status, 200);
    assert.equal(retry.data.status, 'already_recorded');
    const changed = await g.teams.azul.post('/api/team/objection', { round_id: 'R1', target_team_id: 'verde', objection_kind: 'contradiction', cited_evidence_id: 'R1-E2' });
    assert.equal(changed.data.error.code, 'already_objected');
    assert.equal((await g.teams.azul.get('/api/team/state')).data.tokens_remaining, 2);
    assert.equal(srv.app.db.prepare('SELECT COUNT(*) AS n FROM score_events').get().n, 11);
    // La partida continúa normalmente.
    await advanceTo(g.mod, 'R2', 'reveal');
  } finally {
    await srv?.close({ keepData: true });
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('si el contenido cambia a mitad de partida, el servidor no arranca (fallo cerrado)', async () => {
  const dataDir = tempDir('tribunal-persist-');
  const pkg = copyDemoPackage();
  try {
    const srv = await startApp({ dataDir, contentPathsOverride: pkg.paths });
    await setupGame(srv.base);
    await srv.close({ keepData: true });
    mutate(pkg.paths, ({ key }) => { key.rounds.R1.accepted_actions = ['R1-A2']; });
    await assert.rejects(startApp({ dataDir, contentPathsOverride: pkg.paths }), (e) => e instanceof StartupError && /otro contenido/.test(e.message) && /archivar-partida/.test(e.message));
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(pkg.dir, { recursive: true, force: true });
  }
});
