// Ejecuta una partida completa de cinco equipos contra la API HTTP real y
// compara cada ronda con los resultados esperados del plan.
import { Client } from './http-client.js';

const ROUND_IDS = ['R1', 'R2', 'R3', 'R4', 'FINAL'];

export async function runSimulation({ baseUrl, password, plan, log = () => {} }) {
  const failures = [];
  const expect = (cond, msg) => {
    if (!cond) failures.push(msg);
    return cond;
  };
  const mod = new Client(baseUrl);
  const login = await mod.post('/api/moderator/login', { password });
  if (!expect(login.status === 200, `login de moderación: HTTP ${login.status}`)) return { failures };
  await mod.post('/api/moderator/game', {});
  let st = (await mod.get('/api/moderator/state')).data;
  const teamIds = st.teams.map((t) => t.id);
  const teams = {};
  for (const t of st.teams) {
    teams[t.id] = new Client(baseUrl);
    const r = await teams[t.id].post('/api/team/login', { code: t.code });
    expect(r.status === 200, `login del equipo ${t.id}: HTTP ${r.status}`);
  }

  async function advanceTo(roundId, phase) {
    for (let i = 0; i < 40; i++) {
      st = (await mod.get('/api/moderator/state')).data;
      if (st.round_id === roundId && st.phase === phase) return;
      const r = await mod.post('/api/moderator/advance', { expected_stage_index: st.stage_index });
      if (!expect(r.status === 200, `avanzar desde la etapa ${st.stage_index}: HTTP ${r.status} ${JSON.stringify(r.data)}`)) return;
    }
    failures.push(`no se alcanzó ${roundId}/${phase}`);
  }

  async function runChecks(roundId, checks = []) {
    for (const c of checks) {
      const path = c.kind === 'response' ? '/api/team/response' : '/api/team/objection';
      const r = await teams[c.team].post(path, { round_id: roundId, ...c.payload });
      const code = r.data?.error?.code ?? r.data?.status;
      expect(r.status === c.expect_status && code === c.expect_code,
        `${roundId} comprobación «${c.nota}» (${c.team}): se esperaba ${c.expect_status}/${c.expect_code} y se obtuvo ${r.status}/${code}`);
    }
  }

  const rounds = [];
  for (const rid of ROUND_IDS) {
    const rp = plan.rounds[rid];
    log(`— ${rid}`);
    await advanceTo(rid, 'deliberation');
    await runChecks(rid, rp.checks_before_responses);
    for (const [team, payload] of Object.entries(rp.responses)) {
      const r = await teams[team].post('/api/team/response', { round_id: rid, ...payload });
      expect(r.status === 201, `${rid} respuesta de ${team}: HTTP ${r.status} ${JSON.stringify(r.data)}`);
    }
    await runChecks(rid, rp.checks_after_responses);
    const before = (await mod.get('/api/public-state')).data;
    expect(Array.isArray(before.responses) && before.responses.length === 0, `${rid}: hay respuestas publicadas antes del bloqueo`);

    await advanceTo(rid, 'defense');
    const pub = (await mod.get('/api/public-state')).data;
    for (const t of teamIds) {
      const row = pub.responses.find((x) => x.team_id === t);
      const submitted = !!rp.responses[t];
      expect(row && row.status === (submitted ? 'submitted' : 'absent'), `${rid}: estado publicado de ${t} incorrecto`);
      if (!submitted) expect(row && row.claim_id === undefined, `${rid}: la respuesta ausente de ${t} no debe tener campos inventados`);
    }
    await runChecks(rid, rp.checks_after_lock);

    await advanceTo(rid, 'objection');
    await runChecks(rid, rp.checks_before_objections);
    for (const [team, payload] of Object.entries(rp.objections ?? {})) {
      const r = await teams[team].post('/api/team/objection', { round_id: rid, ...payload });
      expect(r.status === 201, `${rid} objeción de ${team}: HTTP ${r.status} ${JSON.stringify(r.data)}`);
    }
    await runChecks(rid, rp.checks_after_objections);
    const during = (await mod.get('/api/public-state')).data;
    expect(during.objections.length === 0, `${rid}: objeciones publicadas antes de cerrar la ventana`);

    await advanceTo(rid, 'confrontation');
    const conf = (await mod.get('/api/public-state')).data;
    expect(conf.objections.length === Object.keys(rp.objections ?? {}).length, `${rid}: número de objeciones publicadas`);
    expect(conf.objections.every((o) => o.valid === undefined), `${rid}: validez publicada antes de los resultados`);
    await runChecks(rid, rp.checks_after_objection_lock);

    await advanceTo(rid, 'resolution');
    // Recalcular es idempotente: no cambia nada.
    const again = await mod.post('/api/moderator/score', { round_id: rid });
    expect(again.status === 200 && again.data.already === true, `${rid}: recálculo idempotente`);
    const res = (await mod.get('/api/public-state')).data;
    const exp = rp.expected;
    const row = {};
    for (const t of teamIds) {
      const rr = res.round_results.find((x) => x.team_id === t);
      const sb = res.scoreboard.find((x) => x.team_id === t);
      const tokens = (await teams[t].get('/api/team/state')).data.tokens_remaining;
      row[t] = { round: rr.total, total: sb.score, tokens, public_tokens: sb.objection_tokens_remaining };
      expect(rr.total === exp.round_points[t], `${rid} puntos de ronda de ${t}: esperado ${exp.round_points[t]}, obtenido ${rr.total}`);
      expect(sb.score === exp.totals[t], `${rid} total de ${t}: esperado ${exp.totals[t]}, obtenido ${sb.score}`);
      expect(tokens === exp.tokens[t], `${rid} fichas de ${t}: esperado ${exp.tokens[t]}, obtenido ${tokens}`);
      expect(sb.objection_tokens_remaining === exp.tokens[t], `${rid} fichas públicas de ${t}: esperado ${exp.tokens[t]}, obtenido ${sb.objection_tokens_remaining}`);
    }
    for (const [t, valid] of Object.entries(exp.valid_objections ?? {})) {
      const o = res.objections.find((x) => x.attacking_team_id === t);
      expect(o && o.valid === valid, `${rid} validez de la objeción de ${t}: esperado ${valid}, obtenido ${o?.valid}`);
    }
    rounds.push({ round_id: rid, teams: row });
  }

  await advanceTo(null, 'closing');
  const fin = (await mod.get('/api/public-state')).data;
  const ef = plan.expected_final;
  for (const t of teamIds) {
    const sb = fin.scoreboard.find((x) => x.team_id === t);
    expect(sb.score === ef.scores[t], `final: puntos de ${t} esperado ${ef.scores[t]}, obtenido ${sb.score}`);
    expect(sb.objection_tokens_remaining === ef.tokens[t], `final: fichas de ${t} esperado ${ef.tokens[t]}, obtenido ${sb.objection_tokens_remaining}`);
    expect(sb.rank === ef.ranks[t], `final: puesto de ${t} esperado ${ef.ranks[t]}, obtenido ${sb.rank}`);
    expect(sb.valid_objections === ef.valid_objections[t], `final: objeciones válidas de ${t} esperado ${ef.valid_objections[t]}, obtenido ${sb.valid_objections}`);
    expect(sb.supported_arguments === ef.supported_arguments[t], `final: argumentos sustentados de ${t} esperado ${ef.supported_arguments[t]}, obtenido ${sb.supported_arguments}`);
  }
  expect(JSON.stringify([...fin.winners].sort()) === JSON.stringify([...ef.winners].sort()), `final: ganadores esperados ${ef.winners}, obtenidos ${fin.winners}`);

  // Auditoría: cada punto otorgado identifica la regla aplicada.
  const exportJson = (await mod.get('/api/moderator/export.json')).data;
  const csv = await mod.get('/api/moderator/export.csv');
  const objectionCount = ROUND_IDS.reduce((n, r) => n + Object.keys(plan.rounds[r].objections ?? {}).length, 0);
  expect(exportJson.score_events.length === ROUND_IDS.length * teamIds.length * 2 + objectionCount, `auditoría: número de eventos de puntuación (${exportJson.score_events.length})`);
  expect(exportJson.score_events.every((e) => (e.points > 0) === !!e.rule_ref), 'auditoría: todo punto otorgado debe citar su regla y ningún 0 debe citar una');
  expect(csv.status === 200 && csv.text.includes('clasificacion'), 'auditoría: CSV exportado');
  expect(exportJson.stage_log.length === st.stage_count, `auditoría: registro de las ${st.stage_count} etapas`);

  return { failures, rounds, final: fin, exportJson, csv: csv.text };
}
