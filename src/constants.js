// Constantes del contrato compartido schema_version "1.0".
// Son reglas del juego y del contrato, NO contenido del caso: el motor nunca
// conoce IDs de afirmaciones, evidencias o acciones concretas.

export const SCHEMA_VERSION = '1.0';
export const GAME_ID = 'tribunal-digital';
export const API_VERSION = '1.0';

export const TEAM_IDS = Object.freeze(['azul', 'rojo', 'verde', 'amarillo', 'morado']);
export const ROUND_IDS = Object.freeze(['R1', 'R2', 'R3', 'R4', 'FINAL']);
/** Ronda sin segmento de revelación cronometrado. */
export const FINAL_ROUND_ID = 'FINAL';

export const OBJECTION_KINDS = Object.freeze([
  'contradiction',
  'logical_leap',
  'unjustified_certainty',
  'unsafe_action',
]);

export const OBJECTION_KIND_LABELS = Object.freeze({
  contradiction: 'Contradicción',
  logical_leap: 'Salto lógico',
  unjustified_certainty: 'Certeza injustificada',
  unsafe_action: 'Acción insegura',
});

export const OBJECTION_KIND_HELP = Object.freeze({
  contradiction: 'Dicen algo que una evidencia contradice.',
  logical_leap: 'Las evidencias que eligieron no alcanzan para decir eso.',
  unjustified_certainty: 'Dan por seguro algo que las evidencias no demuestran.',
  unsafe_action: 'Lo que proponen pone a alguien en riesgo.',
});

/** Enum estable de fases (API pública). */
export const PHASES = Object.freeze([
  'tutorial',
  'reveal',
  'deliberation',
  'defense',
  'objection',
  'confrontation',
  'resolution',
  'closing',
]);

export const PHASE_LABELS = Object.freeze({
  tutorial: 'Tutorial',
  reveal: 'Revelación de evidencia',
  deliberation: 'Decisión del equipo',
  defense: 'Argumentos públicos',
  objection: 'Objeciones',
  confrontation: 'Confrontación oral',
  resolution: 'Resultados',
  closing: 'Cierre',
});

/** Fases de cada ronda en orden. FINAL omite la revelación cronometrada. */
export const ROUND_PHASES = Object.freeze(['reveal', 'deliberation', 'defense', 'objection', 'confrontation', 'resolution']);
export const FINAL_ROUND_PHASES = Object.freeze(['deliberation', 'defense', 'objection', 'confrontation', 'resolution']);

/** Duraciones orientativas en segundos (los temporizadores son solo una pista). */
export const PHASE_DURATIONS = Object.freeze({
  tutorial: 7 * 60,
  reveal: 60,
  deliberation: 120,
  defense: 150,
  objection: 45,
  confrontation: 180,
  resolution: 45,
  closing: 5 * 60,
});
export const FINAL_PHASE_DURATIONS = Object.freeze({
  deliberation: 90,
  defense: 120,
  objection: 45,
  confrontation: 180,
  resolution: 45,
});

export const POINTS = Object.freeze({ argument: 3, action: 2, objection: 3 });
export const TOKENS_PER_TEAM = 3;
export const MIN_EVIDENCE_PER_RESPONSE = 1;
export const MAX_EVIDENCE_PER_RESPONSE = 2;

/** Formato seguro de identificadores (evita ambigüedad en HTML, CSV y URLs). */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/**
 * Campos que solo pueden existir en la clave privada. (`objection_kind` y
 * `cited_evidence_id` también forman parte de la objeción pública, por eso no
 * figuran aquí.)
 */
export const PRIVATE_FIELD_NAMES = Object.freeze([
  'accepted_arguments',
  'accepted_actions',
  'accepted_objections',
  'target_claim_id',
  'target_evidence_ids',
  'target_action_id',
]);

export const DEMO_NOTICE = 'DEMO — DATOS FICTICIOS DE PRUEBA';
