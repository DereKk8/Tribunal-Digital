import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StagePlan } from '../../src/engine/stages.js';
import { PHASES } from '../../src/constants.js';

const plan = new StagePlan();

test('guion completo: tutorial, R1–R4 (6 fases), FINAL (5 fases, sin revelación), cierre', () => {
  assert.equal(plan.count, 1 + 4 * 6 + 5 + 1);
  assert.equal(plan.stage(0).phase, 'tutorial');
  assert.equal(plan.stage(plan.lastIndex).phase, 'closing');
  assert.deepEqual(plan.stages.filter((s) => s.round_id === 'R1').map((s) => s.phase),
    ['reveal', 'deliberation', 'defense', 'objection', 'confrontation', 'resolution']);
  assert.deepEqual(plan.stages.filter((s) => s.round_id === 'FINAL').map((s) => s.phase),
    ['deliberation', 'defense', 'objection', 'confrontation', 'resolution']);
  for (const s of plan.stages) assert.ok(PHASES.includes(s.phase));
});

test('el guion dura exactamente 60 minutos (7 + 4×10 + 8 + 5)', () => {
  assert.equal(plan.totalSeconds(), 60 * 60);
  const r1 = plan.stages.filter((s) => s.round_id === 'R1').reduce((a, s) => a + s.duration_seconds, 0);
  const fin = plan.stages.filter((s) => s.round_id === 'FINAL').reduce((a, s) => a + s.duration_seconds, 0);
  assert.equal(r1, 600);
  assert.equal(fin, 480);
});

test('revelado progresivo: nada en el tutorial, todo en el cierre', () => {
  assert.equal(plan.releasedRoundIndex(0), -1);
  assert.equal(plan.releasedRoundIndex(plan.phaseIndex('R1', 'reveal')), 0);
  assert.equal(plan.releasedRoundIndex(plan.phaseIndex('FINAL', 'deliberation')), 4);
  assert.equal(plan.releasedRoundIndex(plan.lastIndex), 4);
});

test('bloqueos: respuestas tras la deliberación, objeciones tras su ventana, resultados en «resolution»', () => {
  const d = plan.phaseIndex('R2', 'deliberation');
  assert.equal(plan.responsesLocked(d, 'R2'), false);
  assert.equal(plan.responsesLocked(d + 1, 'R2'), true);
  const o = plan.phaseIndex('R2', 'objection');
  assert.equal(plan.objectionsLocked(o, 'R2'), false);
  assert.equal(plan.objectionsLocked(o + 1, 'R2'), true);
  const r = plan.phaseIndex('R2', 'resolution');
  assert.equal(plan.resultsPublished(r - 1, 'R2'), false);
  assert.equal(plan.resultsPublished(r, 'R2'), true);
});
