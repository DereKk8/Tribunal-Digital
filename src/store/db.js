// Persistencia local en SQLite (módulo integrado node:sqlite, sin dependencias nativas).
// Las restricciones de unicidad y los disparadores son una segunda barrera:
// aunque el servicio ya valida, la base de datos impide duplicados, cambios
// posteriores y gastar más fichas de las disponibles.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { TOKENS_PER_TEAM } from '../constants.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  content_mode TEXT NOT NULL CHECK (content_mode IN ('demo', 'real')),
  content_fingerprint TEXT NOT NULL,
  stage_index INTEGER NOT NULL DEFAULT 0 CHECK (stage_index >= 0),
  stage_started_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  archived_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS games_one_active ON games(active) WHERE active = 1;

CREATE TABLE IF NOT EXISTS team_codes (
  game_id TEXT NOT NULL REFERENCES games(id),
  team_id TEXT NOT NULL,
  code TEXT NOT NULL,
  PRIMARY KEY (game_id, team_id),
  UNIQUE (game_id, code)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('team', 'moderator')),
  game_id TEXT REFERENCES games(id),
  team_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK ((role = 'team' AND game_id IS NOT NULL AND team_id IS NOT NULL) OR (role = 'moderator' AND team_id IS NULL))
);

CREATE TABLE IF NOT EXISTS stage_log (
  game_id TEXT NOT NULL REFERENCES games(id),
  stage_index INTEGER NOT NULL,
  phase TEXT NOT NULL,
  round_id TEXT,
  entered_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  PRIMARY KEY (game_id, stage_index)
);

CREATE TABLE IF NOT EXISTS responses (
  game_id TEXT NOT NULL REFERENCES games(id),
  round_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  evidence_ids TEXT NOT NULL,
  action_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (game_id, round_id, team_id)
);

CREATE TABLE IF NOT EXISTS objections (
  game_id TEXT NOT NULL REFERENCES games(id),
  round_id TEXT NOT NULL,
  attacking_team_id TEXT NOT NULL,
  target_team_id TEXT NOT NULL,
  objection_kind TEXT NOT NULL,
  cited_evidence_id TEXT NOT NULL,
  target_snapshot TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (game_id, round_id, attacking_team_id),
  CHECK (attacking_team_id <> target_team_id),
  FOREIGN KEY (game_id, round_id, target_team_id) REFERENCES responses(game_id, round_id, team_id)
);

CREATE TABLE IF NOT EXISTS round_results (
  game_id TEXT NOT NULL REFERENCES games(id),
  round_id TEXT NOT NULL,
  scored_at TEXT NOT NULL,
  PRIMARY KEY (game_id, round_id)
);

CREATE TABLE IF NOT EXISTS score_events (
  game_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('argument', 'action', 'objection')),
  points INTEGER NOT NULL,
  rule_ref TEXT,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL,
  PRIMARY KEY (game_id, round_id, team_id, category),
  FOREIGN KEY (game_id, round_id) REFERENCES round_results(game_id, round_id),
  CHECK ((category = 'action' AND points IN (0, 2)) OR (category <> 'action' AND points IN (0, 3)))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS objections_token_limit BEFORE INSERT ON objections
WHEN (SELECT COUNT(*) FROM objections WHERE game_id = NEW.game_id AND attacking_team_id = NEW.attacking_team_id) >= ${TOKENS_PER_TEAM}
BEGIN SELECT RAISE(ABORT, 'token_limit'); END;

CREATE TRIGGER IF NOT EXISTS responses_immutable_upd BEFORE UPDATE ON responses BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER IF NOT EXISTS responses_immutable_del BEFORE DELETE ON responses BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER IF NOT EXISTS objections_immutable_upd BEFORE UPDATE ON objections BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER IF NOT EXISTS objections_immutable_del BEFORE DELETE ON objections BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER IF NOT EXISTS score_events_immutable_upd BEFORE UPDATE ON score_events BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER IF NOT EXISTS score_events_immutable_del BEFORE DELETE ON score_events BEGIN SELECT RAISE(ABORT, 'immutable'); END;
CREATE TRIGGER IF NOT EXISTS stage_backwards BEFORE UPDATE OF stage_index ON games
WHEN NEW.stage_index <> OLD.stage_index + 1
BEGIN SELECT RAISE(ABORT, 'stage_order'); END;
`;

export function openDatabase(filePath) {
  if (filePath !== ':memory:') mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('db_schema', '1')").run();
  return db;
}

/**
 * Ejecuta fn dentro de una transacción BEGIN IMMEDIATE. node:sqlite es síncrono
 * y Node ejecuta un manejador a la vez, por lo que ninguna otra petición puede
 * intercalarse entre la lectura del estado y la escritura.
 */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* la transacción ya estaba cerrada */ }
    throw e;
  }
}
