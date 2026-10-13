import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, setupGame, advanceTo } from '../helpers.js';

let srv;
let g;
const resp = (claim, ev, action, round = 'R1') => ({ round_id: round, claim_id: claim, evidence_ids: ev, action_id: action });
const obj = (target, kind, cited, round = 'R1') => ({ round_id: round, target_team_id: target, objection_kind: kind, cited_evidence_id: cited });

before(async () => {
  srv = await startApp();
  g = await setupGame(srv.base);
});
after(async () => srv.close());

test('R1: reglas de la ventana de respuesta', async () => {
  const { mod, teams } = g;
  // Tutorial: no hay ronda en curso.
  assert.equal((await teams.azul.post('/api/team/response', resp('R1-C1', ['R1-E1'], 'R1-A1'))).data.error.code, 'wrong_round');
  await advanceTo(mod, 'R1', 'reveal');
  const early = await teams.azul.post('/api/team/response', resp('R1-C1', ['R1-E1'], 'R1-A1'));
  assert.equal(early.status, 409);
  assert.equal(early.data.error.code, 'phase_closed');
  // Durante la revelación el equipo ya ve evidencia y opciones de R1, pero no las de R2.
  const st = (await teams.azul.get('/api/team/state')).data;
  assert.deepEqual(st.released_evidence.map((e) => e.id), ['R1-E1', 'R1-E2']);
  assert.equal(st.can_respond, false);

  await advanceTo(mod, 'R1', 'deliberation');
  const cases = [
    [resp('R1-C1', ['R1-E1'], 'R1-A1', 'R2'), 409, 'wrong_round'],
    [resp('R2-C1', ['R1-E1'], 'R1-A1'), 422, 'bad_claim'],
    [resp('R1-C1', ['R1-E1'], 'R2-A1'), 422, 'bad_action'],
    [resp('R1-C1', ['NO-EXISTE'], 'R1-A1'), 422, 'bad_evidence'],
    [resp('R1-C1', ['R2-E1'], 'R1-A1'), 422, 'bad_evidence'],
    [resp('R1-C1', [], 'R1-A1'), 422, 'bad_evidence_count'],
    [resp('R1-C1', ['R1-E1', 'R1-E2', 'R1-E1'], 'R1-A1'), 422, 'bad_evidence_count'],
    [resp('R1-C1', ['R1-E1', 'R1-E1'], 'R1-A1'), 422, 'bad_evidence_count'],
    [{ round_id: 'R1', claim_id: 'R1-C1', action_id: 'R1-A1' }, 400, 'bad_request'],
    [{ ...resp('R1-C1', ['R1-E1'], 'R1-A1'), team_id: 'rojo' }, 403, 'team_mismatch'],
  ];
  for (const [payload, status, code] of cases) {
    const r = await teams.azul.post('/api/team/response', payload);
    assert.equal(r.status, status, `${JSON.stringify(payload)} → ${JSON.stringify(r.data)}`);
    assert.equal(r.data.error.code, code);
  }
  // La evidencia futura se rechaza sin confirmar que exista.
  const fut = await teams.azul.post('/api/team/response', resp('R1-C1', ['R2-E1'], 'R1-A1'));
  const nada = await teams.azul.post('/api/team/response', resp('R1-C1', ['NO-EXISTE'], 'R1-A1'));
  assert.equal(fut.data.error.message, nada.data.error.message);

  // team_id coincidente es aceptado (contrato canónico).
  assert.equal((await teams.azul.post('/api/team/response', { ...resp('R1-C1', ['R1-E1'], 'R1-A1'), team_id: 'azul' })).status, 201);
  assert.equal((await teams.rojo.post('/api/team/response', resp('R1-C4', ['R1-E2', 'R1-E1'], 'R1-A1'))).status, 201);
  assert.equal((await teams.verde.post('/api/team/response', resp('R1-C3', ['R1-E1'], 'R1-A2'))).status, 201);
  assert.equal((await teams.amarillo.post('/api/team/response', resp('R1-C1', ['R1-E2'], 'R1-A2'))).status, 201);
  // morado no responde.

  // Antes del bloqueo nadie ve respuestas ajenas.
  assert.deepEqual((await teams.rojo.get('/api/team/state')).data.responses, []);
  assert.deepEqual((await g.mod.get('/api/public-state')).data.responses, []);
  const ms = (await mod.get('/api/moderator/state')).data;
  assert.equal(ms.teams.find((t) => t.id === 'morado').response_status, 'missing');
  assert.equal(ms.teams.find((t) => t.id === 'azul').response_status, 'received');
});

test('R1: bloqueo al cerrar la deliberación; inmutable tras ver las demás', async () => {
  const { mod, teams } = g;
  await advanceTo(mod, 'R1', 'defense');
  const pub = (await mod.get('/api/public-state')).data;
  assert.equal(pub.responses.length, 5);
  const morado = pub.responses.find((r) => r.team_id === 'morado');
  assert.deepEqual(morado, { team_id: 'morado', status: 'absent' });
  const rojo = pub.responses.find((r) => r.team_id === 'rojo');
  assert.equal(rojo.claim_text, 'Circulan dos horarios distintos para la misma reunión.');
  // Cambiar tras ver a los demás: imposible. Enviar tarde: imposible.
  const change = await teams.azul.post('/api/team/response', resp('R1-C2', ['R1-E2'], 'R1-A1'));
  assert.equal(change.data.error.code, 'already_submitted');
  const late = await teams.morado.post('/api/team/response', resp('R1-C2', ['R1-E2'], 'R1-A1'));
  assert.equal(late.data.error.code, 'phase_closed');
  // Reintento idéntico tras el bloqueo: confirma sin cambiar nada.
  const same = await teams.azul.post('/api/team/response', resp('R1-C1', ['R1-E1'], 'R1-A1'));
  assert.equal(same.status, 200);
  assert.equal(same.data.status, 'already_recorded');
  const ms = (await mod.get('/api/moderator/state')).data;
  assert.equal(ms.teams.find((t) => t.id === 'morado').response_status, 'absent');
});

test('R1: objeciones — ventana, autoobjeción, ausentes, una por fase, fichas', async () => {
  const { mod, teams } = g;
  const outside = await teams.azul.post('/api/team/objection', obj('verde', 'unjustified_certainty', 'R1-E2'));
  assert.equal(outside.data.error.code, 'phase_closed');
  await advanceTo(mod, 'R1', 'objection');
  assert.equal((await teams.azul.post('/api/team/objection', obj('azul', 'contradiction', 'R1-E1'))).data.error.code, 'self_objection');
  assert.equal((await teams.azul.post('/api/team/objection', obj('naranja', 'contradiction', 'R1-E1'))).data.error.code, 'bad_target');
  assert.equal((await teams.azul.post('/api/team/objection', obj('verde', 'insulto', 'R1-E1'))).data.error.code, 'bad_kind');
  assert.equal((await teams.azul.post('/api/team/objection', obj('verde', 'contradiction', 'R2-E1'))).data.error.code, 'bad_evidence');
  const absent = await teams.azul.post('/api/team/objection', obj('morado', 'contradiction', 'R1-E1'));
  assert.equal(absent.data.error.code, 'target_absent');
  assert.equal((await teams.azul.get('/api/team/state')).data.tokens_remaining, 3, 'objetar a un ausente no gasta ficha');
  assert.equal((await teams.azul.post('/api/team/objection', { ...obj('verde', 'contradiction', 'R1-E1'), attacking_team_id: 'rojo' })).data.error.code, 'team_mismatch');

  // Válida (azul) e inválida (amarillo) contra el mismo objetivo; rojo también ataca a verde (válida, otra regla).
  const a = await teams.azul.post('/api/team/objection', obj('verde', 'unjustified_certainty', 'R1-E2'));
  assert.equal(a.status, 201);
  assert.equal(a.data.tokens_remaining, 2);
  assert.equal((await teams.rojo.post('/api/team/objection', obj('verde', 'unsafe_action', 'R1-E1'))).status, 201);
  assert.equal((await teams.amarillo.post('/api/team/objection', obj('verde', 'contradiction', 'R1-E2'))).status, 201);
  // morado (sin respuesta) puede objetar igualmente.
  assert.equal((await teams.morado.post('/api/team/objection', obj('amarillo', 'unsafe_action', 'R1-E2'))).status, 201);
  // Segunda objeción en la misma fase: rechazada.
  assert.equal((await teams.azul.post('/api/team/objection', obj('rojo', 'contradiction', 'R1-E1'))).data.error.code, 'already_objected');

  // Fichas: el equipo ve su inventario real; lo público no revela la ventana abierta.
  const pub = (await mod.get('/api/public-state')).data;
  assert.equal(pub.scoreboard.find((r) => r.team_id === 'azul').objection_tokens_remaining, 3);
  assert.deepEqual(pub.objections, []);
  const ms = (await mod.get('/api/moderator/state')).data;
  assert.equal(ms.objection_count, 4);
  assert.equal(ms.teams.find((t) => t.id === 'azul').tokens_remaining, 2);
});

test('R1: confrontación y resultados exactos (+3/+2/+3, inválida 0 con ficha gastada)', async () => {
  const { mod, teams } = g;
  await advanceTo(mod, 'R1', 'confrontation');
  const conf = (await mod.get('/api/public-state')).data;
  assert.equal(conf.objections.length, 4);
  assert.ok(conf.objections.every((o) => o.valid === undefined));
  assert.deepEqual(conf.round_results, []);
  assert.equal(conf.scoreboard.find((r) => r.team_id === 'azul').objection_tokens_remaining, 2);
  const ms = (await mod.get('/api/moderator/state')).data;
  assert.deepEqual(ms.objections_by_target.find((x) => x.team_id === 'verde').attackers.sort(), ['amarillo', 'azul', 'rojo']);
  // Puntuar antes de los resultados: no permitido.
  assert.equal((await mod.post('/api/moderator/score', { round_id: 'R1' })).data.error.code, 'too_early');

  await advanceTo(mod, 'R1', 'resolution');
  const res = (await mod.get('/api/public-state')).data;
  const rr = Object.fromEntries(res.round_results.map((r) => [r.team_id, r]));
  // azul: C1+[E1] (+3), A1 (+2), objeción válida (+3)
  assert.deepEqual([rr.azul.argument_points, rr.azul.action_points, rr.azul.objection_points], [3, 2, 3]);
  // rojo: C4 con evidencias en otro orden (+3), A1 (+2), objeción válida independiente (+3)
  assert.deepEqual([rr.rojo.argument_points, rr.rojo.action_points, rr.rojo.objection_points], [3, 2, 3]);
  // verde: afirmación no aceptada, acción insegura → 0
  assert.equal(rr.verde.total, 0);
  // amarillo: misma afirmación que azul con evidencia incorrecta (0), acción incorrecta (0), objeción inválida (0)
  assert.deepEqual([rr.amarillo.argument_points, rr.amarillo.action_points, rr.amarillo.objection_points], [0, 0, 0]);
  // morado: sin respuesta → 0; su objeción a amarillo (C1,[E2],A2) no figura en la clave → 0
  assert.equal(rr.morado.total, 0);
  for (const t of ['azul', 'rojo', 'amarillo', 'morado']) {
    assert.equal((await teams[t].get('/api/team/state')).data.tokens_remaining, 2, `${t} gastó exactamente 1 ficha`);
  }
  assert.equal((await teams.verde.get('/api/team/state')).data.tokens_remaining, 3);
  const valid = Object.fromEntries(res.objections.map((o) => [o.attacking_team_id, o.valid]));
  assert.deepEqual(valid, { azul: true, rojo: true, amarillo: false, morado: false });
  // Recalcular es idempotente.
  const again = await mod.post('/api/moderator/score', { round_id: 'R1' });
  assert.equal(again.data.already, true);
  assert.deepEqual((await mod.get('/api/public-state')).data.scoreboard, res.scoreboard);
  // Las explicaciones de moderación citan las reglas; las del equipo, no.
  const ex = (await mod.get('/api/moderator/state')).data.explanations[0];
  assert.equal(ex.items.find((i) => i.team_id === 'azul' && i.category === 'argument').rule_ref, 'R1.accepted_arguments[0]');
  assert.equal(ex.items.find((i) => i.team_id === 'morado' && i.category === 'argument').reason, 'absent');
  assert.ok(!(await teams.azul.get('/api/team/state')).text.includes('rule_ref'));
});

test('agotamiento de fichas sin reembolsos y FINAL sin revelación separada', async () => {
  const { mod, teams } = g;
  for (const rid of ['R2', 'R3']) {
    await advanceTo(mod, rid, 'deliberation');
    await teams.verde.post('/api/team/response', resp(`${rid}-C1`, [`${rid}-E1`], `${rid}-A1`, rid));
    await advanceTo(mod, rid, 'objection');
    const r = await teams.azul.post('/api/team/objection', obj('verde', 'contradiction', `${rid}-E1`, rid));
    assert.equal(r.status, 201);
  }
  assert.equal((await teams.azul.get('/api/team/state')).data.tokens_remaining, 0);
  await advanceTo(mod, 'R4', 'deliberation');
  await teams.verde.post('/api/team/response', resp('R4-C1', ['R4-E1'], 'R4-A1', 'R4'));
  await advanceTo(mod, 'R4', 'objection');
  const st = (await teams.azul.get('/api/team/state')).data;
  assert.equal(st.can_object, false);
  assert.match(st.objection_block_reason, /fichas/);
  const none = await teams.azul.post('/api/team/objection', obj('verde', 'contradiction', 'R4-E1', 'R4'));
  assert.equal(none.data.error.code, 'no_tokens');
  // Barrera en la base de datos: ni siquiera una inserción directa supera las 3 fichas.
  const gameId = (await mod.get('/api/moderator/state')).data.game.id;
  assert.throws(() => srv.app.db.prepare("INSERT INTO objections (game_id, round_id, attacking_team_id, target_team_id, objection_kind, cited_evidence_id, target_snapshot, submitted_at) VALUES (?, 'R4', 'azul', 'verde', 'contradiction', 'R4-E1', '{}', 'x')").run(gameId), /token_limit/);
  assert.throws(() => srv.app.db.prepare("UPDATE responses SET claim_id = 'R1-C2' WHERE team_id = 'azul'").run(), /immutable/);
  assert.throws(() => srv.app.db.prepare("DELETE FROM score_events").run(), /immutable/);
  // FINAL: la primera fase es la deliberación y la evidencia de FINAL se revela ahí.
  await advanceTo(mod, 'R4', 'resolution');
  const next = (await mod.get('/api/moderator/state')).data.next_stage;
  assert.deepEqual([next.round_id, next.phase], ['FINAL', 'deliberation']);
  await advanceTo(mod, 'FINAL', 'deliberation');
  assert.ok((await teams.rojo.get('/api/team/state')).data.released_evidence.some((e) => e.id === 'FINAL-E1'));
});

test('avance de fase: idempotente ante doble clic y sin retroceso', async () => {
  const { mod } = g;
  const st = (await mod.get('/api/moderator/state')).data;
  const a = await mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index });
  const b = await mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index });
  assert.equal(a.status, 200);
  assert.equal(b.status, 409);
  assert.equal(b.data.error.code, 'stale_stage');
  assert.equal((await mod.get('/api/moderator/state')).data.stage_index, st.stage_index + 1);
  assert.equal((await mod.post('/api/moderator/advance', {})).status, 400);
  const gameId = st.game.id;
  assert.throws(() => srv.app.db.prepare('UPDATE games SET stage_index = 0 WHERE id = ?').run(gameId), /stage_order/);
});

test('cierre: no se puede avanzar más allá del final', async () => {
  const { mod } = g;
  const st = await advanceTo(mod, null, 'closing');
  const r = await mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index });
  assert.equal(r.data.error.code, 'game_finished');
  assert.ok((await mod.get('/api/public-state')).data.winners.length >= 1);
});
