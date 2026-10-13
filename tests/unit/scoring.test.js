import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreResponse, scoreObjection, computeStandings } from '../../src/engine/scoring.js';
import { evidenceSetKey } from '../../src/content/validate.js';

// Clave sintética con IDs arbitrarios: el motor no conoce ningún contenido concreto.
const arg = (ref, claim, ev) => ({ ref, claim_id: claim, evidence_ids: ev, evidence_key: evidenceSetKey(ev) });
const obj = (ref, claim, ev, action, kind, cited) => ({
  ref, target_claim_id: claim, target_evidence_ids: ev, target_evidence_key: evidenceSetKey(ev), target_action_id: action, objection_kind: kind, cited_evidence_id: cited,
});
const KEY = {
  accepted_arguments: [arg('X.a[0]', 'Q-C1', ['Q-E1']), arg('X.a[1]', 'Q-C2', ['Q-E1', 'Q-E2'])],
  accepted_actions: [{ ref: 'X.act[0]', action_id: 'Q-A1' }],
  accepted_objections: [
    obj('X.o[0]', 'Q-C3', ['Q-E1'], 'Q-A2', 'unjustified_certainty', 'Q-E2'),
    obj('X.o[1]', 'Q-C3', ['Q-E1'], 'Q-A2', 'unsafe_action', 'Q-E1'),
  ],
};

test('argumento sustentado con la evidencia correcta: +3 exactos', () => {
  const s = scoreResponse({ claim_id: 'Q-C1', evidence_ids: ['Q-E1'], action_id: 'Q-A9' }, KEY);
  assert.equal(s.argument.points, 3);
  assert.equal(s.argument.rule_ref, 'X.a[0]');
});

test('misma afirmación con evidencia incorrecta: +0', () => {
  const s = scoreResponse({ claim_id: 'Q-C1', evidence_ids: ['Q-E2'], action_id: 'Q-A1' }, KEY);
  assert.equal(s.argument.points, 0);
  assert.equal(s.argument.reason, 'evidence_mismatch');
  assert.equal(s.argument.rule_ref, null);
});

test('evidencia de más (superconjunto) no puntúa: la igualdad de conjuntos es exacta', () => {
  const s = scoreResponse({ claim_id: 'Q-C1', evidence_ids: ['Q-E1', 'Q-E2'], action_id: 'Q-A1' }, KEY);
  assert.equal(s.argument.points, 0);
});

test('el orden de las evidencias no importa', () => {
  const s = scoreResponse({ claim_id: 'Q-C2', evidence_ids: ['Q-E2', 'Q-E1'], action_id: 'Q-A1' }, KEY);
  assert.equal(s.argument.points, 3);
  assert.equal(s.argument.rule_ref, 'X.a[1]');
});

test('acción correcta: +2; acción incorrecta: +0', () => {
  assert.equal(scoreResponse({ claim_id: 'Q-C9', evidence_ids: ['Q-E1'], action_id: 'Q-A1' }, KEY).action.points, 2);
  assert.equal(scoreResponse({ claim_id: 'Q-C9', evidence_ids: ['Q-E1'], action_id: 'Q-A2' }, KEY).action.points, 0);
});

test('respuesta ausente: 0 en argumento y acción', () => {
  const s = scoreResponse(null, KEY);
  assert.deepEqual([s.argument.points, s.action.points, s.argument.reason], [0, 0, 'absent']);
});

test('objeción válida solo si TODOS los campos target_* coinciden con la instantánea', () => {
  const snap = { claim_id: 'Q-C3', evidence_ids: ['Q-E1'], action_id: 'Q-A2' };
  const o = { objection_kind: 'unjustified_certainty', cited_evidence_id: 'Q-E2' };
  assert.equal(scoreObjection(o, snap, KEY).points, 3);
  assert.equal(scoreObjection(o, { ...snap, claim_id: 'Q-C1' }, KEY).points, 0);
  assert.equal(scoreObjection(o, { ...snap, evidence_ids: ['Q-E1', 'Q-E2'] }, KEY).points, 0);
  assert.equal(scoreObjection(o, { ...snap, action_id: 'Q-A1' }, KEY).points, 0);
});

test('objeción con categoría o evidencia citada distinta: 0', () => {
  const snap = { claim_id: 'Q-C3', evidence_ids: ['Q-E1'], action_id: 'Q-A2' };
  const r1 = scoreObjection({ objection_kind: 'contradiction', cited_evidence_id: 'Q-E2' }, snap, KEY);
  const r2 = scoreObjection({ objection_kind: 'unjustified_certainty', cited_evidence_id: 'Q-E1' }, snap, KEY);
  assert.equal(r1.points, 0);
  assert.equal(r1.reason, 'kind_or_evidence_mismatch');
  assert.equal(r2.points, 0);
});

test('dos objeciones válidas distintas contra la misma respuesta puntúan de forma independiente', () => {
  const snap = { claim_id: 'Q-C3', evidence_ids: ['Q-E1'], action_id: 'Q-A2' };
  const a = scoreObjection({ objection_kind: 'unjustified_certainty', cited_evidence_id: 'Q-E2' }, snap, KEY);
  const b = scoreObjection({ objection_kind: 'unsafe_action', cited_evidence_id: 'Q-E1' }, snap, KEY);
  assert.deepEqual([a.points, a.rule_ref, b.points, b.rule_ref], [3, 'X.o[0]', 3, 'X.o[1]']);
});

test('objeción contra un equipo sin respuesta: 0', () => {
  assert.equal(scoreObjection({ objection_kind: 'contradiction', cited_evidence_id: 'Q-E1' }, null, KEY).reason, 'target_absent');
});

const TEAMS = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() }));
const ev = (team_id, category, points) => ({ team_id, category, points });

test('desempate 1: más objeciones válidas', () => {
  const { rows, winners } = computeStandings(TEAMS, [
    ev('a', 'argument', 3), ev('a', 'action', 2), ev('a', 'argument', 3),
    ev('b', 'objection', 3), ev('b', 'action', 2), ev('b', 'argument', 3),
  ]);
  assert.equal(rows[0].team_id, 'b');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].team_id, 'a');
  assert.equal(rows[1].rank, 2);
  assert.deepEqual(winners, ['b']);
});

test('desempate 2: más argumentos bien sustentados', () => {
  const { rows } = computeStandings(TEAMS, [
    ev('a', 'action', 2), ev('a', 'action', 2), ev('a', 'action', 2), // 6 sin argumentos
    ev('b', 'argument', 3), ev('b', 'argument', 3), // 6 con 2 argumentos
  ]);
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.team_id, r.rank]), [['b', 1], ['a', 2]]);
});

test('empate total: victoria conjunta y puesto de competición (1, 1, 3)', () => {
  const { rows, winners } = computeStandings(TEAMS, [
    ev('c', 'argument', 3), ev('d', 'argument', 3), ev('a', 'action', 2),
  ]);
  assert.deepEqual(winners, ['c', 'd']);
  assert.deepEqual(rows.map((r) => [r.team_id, r.rank]), [['c', 1], ['d', 1], ['a', 3], ['b', 4], ['e', 4]]);
});

test('la clasificación es reproducible (mismo resultado con eventos en otro orden)', () => {
  const events = [ev('a', 'argument', 3), ev('b', 'objection', 3), ev('c', 'action', 2), ev('b', 'action', 2), ev('a', 'objection', 0)];
  const r1 = computeStandings(TEAMS, events);
  const r2 = computeStandings(TEAMS, [...events].reverse());
  assert.deepEqual(r1, r2);
});
