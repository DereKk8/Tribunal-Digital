// Máquina de estados lineal de la sesión: tutorial → R1…R4 → FINAL → cierre.
// Solo avanza por acción autorizada de moderación; los temporizadores son pistas.
import {
  ROUND_IDS, FINAL_ROUND_ID, ROUND_PHASES, FINAL_ROUND_PHASES,
  PHASE_DURATIONS, FINAL_PHASE_DURATIONS, PHASE_LABELS,
} from '../constants.js';

/** Construye la secuencia de etapas a partir de los IDs de ronda del contrato. */
export function buildStages(roundIds = ROUND_IDS) {
  const stages = [{ phase: 'tutorial', round_id: null, duration_seconds: PHASE_DURATIONS.tutorial }];
  roundIds.forEach((rid, roundIndex) => {
    const isFinal = rid === FINAL_ROUND_ID;
    const phases = isFinal ? FINAL_ROUND_PHASES : ROUND_PHASES;
    for (const phase of phases) {
      stages.push({
        phase,
        round_id: rid,
        round_index: roundIndex,
        duration_seconds: (isFinal ? FINAL_PHASE_DURATIONS : PHASE_DURATIONS)[phase],
      });
    }
  });
  stages.push({ phase: 'closing', round_id: null, duration_seconds: PHASE_DURATIONS.closing });
  return Object.freeze(stages.map((s, index) => Object.freeze({ ...s, index, phase_label: PHASE_LABELS[s.phase], round_index: s.round_index ?? null })));
}

export class StagePlan {
  constructor(roundIds = ROUND_IDS) {
    this.roundIds = [...roundIds];
    this.stages = buildStages(roundIds);
    this.byRound = new Map();
    for (const s of this.stages) {
      if (!s.round_id) continue;
      if (!this.byRound.has(s.round_id)) this.byRound.set(s.round_id, {});
      this.byRound.get(s.round_id)[s.phase] = s.index;
    }
  }

  get count() { return this.stages.length; }
  get lastIndex() { return this.stages.length - 1; }
  stage(index) { return this.stages[index] ?? null; }

  /**
   * Índice de la última ronda cuyo contenido (evidencias, afirmaciones,
   * acciones) ya está revelado; -1 en el tutorial.
   */
  releasedRoundIndex(stageIndex) {
    const s = this.stage(stageIndex);
    if (!s || s.phase === 'tutorial') return -1;
    if (s.phase === 'closing') return this.roundIds.length - 1;
    return s.round_index;
  }

  phaseIndex(roundId, phase) { return this.byRound.get(roundId)?.[phase] ?? null; }

  /** Las respuestas de la ronda se publican al cerrar la deliberación. */
  responsesLocked(stageIndex, roundId) {
    const d = this.phaseIndex(roundId, 'deliberation');
    return d !== null && stageIndex > d;
  }

  /** Las objeciones se publican al cerrar su ventana. */
  objectionsLocked(stageIndex, roundId) {
    const o = this.phaseIndex(roundId, 'objection');
    return o !== null && stageIndex > o;
  }

  /** Los resultados se publican al entrar en la fase de resultados. */
  resultsPublished(stageIndex, roundId) {
    const r = this.phaseIndex(roundId, 'resolution');
    return r !== null && stageIndex >= r;
  }

  totalSeconds() { return this.stages.reduce((a, s) => a + s.duration_seconds, 0); }
}
