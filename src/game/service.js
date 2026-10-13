// Servicio del juego: sesiones, fases, respuestas, objeciones, puntuación y auditoría.
// Toda mutación ocurre en una única transacción SQLite síncrona y verifica la
// fase DENTRO de la transacción, de modo que no hay carreras con el avance de fase.
import { randomBytes, randomUUID, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { transaction } from '../store/db.js';
import { StagePlan } from '../engine/stages.js';
import { scoreResponse, scoreObjection, computeStandings, REASON_LABELS } from '../engine/scoring.js';
import { evidenceSetKey } from '../content/validate.js';
import {
  TOKENS_PER_TEAM, OBJECTION_KINDS, OBJECTION_KIND_LABELS, OBJECTION_KIND_HELP, MIN_EVIDENCE_PER_RESPONSE,
  MAX_EVIDENCE_PER_RESPONSE, API_VERSION, DEMO_NOTICE, POINTS,
} from '../constants.js';

export class GameError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'GameError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export class StartupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StartupError';
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const PRESENCE_WINDOW_MS = 15000;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export function normalizeCode(code) {
  return typeof code === 'string' ? code.toUpperCase().replace(/[\s-]/g, '') : '';
}

function pickOnly(payload, allowed) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new GameError(400, 'bad_request', 'La solicitud debe ser un objeto JSON.');
  }
  const extra = Object.keys(payload).filter((k) => !allowed.includes(k));
  if (extra.length) {
    throw new GameError(400, 'field_not_allowed', `Campo no permitido en la solicitud: ${extra.join(', ')}. El servidor calcula puntos, fichas y fases.`);
  }
  return payload;
}

const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;

export class GameService {
  /**
   * @param {object} o
   * @param {import('node:sqlite').DatabaseSync} o.db
   * @param {object} o.content  modelo devuelto por loadContent
   * @param {string} o.moderatorPassword
   * @param {() => Date} [o.clock]
   * @param {number} [o.sessionHours]
   */
  constructor({ db, content, moderatorPassword, clock = () => new Date(), sessionHours = 12 }) {
    this.db = db;
    this.content = content;
    this.plan = new StagePlan(content.rounds.map((r) => r.id));
    this.clock = clock;
    this.sessionMs = sessionHours * 3600 * 1000;
    this.moderatorHash = Buffer.from(sha256(moderatorPassword), 'hex');
    this.presence = new Map();
  }

  now() { return this.clock(); }
  nowIso() { return this.now().toISOString(); }

  // ---------------------------------------------------------------- auditoría
  audit(gameId, actor, event, detail = {}) {
    this.db.prepare('INSERT INTO audit_log (game_id, at, actor, event, detail) VALUES (?, ?, ?, ?, ?)')
      .run(gameId ?? null, this.nowIso(), actor, event, JSON.stringify(detail));
  }

  // ---------------------------------------------------------------- partida
  activeGame() {
    return this.db.prepare('SELECT * FROM games WHERE active = 1').get() ?? null;
  }

  requireGame() {
    const g = this.activeGame();
    if (!g) throw new GameError(409, 'no_game', 'No hay una partida activa. La moderación debe crearla.');
    return g;
  }

  /** Comprobación de arranque: la partida activa debe usar exactamente este contenido. */
  assertContentMatchesActiveGame() {
    const g = this.activeGame();
    if (!g) return;
    if (g.content_mode !== this.content.mode || g.content_fingerprint !== this.content.fingerprint) {
      throw new StartupError(
        'La partida activa se creó con otro contenido ' +
        `(modo ${g.content_mode}, huella ${g.content_fingerprint.slice(0, 12)}…) y el contenido cargado ahora es distinto ` +
        `(modo ${this.content.mode}, huella ${this.content.fingerprint.slice(0, 12)}…). ` +
        'Para proteger la puntuación no se mezcla contenido. Restaure los archivos originales o archive la partida con ' +
        '`npm run archivar-partida -- --modo=' + this.content.mode + ' --confirmar` (no borra datos).',
      );
    }
  }

  _insertGame(actor) {
    const id = randomUUID();
    const at = this.nowIso();
    this.db.prepare('INSERT INTO games (id, created_at, content_mode, content_fingerprint, stage_index, stage_started_at, active) VALUES (?, ?, ?, ?, 0, ?, 1)')
      .run(id, at, this.content.mode, this.content.fingerprint, at);
    const used = new Set();
    for (const t of this.content.teams) {
      let code;
      do {
        code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      } while (used.has(code));
      used.add(code);
      this.db.prepare('INSERT INTO team_codes (game_id, team_id, code) VALUES (?, ?, ?)').run(id, t.id, code);
    }
    const s0 = this.plan.stage(0);
    this.db.prepare('INSERT INTO stage_log (game_id, stage_index, phase, round_id, entered_at, actor) VALUES (?, 0, ?, ?, ?, ?)')
      .run(id, s0.phase, s0.round_id, at, actor);
    this.audit(id, actor, 'game_created', { content_mode: this.content.mode, content_fingerprint: this.content.fingerprint });
    return id;
  }

  /** Crea la partida si no existe; si ya existe la devuelve (idempotente). */
  createGame(actor) {
    return transaction(this.db, () => {
      const g = this.activeGame();
      if (g) return { created: false, game_id: g.id };
      return { created: true, game_id: this._insertGame(actor) };
    });
  }

  /** Archiva la partida activa (sin borrar nada) y crea una nueva con códigos nuevos. */
  resetGame(actor, confirm) {
    if (confirm !== 'REINICIAR') {
      throw new GameError(400, 'confirm_required', 'Para reiniciar escriba exactamente REINICIAR. Esta acción archiva la partida actual y genera códigos nuevos.');
    }
    return transaction(this.db, () => {
      const g = this.activeGame();
      if (g) {
        this.db.prepare('UPDATE games SET active = 0, archived_at = ? WHERE id = ?').run(this.nowIso(), g.id);
        this.audit(g.id, actor, 'game_archived', { reason: 'reset' });
      }
      return { archived_game_id: g?.id ?? null, game_id: this._insertGame(actor) };
    });
  }

  // ---------------------------------------------------------------- sesiones
  _createSession(role, gameId, teamId) {
    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    this.db.prepare('INSERT INTO sessions (token_hash, role, game_id, team_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sha256(token), role, gameId, teamId, now.toISOString(), new Date(now.getTime() + this.sessionMs).toISOString());
    return token;
  }

  teamLogin(code) {
    const g = this.requireGame();
    const norm = normalizeCode(code);
    if (norm.length !== CODE_LENGTH) throw new GameError(401, 'bad_code', 'Código de equipo incorrecto.');
    const row = this.db.prepare('SELECT team_id FROM team_codes WHERE game_id = ? AND code = ?').get(g.id, norm);
    if (!row) throw new GameError(401, 'bad_code', 'Código de equipo incorrecto.');
    const token = this._createSession('team', g.id, row.team_id);
    this.audit(g.id, `equipo:${row.team_id}`, 'team_login', {});
    return { token, team: this.content.teamById.get(row.team_id) };
  }

  moderatorLogin(password) {
    const given = Buffer.from(sha256(typeof password === 'string' ? password : ''), 'hex');
    if (!timingSafeEqual(given, this.moderatorHash)) throw new GameError(401, 'bad_password', 'Contraseña de moderación incorrecta.');
    const token = this._createSession('moderator', null, null);
    this.audit(this.activeGame()?.id, 'moderacion', 'moderator_login', {});
    return { token };
  }

  /** Devuelve la sesión válida o null. El rol SIEMPRE viene de la base de datos. */
  resolveSession(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const row = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
    if (!row) return null;
    if (row.expires_at <= this.nowIso()) return null;
    if (row.role === 'team') {
      const g = this.activeGame();
      if (!g || g.id !== row.game_id) return null;
      this.presence.set(`${g.id}:${row.team_id}`, this.now().getTime());
      return { role: 'team', team_id: row.team_id, game_id: row.game_id, actor: `equipo:${row.team_id}` };
    }
    return { role: 'moderator', actor: `moderacion:${row.token_hash.slice(0, 8)}` };
  }

  logout(token) {
    if (typeof token === 'string') this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  }

  // ---------------------------------------------------------------- fases
  advance(expectedStageIndex, actor) {
    if (!Number.isInteger(expectedStageIndex)) {
      throw new GameError(400, 'bad_request', 'Falta «expected_stage_index» (la fase que usted ve en pantalla).');
    }
    return transaction(this.db, () => {
      const g = this.requireGame();
      if (g.stage_index !== expectedStageIndex) {
        throw new GameError(409, 'stale_stage', 'La fase ya había cambiado (doble clic u otra pantalla de moderación). No se avanzó de nuevo.', { stage_index: g.stage_index });
      }
      if (g.stage_index >= this.plan.lastIndex) throw new GameError(409, 'game_finished', 'La partida ya está en el cierre.');
      const next = this.plan.stage(g.stage_index + 1);
      const at = this.nowIso();
      if (next.phase === 'resolution') this._scoreRoundTx(g, next.round_id);
      this.db.prepare('UPDATE games SET stage_index = ?, stage_started_at = ? WHERE id = ?').run(next.index, at, g.id);
      this.db.prepare('INSERT INTO stage_log (game_id, stage_index, phase, round_id, entered_at, actor) VALUES (?, ?, ?, ?, ?, ?)')
        .run(g.id, next.index, next.phase, next.round_id, at, actor);
      this.audit(g.id, actor, 'stage_advanced', { stage_index: next.index, phase: next.phase, round_id: next.round_id });
      return { stage_index: next.index, phase: next.phase, round_id: next.round_id };
    });
  }

  currentStage(g) { return this.plan.stage(g.stage_index); }

  // ---------------------------------------------------------------- contenido revelado
  releasedEvidence(stageIndex) {
    const ri = this.plan.releasedRoundIndex(stageIndex);
    return [...this.content.evidenceById.values()].filter((e) => e.roundIndex <= ri);
  }

  isEvidenceReleased(evidenceId, stageIndex) {
    const e = this.content.evidenceById.get(evidenceId);
    return !!e && e.roundIndex <= this.plan.releasedRoundIndex(stageIndex);
  }

  // ---------------------------------------------------------------- respuestas
  submitResponse(session, payload) {
    try {
      return this._submitResponse(session, payload);
    } catch (e) {
      if (e instanceof GameError) this.audit(session.game_id, session.actor, 'response_rejected', { code: e.code });
      throw e;
    }
  }

  _submitResponse(session, payload) {
    pickOnly(payload, ['round_id', 'team_id', 'claim_id', 'evidence_ids', 'action_id']);
    if (payload.team_id !== undefined && payload.team_id !== session.team_id) {
      throw new GameError(403, 'team_mismatch', 'No puede enviar respuestas en nombre de otro equipo.');
    }
    const { round_id: roundId, claim_id: claimId, action_id: actionId } = payload;
    const ev = payload.evidence_ids;
    if (!isStr(roundId) || !isStr(claimId) || !isStr(actionId) || !Array.isArray(ev)) {
      throw new GameError(400, 'bad_request', 'Faltan datos: ronda, afirmación, evidencias y acción.');
    }
    if (ev.length < MIN_EVIDENCE_PER_RESPONSE || ev.length > MAX_EVIDENCE_PER_RESPONSE || !ev.every(isStr) || new Set(ev).size !== ev.length) {
      throw new GameError(422, 'bad_evidence_count', `Elija entre ${MIN_EVIDENCE_PER_RESPONSE} y ${MAX_EVIDENCE_PER_RESPONSE} evidencias distintas.`);
    }
    return transaction(this.db, () => {
      const g = this.requireGame();
      const stage = this.currentStage(g);
      if (stage.round_id !== roundId) throw new GameError(409, 'wrong_round', 'Esa ronda no está en curso.');
      const existing = this.db.prepare('SELECT * FROM responses WHERE game_id = ? AND round_id = ? AND team_id = ?').get(g.id, roundId, session.team_id);
      if (existing) {
        const same = existing.claim_id === claimId && existing.action_id === actionId &&
          evidenceSetKey(JSON.parse(existing.evidence_ids)) === evidenceSetKey(ev);
        if (same) return { status: 'already_recorded', response: this._responseOut(existing) };
        throw new GameError(409, 'already_submitted', 'Su equipo ya envió la respuesta de esta ronda y no puede cambiarse.');
      }
      if (stage.phase !== 'deliberation') throw new GameError(409, 'phase_closed', 'La ventana de respuesta no está abierta.');
      const claim = this.content.claimById.get(claimId);
      if (!claim || claim.round_id !== roundId) throw new GameError(422, 'bad_claim', 'La afirmación no pertenece a esta ronda.');
      const action = this.content.actionById.get(actionId);
      if (!action || action.round_id !== roundId) throw new GameError(422, 'bad_action', 'La acción no pertenece a esta ronda.');
      for (const id of ev) {
        if (!this.isEvidenceReleased(id, g.stage_index)) throw new GameError(422, 'bad_evidence', 'Evidencia desconocida o todavía no revelada.');
      }
      const at = this.nowIso();
      this.db.prepare('INSERT INTO responses (game_id, round_id, team_id, claim_id, evidence_ids, action_id, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(g.id, roundId, session.team_id, claimId, JSON.stringify(ev), actionId, at);
      this.audit(g.id, session.actor, 'response_recorded', { round_id: roundId, claim_id: claimId, evidence_ids: ev, action_id: actionId });
      const row = this.db.prepare('SELECT * FROM responses WHERE game_id = ? AND round_id = ? AND team_id = ?').get(g.id, roundId, session.team_id);
      return { status: 'recorded', response: this._responseOut(row) };
    });
  }

  _responseOut(row) {
    return {
      round_id: row.round_id,
      team_id: row.team_id,
      claim_id: row.claim_id,
      evidence_ids: JSON.parse(row.evidence_ids),
      action_id: row.action_id,
      submitted_at: row.submitted_at,
    };
  }

  // ---------------------------------------------------------------- objeciones
  submitObjection(session, payload) {
    try {
      return this._submitObjection(session, payload);
    } catch (e) {
      if (e instanceof GameError) this.audit(session.game_id, session.actor, 'objection_rejected', { code: e.code });
      throw e;
    }
  }

  _submitObjection(session, payload) {
    pickOnly(payload, ['round_id', 'attacking_team_id', 'target_team_id', 'objection_kind', 'cited_evidence_id']);
    if (payload.attacking_team_id !== undefined && payload.attacking_team_id !== session.team_id) {
      throw new GameError(403, 'team_mismatch', 'No puede objetar en nombre de otro equipo.');
    }
    const { round_id: roundId, target_team_id: target, objection_kind: kind, cited_evidence_id: cited } = payload;
    if (!isStr(roundId) || !isStr(target) || !isStr(kind) || !isStr(cited)) {
      throw new GameError(400, 'bad_request', 'Faltan datos: ronda, equipo objetado, categoría y evidencia citada.');
    }
    if (!this.content.teamById.has(target)) throw new GameError(422, 'bad_target', 'Equipo objetado desconocido.');
    if (target === session.team_id) throw new GameError(422, 'self_objection', 'Un equipo no puede objetarse a sí mismo.');
    if (!OBJECTION_KINDS.includes(kind)) throw new GameError(422, 'bad_kind', 'Categoría de objeción desconocida.');
    return transaction(this.db, () => {
      const g = this.requireGame();
      const stage = this.currentStage(g);
      if (stage.round_id !== roundId) throw new GameError(409, 'wrong_round', 'Esa ronda no está en curso.');
      const existing = this.db.prepare('SELECT * FROM objections WHERE game_id = ? AND round_id = ? AND attacking_team_id = ?').get(g.id, roundId, session.team_id);
      if (existing) {
        const same = existing.target_team_id === target && existing.objection_kind === kind && existing.cited_evidence_id === cited;
        if (same) return { status: 'already_recorded', objection: this._objectionOut(existing), tokens_remaining: this.tokensRemaining(g.id, session.team_id) };
        throw new GameError(409, 'already_objected', 'Su equipo ya presentó su objeción en esta fase (máximo una).');
      }
      if (stage.phase !== 'objection') throw new GameError(409, 'phase_closed', 'La ventana de objeciones no está abierta.');
      if (this.tokensRemaining(g.id, session.team_id) <= 0) throw new GameError(409, 'no_tokens', 'Su equipo ya no tiene fichas de objeción.');
      if (!this.isEvidenceReleased(cited, g.stage_index)) throw new GameError(422, 'bad_evidence', 'Evidencia desconocida o todavía no revelada.');
      const targetRow = this.db.prepare('SELECT * FROM responses WHERE game_id = ? AND round_id = ? AND team_id = ?').get(g.id, roundId, target);
      if (!targetRow) throw new GameError(422, 'target_absent', 'Ese equipo no tiene respuesta bloqueada en esta ronda; no hay nada que objetar. No se gastó ficha.');
      // Instantánea tomada en el servidor a partir de la respuesta bloqueada real.
      const snapshot = { claim_id: targetRow.claim_id, evidence_ids: JSON.parse(targetRow.evidence_ids), action_id: targetRow.action_id };
      const at = this.nowIso();
      this.db.prepare('INSERT INTO objections (game_id, round_id, attacking_team_id, target_team_id, objection_kind, cited_evidence_id, target_snapshot, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(g.id, roundId, session.team_id, target, kind, cited, JSON.stringify(snapshot), at);
      this.audit(g.id, session.actor, 'objection_recorded', { round_id: roundId, target_team_id: target, objection_kind: kind, cited_evidence_id: cited });
      const row = this.db.prepare('SELECT * FROM objections WHERE game_id = ? AND round_id = ? AND attacking_team_id = ?').get(g.id, roundId, session.team_id);
      return { status: 'recorded', objection: this._objectionOut(row), tokens_remaining: this.tokensRemaining(g.id, session.team_id) };
    });
  }

  _objectionOut(row) {
    return {
      round_id: row.round_id,
      attacking_team_id: row.attacking_team_id,
      target_team_id: row.target_team_id,
      objection_kind: row.objection_kind,
      objection_kind_label: OBJECTION_KIND_LABELS[row.objection_kind],
      cited_evidence_id: row.cited_evidence_id,
      submitted_at: row.submitted_at,
    };
  }

  /** Fichas reales (incluye objeciones aún ocultas de la ventana en curso). */
  tokensRemaining(gameId, teamId) {
    const n = this.db.prepare('SELECT COUNT(*) AS n FROM objections WHERE game_id = ? AND attacking_team_id = ?').get(gameId, teamId).n;
    return TOKENS_PER_TEAM - n;
  }

  // ---------------------------------------------------------------- puntuación
  /** Calcula la ronda (idempotente). Solo permitido cuando sus resultados ya son públicos. */
  scoreRound(roundId, actor = 'sistema') {
    return transaction(this.db, () => {
      const g = this.requireGame();
      if (!this.plan.byRound.has(roundId)) throw new GameError(422, 'bad_round', 'Ronda desconocida.');
      if (!this.plan.resultsPublished(g.stage_index, roundId)) {
        throw new GameError(409, 'too_early', 'Los resultados de esa ronda se calculan al entrar en su fase de resultados.');
      }
      const r = this._scoreRoundTx(g, roundId);
      this.audit(g.id, actor, r.already ? 'score_replayed' : 'round_scored', { round_id: roundId });
      return r;
    });
  }

  _scoreRoundTx(g, roundId) {
    const done = this.db.prepare('SELECT 1 FROM round_results WHERE game_id = ? AND round_id = ?').get(g.id, roundId);
    if (done) return { round_id: roundId, already: true };
    const roundKey = this.content.key[roundId];
    const at = this.nowIso();
    this.db.prepare('INSERT INTO round_results (game_id, round_id, scored_at) VALUES (?, ?, ?)').run(g.id, roundId, at);
    const insert = this.db.prepare('INSERT INTO score_events (game_id, round_id, team_id, category, points, rule_ref, reason, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const team of this.content.teams) {
      const row = this.db.prepare('SELECT * FROM responses WHERE game_id = ? AND round_id = ? AND team_id = ?').get(g.id, roundId, team.id);
      const resp = row ? this._responseOut(row) : null;
      const s = scoreResponse(resp, roundKey);
      const respDetail = resp ? { claim_id: resp.claim_id, evidence_ids: resp.evidence_ids, action_id: resp.action_id } : { absent: true };
      insert.run(g.id, roundId, team.id, 'argument', s.argument.points, s.argument.rule_ref, s.argument.reason, JSON.stringify(respDetail));
      insert.run(g.id, roundId, team.id, 'action', s.action.points, s.action.rule_ref, s.action.reason, JSON.stringify(respDetail));
      const obj = this.db.prepare('SELECT * FROM objections WHERE game_id = ? AND round_id = ? AND attacking_team_id = ?').get(g.id, roundId, team.id);
      if (obj) {
        const snapshot = JSON.parse(obj.target_snapshot);
        const o = scoreObjection(obj, snapshot, roundKey);
        insert.run(g.id, roundId, team.id, 'objection', o.points, o.rule_ref, o.reason, JSON.stringify({
          target_team_id: obj.target_team_id, objection_kind: obj.objection_kind, cited_evidence_id: obj.cited_evidence_id, target_snapshot: snapshot,
        }));
      }
    }
    return { round_id: roundId, already: false };
  }

  _events(gameId) {
    return this.db.prepare('SELECT * FROM score_events WHERE game_id = ? ORDER BY rowid').all(gameId);
  }

  standings(g) {
    return computeStandings(this.content.teams, g ? this._events(g.id) : []);
  }

  // ---------------------------------------------------------------- vistas
  _timer(g, stage) {
    const started = new Date(g.stage_started_at);
    return {
      duration_seconds: stage.duration_seconds,
      started_at: g.stage_started_at,
      ends_at: new Date(started.getTime() + stage.duration_seconds * 1000).toISOString(),
      server_time: this.nowIso(),
      hint_only: true,
    };
  }

  _slideFor(stage) {
    const map = this.content.projectionMap;
    if (!map) return null;
    if (stage.phase === 'tutorial') return map.tutorial ?? null;
    if (stage.phase === 'closing') return map.closing ?? null;
    const r = map.rounds?.[stage.round_id];
    if (!r) return null;
    // Sin diapositiva propia de confrontación se reutiliza la de objeciones (documentado).
    if (stage.phase === 'confrontation') return r.confrontation ?? r.objection ?? null;
    return r[stage.phase] ?? null;
  }

  /** Respuestas publicadas de una ronda (solo tras el bloqueo). */
  _publishedResponses(g, roundId) {
    if (!roundId || !this.plan.responsesLocked(g.stage_index, roundId)) return [];
    const rows = this.db.prepare('SELECT * FROM responses WHERE game_id = ? AND round_id = ?').all(g.id, roundId);
    const byTeam = new Map(rows.map((r) => [r.team_id, r]));
    return this.content.teams.map((t) => {
      const r = byTeam.get(t.id);
      if (!r) return { team_id: t.id, status: 'absent' };
      const ev = JSON.parse(r.evidence_ids);
      return {
        team_id: t.id,
        status: 'submitted',
        claim_id: r.claim_id,
        claim_text: this.content.claimById.get(r.claim_id)?.text ?? null,
        evidence_ids: ev,
        action_id: r.action_id,
        action_text: this.content.actionById.get(r.action_id)?.text ?? null,
      };
    });
  }

  /** Objeciones publicadas de una ronda (solo tras cerrar su ventana). */
  _publishedObjections(g, roundId) {
    if (!roundId || !this.plan.objectionsLocked(g.stage_index, roundId)) return [];
    const rows = this.db.prepare('SELECT * FROM objections WHERE game_id = ? AND round_id = ? ORDER BY submitted_at, rowid').all(g.id, roundId);
    const withResults = this.plan.resultsPublished(g.stage_index, roundId);
    const evs = withResults
      ? new Map(this.db.prepare("SELECT team_id, points FROM score_events WHERE game_id = ? AND round_id = ? AND category = 'objection'").all(g.id, roundId).map((e) => [e.team_id, e.points]))
      : null;
    return rows.map((r) => {
      const o = {
        attacking_team_id: r.attacking_team_id,
        target_team_id: r.target_team_id,
        objection_kind: r.objection_kind,
        objection_kind_label: OBJECTION_KIND_LABELS[r.objection_kind],
        cited_evidence_id: r.cited_evidence_id,
      };
      if (evs) {
        o.points = evs.get(r.attacking_team_id) ?? 0;
        o.valid = o.points > 0;
      }
      return o;
    });
  }

  _roundResults(g, roundId) {
    if (!roundId || !this.plan.resultsPublished(g.stage_index, roundId)) return [];
    const rows = this.db.prepare('SELECT * FROM score_events WHERE game_id = ? AND round_id = ?').all(g.id, roundId);
    return this.content.teams.map((t) => {
      const mine = rows.filter((e) => e.team_id === t.id);
      const pts = (cat) => mine.find((e) => e.category === cat)?.points ?? 0;
      const out = { team_id: t.id, argument_points: pts('argument'), action_points: pts('action'), objection_points: pts('objection') };
      out.total = out.argument_points + out.action_points + out.objection_points;
      return out;
    });
  }

  /** Fichas públicas: no revelan objeciones de una ventana que sigue abierta. */
  _publicTokens(g) {
    const rows = this.db.prepare('SELECT round_id, attacking_team_id FROM objections WHERE game_id = ?').all(g.id);
    const spent = new Map();
    for (const r of rows) {
      if (this.plan.objectionsLocked(g.stage_index, r.round_id)) spent.set(r.attacking_team_id, (spent.get(r.attacking_team_id) ?? 0) + 1);
    }
    return spent;
  }

  _scoreboard(g) {
    const { rows, winners } = this.standings(g);
    const spent = g ? this._publicTokens(g) : new Map();
    return {
      scoreboard: rows.map((r) => ({
        team_id: r.team_id,
        team_name: r.team_name,
        score: r.score,
        objection_tokens_remaining: TOKENS_PER_TEAM - (spent.get(r.team_id) ?? 0),
        rank: r.rank,
        valid_objections: r.valid_objections,
        supported_arguments: r.supported_arguments,
      })),
      winners,
    };
  }

  _base(g) {
    const demo = this.content.mode === 'demo';
    const base = { api_version: API_VERSION, content_mode: this.content.mode, demo, demo_notice: demo ? DEMO_NOTICE : null, case_title: this.content.title };
    if (!g) {
      return { ...base, game_active: false, stage_index: null, stage_count: this.plan.count, round_id: null, round_title: null, phase: null, phase_label: 'Partida no iniciada', slide: null, timer: null };
    }
    const stage = this.currentStage(g);
    return {
      ...base,
      game_active: true,
      stage_index: g.stage_index,
      stage_count: this.plan.count,
      round_id: stage.round_id,
      round_title: stage.round_id ? this.content.roundById.get(stage.round_id).title : null,
      phase: stage.phase,
      phase_label: stage.phase_label,
      slide: this._slideFor(stage),
      timer: this._timer(g, stage),
    };
  }

  /** GET /api/public-state: solo información publicada. */
  getPublicState() {
    const g = this.activeGame();
    const base = this._base(g);
    const { scoreboard, winners } = this._scoreboard(g);
    const roundId = base.round_id;
    return {
      ...base,
      scoreboard,
      responses: g ? this._publishedResponses(g, roundId) : [],
      objections: g ? this._publishedObjections(g, roundId) : [],
      round_results: g ? this._roundResults(g, roundId) : [],
      winners: g && base.phase === 'closing' ? winners : [],
    };
  }

  getTeamState(session) {
    const g = this.requireGame();
    const pub = this.getPublicState();
    const stage = this.currentStage(g);
    const team = this.content.teamById.get(session.team_id);
    const roundId = stage.round_id;
    const round = roundId ? this.content.roundById.get(roundId) : null;
    const myRow = roundId ? this.db.prepare('SELECT * FROM responses WHERE game_id = ? AND round_id = ? AND team_id = ?').get(g.id, roundId, team.id) : null;
    const myObj = roundId ? this.db.prepare('SELECT * FROM objections WHERE game_id = ? AND round_id = ? AND attacking_team_id = ?').get(g.id, roundId, team.id) : null;
    const tokens = this.tokensRemaining(g.id, team.id);
    let objectionBlock = null;
    if (stage.phase === 'objection') {
      if (myObj) objectionBlock = 'Ya presentaron su objeción en esta fase.';
      else if (tokens <= 0) objectionBlock = 'No les quedan fichas de objeción.';
    }
    const targets = stage.phase === 'objection'
      ? this._publishedResponses(g, roundId).filter((r) => r.status === 'submitted' && r.team_id !== team.id).map((r) => r.team_id)
      : [];
    const myResults = this.content.rounds
      .filter((r) => this.plan.resultsPublished(g.stage_index, r.id))
      .map((r) => ({ round_id: r.id, ...this._roundResults(g, r.id).find((x) => x.team_id === team.id) }));
    return {
      ...pub,
      team: { id: team.id, name: team.name },
      tokens_remaining: tokens,
      released_evidence: this.releasedEvidence(g.stage_index).map((e) => ({
        id: e.id, body: e.body, revealed_in: e.revealed_in, media_url: `/media/${encodeURIComponent(e.id)}`,
      })),
      round: round ? { id: round.id, title: round.title, claims: round.claims, actions: round.actions } : null,
      my_response: myRow ? this._responseOut(myRow) : null,
      can_respond: stage.phase === 'deliberation' && !myRow,
      my_objection: myObj ? this._objectionOut(myObj) : null,
      can_object: stage.phase === 'objection' && !myObj && tokens > 0 && targets.length > 0,
      objection_block_reason: objectionBlock ?? (stage.phase === 'objection' && targets.length === 0 ? 'No hay respuestas de otros equipos que objetar.' : null),
      objection_targets: targets,
      objection_kinds: OBJECTION_KINDS.map((k) => ({ id: k, label: OBJECTION_KIND_LABELS[k], help: OBJECTION_KIND_HELP[k] })),
      my_results: myResults,
    };
  }

  getModeratorState() {
    const g = this.activeGame();
    const pub = this.getPublicState();
    const out = {
      ...pub,
      content_warnings: this.content.warnings,
      content_fingerprint: this.content.fingerprint,
      stages: this.plan.stages,
      points: POINTS,
      objection_kind_labels: OBJECTION_KIND_LABELS,
    };
    if (!g) return { ...out, game: null };
    const stage = this.currentStage(g);
    const roundId = stage.round_id;
    const codes = new Map(this.db.prepare('SELECT team_id, code FROM team_codes WHERE game_id = ?').all(g.id).map((r) => [r.team_id, r.code]));
    const respRows = roundId ? this.db.prepare('SELECT team_id FROM responses WHERE game_id = ? AND round_id = ?').all(g.id, roundId) : [];
    const objRows = roundId ? this.db.prepare('SELECT * FROM objections WHERE game_id = ? AND round_id = ?').all(g.id, roundId) : [];
    const responded = new Set(respRows.map((r) => r.team_id));
    const objected = new Set(objRows.map((r) => r.attacking_team_id));
    const nowMs = this.now().getTime();
    const deliberationStarted = roundId && g.stage_index >= this.plan.phaseIndex(roundId, 'deliberation');
    const objectionStarted = roundId && g.stage_index >= this.plan.phaseIndex(roundId, 'objection');
    const locked = roundId && this.plan.responsesLocked(g.stage_index, roundId);
    const scores = new Map(pub.scoreboard.map((r) => [r.team_id, r.score]));
    out.game = { id: g.id, created_at: g.created_at, stage_index: g.stage_index };
    out.next_stage = this.plan.stage(g.stage_index + 1);
    out.teams = this.content.teams.map((t) => {
      const seen = this.presence.get(`${g.id}:${t.id}`);
      return {
        id: t.id,
        name: t.name,
        code: codes.get(t.id),
        connected: seen !== undefined && nowMs - seen < PRESENCE_WINDOW_MS,
        last_seen_seconds: seen === undefined ? null : Math.round((nowMs - seen) / 1000),
        response_status: !deliberationStarted ? 'n/a' : responded.has(t.id) ? 'received' : locked ? 'absent' : 'missing',
        objection_status: !objectionStarted ? 'n/a' : objected.has(t.id) ? 'received' : 'none',
        tokens_remaining: this.tokensRemaining(g.id, t.id),
        score: scores.get(t.id),
      };
    });
    out.objection_count = objRows.length;
    out.objections_by_target = this.plan.objectionsLocked(g.stage_index, roundId)
      ? this.content.teams.map((t) => ({ team_id: t.id, attackers: objRows.filter((o) => o.target_team_id === t.id).map((o) => o.attacking_team_id) })).filter((x) => x.attackers.length)
      : [];
    out.explanations = this._explanations(g);
    out.history = this.db.prepare('SELECT stage_index, phase, round_id, entered_at, actor FROM stage_log WHERE game_id = ? ORDER BY stage_index').all(g.id);
    return out;
  }

  _explanations(g) {
    const events = this._events(g.id);
    const rounds = this.db.prepare('SELECT round_id, scored_at FROM round_results WHERE game_id = ?').all(g.id);
    return rounds.map((rr) => ({
      round_id: rr.round_id,
      scored_at: rr.scored_at,
      items: events.filter((e) => e.round_id === rr.round_id).map((e) => ({
        team_id: e.team_id,
        category: e.category,
        points: e.points,
        rule_ref: e.rule_ref,
        reason: e.reason,
        reason_label: REASON_LABELS[e.reason] ?? e.reason,
        detail: JSON.parse(e.detail),
      })),
    }));
  }

  // ---------------------------------------------------------------- exportación
  exportAudit() {
    const g = this.requireGame();
    const { rows, winners } = this.standings(g);
    return {
      exported_at: this.nowIso(),
      api_version: API_VERSION,
      content_mode: this.content.mode,
      demo_notice: this.content.mode === 'demo' ? DEMO_NOTICE : null,
      content_fingerprint: this.content.fingerprint,
      game: { id: g.id, created_at: g.created_at, stage_index: g.stage_index, phase: this.currentStage(g).phase },
      points_rules: { argument: POINTS.argument, action: POINTS.action, objection: POINTS.objection, tokens_per_team: TOKENS_PER_TEAM },
      stage_log: this.db.prepare('SELECT stage_index, phase, round_id, entered_at, actor FROM stage_log WHERE game_id = ? ORDER BY stage_index').all(g.id),
      responses: this.db.prepare('SELECT * FROM responses WHERE game_id = ? ORDER BY submitted_at, rowid').all(g.id).map((r) => this._responseOut(r)),
      objections: this.db.prepare('SELECT * FROM objections WHERE game_id = ? ORDER BY submitted_at, rowid').all(g.id).map((r) => ({
        ...this._objectionOut(r), target_snapshot: JSON.parse(r.target_snapshot),
      })),
      score_events: this._events(g.id).map((e) => ({
        round_id: e.round_id, team_id: e.team_id, category: e.category, points: e.points,
        rule_ref: e.rule_ref, reason: e.reason, reason_label: REASON_LABELS[e.reason] ?? e.reason, detail: JSON.parse(e.detail),
      })),
      standings: rows,
      winners,
      tie_break_order: ['score', 'valid_objections', 'supported_arguments', 'empate = victoria conjunta'],
      audit_log: this.db.prepare('SELECT at, actor, event, detail FROM audit_log WHERE game_id = ? ORDER BY id').all(g.id).map((a) => ({ ...a, detail: JSON.parse(a.detail) })),
    };
  }
}
