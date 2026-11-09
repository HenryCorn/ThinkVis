import { DatabaseSync } from "node:sqlite";

/** Ordered migrations. Index + 1 is the schema version stored in PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE notes (
    id          TEXT PRIMARY KEY,
    path        TEXT NOT NULL,
    hash        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    mtime_ms    REAL NOT NULL,
    title       TEXT NOT NULL,
    purpose     TEXT NOT NULL DEFAULT '',
    assist_mode TEXT NOT NULL DEFAULT 'quiet' CHECK (assist_mode IN ('quiet','proactive')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
  );
  CREATE UNIQUE INDEX notes_live_path ON notes(path) WHERE deleted_at IS NULL;
  CREATE VIRTUAL TABLE note_fts USING fts5(id UNINDEXED, title, body);
  `,
  `
  CREATE TABLE chat_messages (
    id            TEXT PRIMARY KEY,
    note_id       TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content       TEXT NOT NULL,
    connection_id TEXT,
    provider      TEXT,
    billing       TEXT,
    model         TEXT,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    note_hash     TEXT,
    context_hash  TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE INDEX chat_messages_note ON chat_messages(note_id);
  `,
  `
  CREATE TABLE personas (
    id          TEXT PRIMARY KEY,
    builtin     INTEGER NOT NULL DEFAULT 0,
    version     INTEGER NOT NULL DEFAULT 1,
    name        TEXT NOT NULL,
    instructions TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    archived_at TEXT
  );
  CREATE TABLE persona_versions (
    persona_id   TEXT NOT NULL,
    version      INTEGER NOT NULL,
    name         TEXT NOT NULL,
    instructions TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    PRIMARY KEY (persona_id, version)
  );
  ALTER TABLE notes ADD COLUMN persona_id TEXT;
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE feedback (
    id              TEXT PRIMARY KEY,
    note_id         TEXT NOT NULL,
    note_hash       TEXT NOT NULL,
    quote           TEXT NOT NULL,
    anchor_start    INTEGER NOT NULL,
    anchor_end      INTEGER NOT NULL,
    anchor_prefix   TEXT NOT NULL,
    anchor_suffix   TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('correction','question','suggestion')),
    body            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
    source          TEXT NOT NULL CHECK (source IN ('requested','proactive')),
    dedupe_key      TEXT NOT NULL,
    persona_id      TEXT,
    persona_version INTEGER,
    connection_id   TEXT,
    provider        TEXT,
    billing         TEXT,
    model           TEXT,
    context_hash    TEXT,
    created_at      TEXT NOT NULL,
    resolved_at     TEXT
  );
  CREATE UNIQUE INDEX feedback_dedupe ON feedback(note_id, dedupe_key);
  CREATE INDEX feedback_note ON feedback(note_id);
  CREATE TABLE feedback_replies (
    id            TEXT PRIMARY KEY,
    feedback_id   TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content       TEXT NOT NULL,
    connection_id TEXT,
    provider      TEXT,
    billing       TEXT,
    model         TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE INDEX feedback_replies_fb ON feedback_replies(feedback_id);
  `,
];

export function openDb(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (row.user_version > MIGRATIONS.length) {
    db.close();
    throw new Error(`Database schema ${row.user_version} is newer than this app supports (${MIGRATIONS.length}).`);
  }
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}
