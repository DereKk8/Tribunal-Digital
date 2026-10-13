import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startApp, readJson, PASSWORD, ROOT } from '../helpers.js';
import { runSimulation } from '../../scripts/lib/simulation.js';

test('ensayo completo determinista de cinco equipos: puntuación, fichas, puestos y auditoría exactos', async () => {
  const srv = await startApp();
  try {
    const plan = readJson(path.join(ROOT, 'fixtures', 'demo', 'simulation.json'));
    const res = await runSimulation({ baseUrl: srv.base, password: PASSWORD, plan });
    assert.deepEqual(res.failures, []);
    // Resultado final documentado en fixtures/demo/SIMULACION.md
    const sb = Object.fromEntries(res.final.scoreboard.map((r) => [r.team_id, [r.score, r.objection_tokens_remaining, r.rank]]));
    assert.deepEqual(sb, { azul: [34, 0, 1], rojo: [34, 0, 1], verde: [13, 0, 3], amarillo: [13, 1, 4], morado: [12, 0, 5] });
    assert.deepEqual(res.final.winners, ['azul', 'rojo']);
    // Registro auditable: fases, respuestas, objeciones con instantánea, reglas aplicadas e intentos rechazados.
    const ex = res.exportJson;
    assert.equal(ex.content_mode, 'demo');
    assert.equal(ex.demo_notice, 'DEMO — DATOS FICTICIOS DE PRUEBA');
    assert.equal(ex.stage_log.length, 31);
    assert.equal(ex.responses.length, 24);
    assert.equal(ex.objections.length, 14);
    assert.ok(ex.objections.every((o) => o.target_snapshot && o.target_snapshot.claim_id));
    const ruleRefs = ex.score_events.filter((e) => e.points > 0).map((e) => e.rule_ref);
    assert.ok(ruleRefs.every((r) => /^(R1|R2|R3|R4|FINAL)\.accepted_(arguments|actions|objections)\[\d+\]$/.test(r)));
    const rejected = ex.audit_log.filter((a) => a.event.endsWith('_rejected')).map((a) => a.detail.code);
    for (const code of ['bad_evidence', 'team_mismatch', 'already_submitted', 'self_objection', 'target_absent', 'already_objected', 'no_tokens', 'phase_closed']) {
      assert.ok(rejected.includes(code), `falta el rechazo auditado «${code}»`);
    }
    assert.ok(res.csv.startsWith('﻿'));
    assert.match(res.csv, /puntuacion,R1,azul,Argumento,3,R1\.accepted_arguments\[0\]/);
    assert.match(res.csv, /clasificacion,,azul,puesto 1,34/);
  } finally {
    await srv.close();
  }
});
