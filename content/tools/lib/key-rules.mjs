// Expansión determinista de las reglas compactas (privadas) a la clave exhaustiva.
// Este módulo es PÚBLICO: solo contiene la lógica, nunca los datos de las respuestas.
//
// Política de objeciones (la misma que se proyecta en la diapositiva de reglas):
//   · «contradiction»: la afirmación contiene un dato FALSO según una evidencia
//       → válida solo si la regla es `false`, citando una evidencia de `refuting`.
//   · «unjustified_certainty»: la afirmación da por seguro (identidad, intención,
//       culpa o inocencia, «imposible», «demostrado») algo que la evidencia no establece
//       → válida si `overcertain` es true, citando una evidencia de `refuting`,
//         de `exposing` o una de las que citó el equipo atacado.
//   · «logical_leap»: la afirmación NO es falsa, pero las evidencias citadas no alcanzan
//       → reglas `unsupported`: citando una evidencia propia del atacado o de `exposing`;
//       → reglas `sound` con un conjunto no aceptado: citando una evidencia propia del
//         atacado o la que falta (presente en algún conjunto aceptado y ausente del suyo).
//   · «unsafe_action»: la acción es `unsafe` → citando una evidencia de `risk`.
//   Si varias categorías aplican, todas son válidas. Cualquier otra combinación vale 0.

export const OBJECTION_KINDS = ['contradiction', 'logical_leap', 'unjustified_certainty', 'unsafe_action'];

export const sortIds = (ids) => [...ids].sort();
export const setKey = (ids) => sortIds(ids).join('+');

/** Todos los conjuntos de 1 o 2 evidencias distintas tomados de `available`. */
export function evidenceSets(available) {
  const sorted = sortIds(available);
  const sets = sorted.map((e) => [e]);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) sets.push([sorted[i], sorted[j]]);
  }
  return sets;
}

/** Objeciones válidas contra una afirmación concreta sostenida con `targetSet`. */
export function claimObjections(rule, targetSet, available) {
  const avail = new Set(available);
  const inAvail = (ids = []) => ids.filter((e) => avail.has(e));
  const out = [];
  if (rule.status === 'false') {
    for (const e of sortIds(inAvail(rule.refuting))) out.push(['contradiction', e]);
    if (rule.overcertain) {
      const cites = sortIds(new Set([...targetSet, ...inAvail(rule.refuting), ...inAvail(rule.exposing)]));
      for (const e of cites) out.push(['unjustified_certainty', e]);
    }
  } else if (rule.status === 'unsupported') {
    const cites = sortIds(new Set([...targetSet, ...inAvail(rule.exposing)]));
    for (const e of cites) out.push(['logical_leap', e]);
    if (rule.overcertain) for (const e of cites) out.push(['unjustified_certainty', e]);
  } else if (rule.status === 'sound') {
    const accepted = new Set(rule.accepted_sets.map(setKey));
    if (!accepted.has(setKey(targetSet))) {
      const own = new Set(targetSet);
      const missing = rule.accepted_sets.flat().filter((e) => !own.has(e));
      for (const e of sortIds(new Set([...targetSet, ...inAvail(missing)]))) out.push(['logical_leap', e]);
    }
  } else {
    throw new Error(`Estado de afirmación desconocido: ${rule.status}`);
  }
  return out;
}

/** Objeciones válidas contra una acción. */
export function actionObjections(rule, available) {
  if (rule.status === 'accepted') return [];
  if (rule.status !== 'unsafe') throw new Error(`Estado de acción desconocido: ${rule.status}`);
  const avail = new Set(available);
  return rule.risk.filter((e) => avail.has(e)).map((e) => ['unsafe_action', e]);
}

/**
 * Expande una ronda. `available` = evidencias publicadas hasta esa ronda (inclusive).
 * Devuelve { accepted_arguments, accepted_actions, accepted_objections }.
 */
export function expandRound(roundRules, available) {
  const accepted_arguments = [];
  for (const [claim_id, rule] of Object.entries(roundRules.claims)) {
    if (rule.status === 'sound') {
      for (const set of rule.accepted_sets) accepted_arguments.push({ claim_id, evidence_ids: sortIds(set) });
    }
  }
  const accepted_actions = Object.entries(roundRules.actions)
    .filter(([, r]) => r.status === 'accepted')
    .map(([id]) => id);

  const accepted_objections = [];
  const sets = evidenceSets(available);
  for (const [claim_id, crule] of Object.entries(roundRules.claims)) {
    for (const set of sets) {
      const cObj = claimObjections(crule, set, available);
      for (const [action_id, arule] of Object.entries(roundRules.actions)) {
        const aObj = actionObjections(arule, available);
        for (const [objection_kind, cited_evidence_id] of [...cObj, ...aObj]) {
          accepted_objections.push({
            target_claim_id: claim_id,
            target_evidence_ids: set,
            target_action_id: action_id,
            objection_kind,
            cited_evidence_id,
          });
        }
      }
    }
  }
  return { accepted_arguments, accepted_actions, accepted_objections };
}
