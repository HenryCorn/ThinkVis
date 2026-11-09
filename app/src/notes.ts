import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "./db.ts";
import { resolveInside, safeRelPath } from "./paths.ts";

export const MAX_NOTE_BYTES = 5 * 1024 * 1024;
const TMP_PREFIX = ".thinkvis-tmp-";
const DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export type NoteErrorCode = "exists" | "conflict" | "not_found" | "invalid";

export class NoteError extends Error {
  code: NoteErrorCode;
  detail: Record<string, unknown>;
  constructor(code: NoteErrorCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "NoteError";
    this.code = code;
    this.detail = detail;
  }
}

export type NoteSummary = {
  id: string;
  path: string;
  title: string;
  purpose: string;
  assistMode: "quiet" | "proactive";
  updatedAt: string;
};

type Row = {
  id: string;
  path: string;
  hash: string;
  size: number;
  mtime_ms: number;
  title: string;
  purpose: string;
  assist_mode: "quiet" | "proactive";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type FileRead = { rel: string; content: string; hash: string; size: number; mtimeMs: number };

const sha256 = (buf: Uint8Array) => createHash("sha256").update(buf).digest("hex");

export function titleOf(content: string, rel: string): string {
  const m = /^#[ \t]+(.+?)[ \t#]*$/m.exec(content.slice(0, 4096));
  if (m && m[1].trim()) return m[1].trim().slice(0, 200);
  return path.posix.basename(rel).replace(/\.md$/i, "");
}

/**
 * Write bytes beside the target, fsync, then rename into place. With
 * noOverwrite the final step is a hard link, which fails if the target
 * exists, so a create can never replace a file.
 */
export function atomicWrite(target: string, data: Uint8Array, opts: { noOverwrite?: boolean } = {}): void {
  const tmp = path.join(path.dirname(target), `${TMP_PREFIX}${randomUUID()}`);
  const fd = openSync(tmp, "wx");
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } catch (e) {
    closeSync(fd);
    unlinkSync(tmp);
    throw e;
  }
  closeSync(fd);
  try {
    if (opts.noOverwrite) {
      try {
        linkSync(tmp, target);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new NoteError("exists", "A file already exists at that path.");
        throw e;
      }
      unlinkSync(tmp);
    } else {
      renameSync(tmp, target);
    }
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* already gone */
    }
    throw e;
  }
}

export class NoteStore {
  readonly dataDir: string;
  readonly root: string;
  readonly trashDir: string;
  readonly exportDir: string;
  db: DatabaseSync;
  skipped: string[] = [];

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.dataDir = realpathSync(dataDir);
    this.root = path.join(this.dataDir, "notes");
    this.trashDir = path.join(this.dataDir, ".trash");
    this.exportDir = path.join(this.dataDir, "exports");
    for (const d of [this.root, this.trashDir, this.exportDir]) mkdirSync(d, { recursive: true });
    this.db = openDb(path.join(this.dataDir, "thinkvis.sqlite"));
    this.cleanTemps(this.root);
    this.sync({ deep: true });
  }

  close(): void {
    this.db.close();
  }

  // ---- filesystem helpers -------------------------------------------------

  /** Remove half-written temp files left by a crash. Only our own prefix is touched. */
  private cleanTemps(dir: string): void {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) this.cleanTemps(full);
      else if (ent.isFile() && ent.name.startsWith(TMP_PREFIX)) unlinkSync(full);
    }
  }

  private walk(): { files: { rel: string; size: number; mtimeMs: number }[]; folders: string[] } {
    const files: { rel: string; size: number; mtimeMs: number }[] = [];
    const folders: string[] = [];
    const visit = (dir: string, prefix: string) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.name.startsWith(".") || ent.isSymbolicLink()) continue;
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
        if (ent.isDirectory()) {
          folders.push(rel);
          visit(path.join(dir, ent.name), rel);
        } else if (ent.isFile() && /\.md$/i.test(ent.name)) {
          const st = statSync(path.join(dir, ent.name));
          files.push({ rel, size: st.size, mtimeMs: st.mtimeMs });
        }
      }
    };
    visit(this.root, "");
    return { files, folders: folders.sort() };
  }

  /** Read a note file. Returns null if it is missing or is not valid UTF-8. */
  private readFile(rel: string): FileRead | null {
    const abs = resolveInside(this.root, rel);
    let buf: Buffer;
    let st;
    try {
      st = statSync(abs);
      if (!st.isFile()) return null;
      if (st.size > MAX_NOTE_BYTES) return null;
      buf = readFileSync(abs);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
    let content: string;
    try {
      content = DECODER.decode(buf);
    } catch {
      return null;
    }
    return { rel, content, hash: sha256(buf), size: buf.length, mtimeMs: st.mtimeMs };
  }

  // ---- index helpers ------------------------------------------------------

  private liveRow(id: string): Row {
    const row = this.db.prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL").get(id) as Row | undefined;
    if (!row) throw new NoteError("not_found", "Note not found.");
    return row;
  }

  private index(id: string, read: FileRead, isNew: boolean): void {
    const now = new Date().toISOString();
    const title = titleOf(read.content, read.rel);
    if (isNew) {
      this.db
        .prepare(
          "INSERT INTO notes (id, path, hash, size, mtime_ms, title, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .run(id, read.rel, read.hash, read.size, read.mtimeMs, title, now, now);
    } else {
      this.db
        .prepare("UPDATE notes SET path=?, hash=?, size=?, mtime_ms=?, title=?, updated_at=? WHERE id=?")
        .run(read.rel, read.hash, read.size, read.mtimeMs, title, now, id);
    }
    this.db.prepare("DELETE FROM note_fts WHERE id = ?").run(id);
    this.db.prepare("INSERT INTO note_fts (id, title, body) VALUES (?,?,?)").run(id, title, read.content);
  }

  private markDeleted(id: string): void {
    this.db.prepare("UPDATE notes SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    this.db.prepare("DELETE FROM note_fts WHERE id = ?").run(id);
  }

  /**
   * Reconcile the index with the folder. Never changes or deletes a source
   * file. Detects edits, moves (same content at a new path) and removals.
   * Without deep, a file whose size and mtime are unchanged is not re-read.
   */
  sync(opts: { deep?: boolean } = {}): void {
    const { files } = this.walk();
    const live = this.db.prepare("SELECT * FROM notes WHERE deleted_at IS NULL").all() as Row[];
    const byPath = new Map(live.map((r) => [r.path, r]));
    const seen = new Set<string>();
    const unmatched: FileRead[] = [];
    this.skipped = [];
    this.db.exec("BEGIN");
    try {
      for (const f of files) {
        const row = byPath.get(f.rel);
        if (row && !opts.deep && row.size === f.size && row.mtime_ms === f.mtimeMs) {
          seen.add(f.rel);
          continue;
        }
        const read = this.readFile(f.rel);
        if (!read) {
          this.skipped.push(f.rel);
          if (row) seen.add(f.rel);
          continue;
        }
        if (row) {
          seen.add(f.rel);
          if (row.hash !== read.hash) this.index(row.id, read, false);
          else this.db.prepare("UPDATE notes SET mtime_ms=?, size=? WHERE id=?").run(read.mtimeMs, read.size, row.id);
        } else {
          unmatched.push(read);
        }
      }
      const missing = live.filter((r) => !seen.has(r.path));
      for (const read of unmatched) {
        const i = missing.findIndex((m) => m.hash === read.hash);
        if (i >= 0) {
          const [moved] = missing.splice(i, 1);
          this.index(moved.id, read, false);
        } else {
          this.index(randomUUID(), read, true);
        }
      }
      for (const m of missing) this.markDeleted(m.id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  // ---- public API ---------------------------------------------------------

  listAll(): { notes: NoteSummary[]; folders: string[] } {
    this.sync();
    const rows = this.db.prepare("SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY path COLLATE NOCASE").all() as Row[];
    return {
      notes: rows.map((r) => ({
        id: r.id,
        path: r.path,
        title: r.title,
        purpose: r.purpose,
        assistMode: r.assist_mode,
        updatedAt: r.updated_at,
      })),
      folders: this.walk().folders,
    };
  }

  get(id: string) {
    const row = this.liveRow(id);
    const read = this.readFile(row.path);
    if (!read) {
      this.markDeleted(id);
      throw new NoteError("not_found", "The note file is no longer on disk.");
    }
    const externallyChanged = read.hash !== row.hash;
    if (externallyChanged) this.index(id, read, false);
    return {
      id,
      path: row.path,
      title: titleOf(read.content, row.path),
      content: read.content,
      hash: read.hash,
      purpose: row.purpose,
      assistMode: row.assist_mode,
      externallyChanged,
    };
  }

  create(input: { path: unknown; content?: unknown }): { id: string; path: string; hash: string } {
    const rel = safeRelPath(input.path, { markdown: true });
    const content = input.content === undefined ? "" : input.content;
    if (typeof content !== "string") throw new NoteError("invalid", "Content must be a string.");
    const data = Buffer.from(content, "utf8");
    if (data.length > MAX_NOTE_BYTES) throw new NoteError("invalid", "Note is too large.");
    const abs = resolveInside(this.root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    resolveInside(this.root, rel);
    atomicWrite(abs, data, { noOverwrite: true });
    const read = this.readFile(rel);
    if (!read) throw new Error("Created note could not be read back.");
    const id = randomUUID();
    this.index(id, read, true);
    return { id, path: rel, hash: read.hash };
  }

  save(id: string, content: unknown, baseHash: unknown): { hash: string } {
    if (typeof content !== "string") throw new NoteError("invalid", "Content must be a string.");
    if (typeof baseHash !== "string") throw new NoteError("invalid", "baseHash is required.");
    const data = Buffer.from(content, "utf8");
    if (data.length > MAX_NOTE_BYTES) throw new NoteError("invalid", "Note is too large.");
    const row = this.liveRow(id);
    const cur = this.readFile(row.path);
    if (!cur) throw new NoteError("conflict", "The note file changed or was removed on disk.", { currentHash: null });
    if (cur.hash !== baseHash) {
      this.index(id, cur, false);
      throw new NoteError("conflict", "The note changed on disk since you opened it.", {
        currentHash: cur.hash,
        currentContent: cur.content,
      });
    }
    atomicWrite(resolveInside(this.root, row.path), data);
    const read = this.readFile(row.path);
    if (!read) throw new Error("Saved note could not be read back.");
    this.index(id, read, false);
    return { hash: read.hash };
  }

  move(id: string, newPath: unknown): { path: string } {
    const rel = safeRelPath(newPath, { markdown: true });
    const row = this.liveRow(id);
    if (rel === row.path) return { path: rel };
    const from = resolveInside(this.root, row.path);
    const to = resolveInside(this.root, rel);
    mkdirSync(path.dirname(to), { recursive: true });
    try {
      linkSync(from, to);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new NoteError("exists", "A file already exists at that path.");
      throw e;
    }
    unlinkSync(from);
    const read = this.readFile(rel);
    if (!read) throw new Error("Moved note could not be read back.");
    this.index(id, read, false);
    return { path: rel };
  }

  /** Moves the file to .trash outside the notes folder. Nothing is destroyed. */
  remove(id: string): void {
    const row = this.liveRow(id);
    const from = resolveInside(this.root, row.path);
    const to = path.join(this.trashDir, `${id}-${path.posix.basename(row.path)}`);
    try {
      renameSync(from, to);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    this.markDeleted(id);
  }

  createFolder(input: unknown): { path: string } {
    const rel = safeRelPath(input);
    mkdirSync(resolveInside(this.root, rel), { recursive: true });
    return { path: rel };
  }

  setMeta(id: string, meta: { purpose?: unknown; assistMode?: unknown }): void {
    this.liveRow(id);
    if (meta.purpose !== undefined) {
      if (typeof meta.purpose !== "string" || meta.purpose.length > 2000) throw new NoteError("invalid", "Purpose must be text up to 2000 characters.");
      this.db.prepare("UPDATE notes SET purpose = ? WHERE id = ?").run(meta.purpose, id);
    }
    if (meta.assistMode !== undefined) {
      if (meta.assistMode !== "quiet" && meta.assistMode !== "proactive") throw new NoteError("invalid", "Assistance mode must be quiet or proactive.");
      this.db.prepare("UPDATE notes SET assist_mode = ? WHERE id = ?").run(meta.assistMode, id);
    }
  }

  search(q: unknown): { id: string; path: string; title: string; snippet: string }[] {
    if (typeof q !== "string") return [];
    const tokens = q.match(/[\p{L}\p{N}_]+/gu)?.slice(0, 8) ?? [];
    if (tokens.length === 0) return [];
    const match = tokens.map((t) => `"${t}"*`).join(" ");
    return this.db
      .prepare(
        `SELECT n.id AS id, n.path AS path, n.title AS title, snippet(note_fts, 2, '[', ']', '…', 10) AS snippet
         FROM note_fts JOIN notes n ON n.id = note_fts.id
         WHERE note_fts MATCH ? AND n.deleted_at IS NULL
         ORDER BY rank LIMIT 50`,
      )
      .all(match) as { id: string; path: string; title: string; snippet: string }[];
  }

  /** Copy every live note as plain Markdown into exports/<timestamp>. Sources are untouched. */
  exportMarkdown(): { dir: string; count: number } {
    this.sync({ deep: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(this.exportDir, stamp);
    const rows = this.db.prepare("SELECT path FROM notes WHERE deleted_at IS NULL").all() as { path: string }[];
    for (const { path: rel } of rows) {
      const from = resolveInside(this.root, rel);
      const to = path.join(dir, ...rel.split("/"));
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
    mkdirSync(dir, { recursive: true });
    return { dir, count: rows.length };
  }
}
