// Motor de puntuación puro y determinista. Solo consume IDs importados y las
// reglas de la clave: no conoce ningún contenido concreto del caso.
import { POINTS } from '../constants.js';
import { evidenceSetKey } from '../content/validate.js';

/**
 * @param {{claim_id:string, evidence_ids:string[], action_id:string}|null} response
 * @param {object} roundKey  clave normalizada de la ronda (ver content/load.js)
 */
export function scoreResponse(response, roundKey) {
  if (!response) {
    return {
      argument: { points: 0, rule_ref: null, reason: 'absent' },
      action: { points: 0, rule_ref: null, reason: 'absent' },
    };
  }
  const evKey = evidenceSetKey(response.evidence_ids);
  const arg = roundKey.accepted_arguments.find((a) => a.claim_id === response.claim_id && a.evidence_key === evKey);
  let argReason = 'no_match';
  if (arg) argReason = 'match';
  else if (roundKey.accepted_arguments.some((a) => a.claim_id === response.claim_id)) argReason = 'evidence_mismatch';
  const act = roundKey.accepted_actions.find((a) => a.action_id === response.action_id);
  return {
    argument: { points: arg ? POINTS.argument : 0, rule_ref: arg ? arg.ref : null, reason: argReason },
    action: { points: act ? POINTS.action : 0, rule_ref: act ? act.ref : null, reason: act ? 'match' : 'no_match' },
  };
}

/**
 * Una objeción es válida solo si TODOS los campos target_* coinciden con la
 * instantánea inmutable de la respuesta real del equipo atacado y, además,
 * coinciden categoría y evidencia citada.
 */
export function scoreObjection(objection, targetSnapshot, roundKey) {
  if (!targetSnapshot) return { points: 0, rule_ref: null, reason: 'target_absent' };
  const tKey = evidenceSetKey(targetSnapshot.evidence_ids);
  const targetRules = roundKey.accepted_objections.filter((r) =>
    r.target_claim_id === targetSnapshot.claim_id &&
    r.target_evidence_key === tKey &&
    r.target_action_id === targetSnapshot.action_id);
  const rule = targetRules.find((r) => r.objection_kind === objection.objection_kind && r.cited_evidence_id === objection.cited_evidence_id);
  if (rule) return { points: POINTS.objection, rule_ref: rule.ref, reason: 'match' };
  return { points: 0, rule_ref: null, reason: targetRules.length ? 'kind_or_evidence_mismatch' : 'target_not_objectionable' };
}

export const REASON_LABELS = Object.freeze({
  absent: 'Sin respuesta enviada en la ventana',
  match: 'Coincide con una regla de la clave',
  no_match: 'No coincide con ninguna regla de la clave',
  evidence_mismatch: 'La afirmación es aceptable, pero no con ese conjunto de evidencias',
  target_absent: 'El equipo objetado no tenía respuesta bloqueada',
  kind_or_evidence_mismatch: 'La respuesta objetada era objetable, pero no con esa categoría o evidencia citada',
  target_not_objectionable: 'La respuesta objetada no figura como objetable en la clave',
});

/**
 * Clasificación: puntos; desempate 1) más objeciones válidas, 2) más argumentos
 * bien sustentados; si persiste, empate (victoria conjunta). Puesto de
 * competición (1, 1, 3…). El orden de visualización dentro de un empate sigue
 * el orden de equipos de public.json y no implica ventaja.
 * @param {{id:string,name:string}[]} teams
 * @param {{team_id:string, category:string, points:number}[]} events
 */
export function computeStandings(teams, events) {
  const rows = teams.map((t, order) => ({
    team_id: t.id, team_name: t.name, order, score: 0, valid_objections: 0, supported_arguments: 0,
  }));
  const byId = new Map(rows.map((r) => [r.team_id, r]));
  for (const e of events) {
    const r = byId.get(e.team_id);
    if (!r) continue;
    r.score += e.points;
    if (e.category === 'objection' && e.points > 0) r.valid_objections += 1;
    if (e.category === 'argument' && e.points > 0) r.supported_arguments += 1;
  }
  const cmp = (a, b) => (b.score - a.score) || (b.valid_objections - a.valid_objections) || (b.supported_arguments - a.supported_arguments);
  for (const r of rows) r.rank = 1 + rows.filter((o) => cmp(o, r) < 0).length;
  rows.sort((a, b) => cmp(a, b) || a.order - b.order);
  const winners = rows.filter((r) => r.rank === 1).map((r) => r.team_id);
  return { rows: rows.map(({ order, ...r }) => r), winners };
}
