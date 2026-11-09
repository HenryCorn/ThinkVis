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
