import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NoteError, NoteStore } from "../src/notes.ts";
import { PathError, resolveInside, safeRelPath } from "../src/paths.ts";

let dir: string;
let store: NoteStore;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "thinkvis-"));
  store = new NoteStore(dir);
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const disk = (rel: string) => path.join(store.root, ...rel.split("/"));

describe("path safety", () => {
  it("rejects traversal, absolute, hidden, reserved and malformed paths", () => {
    for (const bad of ["../x.md", "a/../../x.md", "/etc/x.md", "C:\\x.md", "C:/x.md", ".hidden/x.md", "a//b.md", "con.md", "a/b.md.", "x\0.md", "a:b.md", "", "no-extension"]) {
      assert.throws(() => safeRelPath(bad, { markdown: true }), PathError, `should reject ${JSON.stringify(bad)}`);
    }
    assert.equal(safeRelPath("Folder\\Sub/Note.md", { markdown: true }), "Folder/Sub/Note.md");
  });

  it("does not follow symlinks or junctions", (t) => {
    const outside = mkdtempSync(path.join(tmpdir(), "thinkvis-outside-"));
    try {
      try {
        symlinkSync(outside, disk("link"), "junction");
      } catch {
        t.skip("cannot create symlink on this machine");
        return;
      }
      assert.throws(() => resolveInside(store.root, "link/evil.md"), PathError);
      assert.throws(() => store.create({ path: "link/evil.md", content: "x" }), PathError);
      assert.equal(readdirSync(outside).length, 0);
      store.sync({ deep: true });
      assert.equal(store.listAll().notes.length, 0);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("notes", () => {
  it("round-trips unsupported Markdown byte for byte", () => {
    const odd = "\uFEFF---\nfm: [1,2]\n---\r\n# Title  \r\n<div onclick=\"x\">raw html</div>\r\n\r\n| a | b |\n|--|--|\n\ttabbed\u00a0nbsp  \n$$ math $$\n[[wiki link]] ![[embed.png]]\n\n\n";
    const { id } = store.create({ path: "odd/Weird.md", content: odd });
    const got = store.get(id);
    assert.equal(got.content, odd);
    store.save(id, got.content, got.hash);
    assert.equal(readFileSync(disk("odd/Weird.md"), "utf8"), odd);
    assert.equal(Buffer.compare(readFileSync(disk("odd/Weird.md")), Buffer.from(odd, "utf8")), 0);
  });

  it("create never overwrites an existing file", () => {
    store.create({ path: "a.md", content: "one" });
    assert.throws(() => store.create({ path: "a.md", content: "two" }), (e: unknown) => e instanceof NoteError && e.code === "exists");
    assert.equal(readFileSync(disk("a.md"), "utf8"), "one");
  });

  it("detects an external edit and refuses a stale save", () => {
    const { id, hash } = store.create({ path: "a.md", content: "mine" });
    writeFileSync(disk("a.md"), "edited elsewhere");
    assert.throws(
      () => store.save(id, "my newer text", hash),
      (e: unknown) => e instanceof NoteError && e.code === "conflict" && e.detail.currentContent === "edited elsewhere",
    );
    assert.equal(readFileSync(disk("a.md"), "utf8"), "edited elsewhere");
    const fresh = store.get(id);
    assert.equal(fresh.content, "edited elsewhere");
    assert.equal(fresh.externallyChanged, false, "conflict path already reindexed the new content");
  });

  it("get reports an external edit once", () => {
    const { id } = store.create({ path: "a.md", content: "v1" });
    writeFileSync(disk("a.md"), "v2");
    assert.equal(store.get(id).externallyChanged, true);
    assert.equal(store.get(id).externallyChanged, false);
  });

  it("keeps the note id when a file is renamed outside the app", () => {
    const { id } = store.create({ path: "a.md", content: "same content" });
    mkdirSync(disk("sub"));
    renameSync(disk("a.md"), disk("sub/b.md"));
    const list = store.listAll();
    assert.equal(list.notes.length, 1);
    assert.equal(list.notes[0].id, id);
    assert.equal(list.notes[0].path, "sub/b.md");
  });

  it("indexes files added outside the app and marks removed ones deleted without touching other files", () => {
    writeFileSync(disk("new.md"), "# Brought in\nbody");
    const { id } = store.create({ path: "keep.md", content: "keep" });
    store.sync();
    assert.deepEqual(store.listAll().notes.map((n) => n.path).sort(), ["keep.md", "new.md"]);
    rmSync(disk("keep.md"));
    assert.deepEqual(store.listAll().notes.map((n) => n.path), ["new.md"]);
    assert.throws(() => store.get(id), (e: unknown) => e instanceof NoteError && e.code === "not_found");
    assert.ok(existsSync(disk("new.md")));
  });

  it("delete moves the file to .trash instead of destroying it", () => {
    const { id } = store.create({ path: "gone.md", content: "precious" });
    store.remove(id);
    assert.equal(existsSync(disk("gone.md")), false);
    const trashed = readdirSync(store.trashDir);
    assert.equal(trashed.length, 1);
    assert.equal(readFileSync(path.join(store.trashDir, trashed[0]), "utf8"), "precious");
    assert.equal(store.listAll().notes.length, 0);
  });

  it("move refuses to overwrite and keeps the id", () => {
    const a = store.create({ path: "a.md", content: "A" });
    store.create({ path: "b.md", content: "B" });
    assert.throws(() => store.move(a.id, "b.md"), (e: unknown) => e instanceof NoteError && e.code === "exists");
    store.move(a.id, "folder/c.md");
    assert.equal(store.get(a.id).path, "folder/c.md");
    assert.equal(readFileSync(disk("b.md"), "utf8"), "B");
  });

  it("survives restart: ids, metadata and search persist", () => {
    const { id } = store.create({ path: "r.md", content: "# Photosynthesis\nchlorophyll absorbs light" });
    store.setMeta(id, { purpose: "exam prep", assistMode: "proactive" });
    store.close();
    store = new NoteStore(dir);
    const n = store.get(id);
    assert.equal(n.purpose, "exam prep");
    assert.equal(n.assistMode, "proactive");
    assert.equal(store.search("chloro")[0].id, id);
  });

  it("removes crash leftovers (temp files) on startup and never indexes them", () => {
    store.close();
    writeFileSync(disk(".thinkvis-tmp-crash"), "half written");
    store = new NoteStore(dir);
    assert.equal(existsSync(disk(".thinkvis-tmp-crash")), false);
    assert.equal(store.listAll().notes.length, 0);
  });

  it("skips non-UTF-8 files without touching them", () => {
    const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x41]);
    writeFileSync(disk("bin.md"), bytes);
    store.sync({ deep: true });
    assert.equal(store.listAll().notes.length, 0);
    assert.deepEqual(store.skipped, ["bin.md"]);
    assert.equal(Buffer.compare(readFileSync(disk("bin.md")), bytes), 0);
  });

  it("search handles punctuation and FTS operators safely", () => {
    store.create({ path: "s.md", content: "alpha beta gamma" });
    assert.equal(store.search('alpha" beta *').length, 1);
    assert.equal(store.search("alpha OR zzz").length, 0, "operators are treated as plain words");
    assert.deepEqual(store.search("   "), []);
    assert.deepEqual(store.search("NEAR("), []);
    assert.deepEqual(store.search(42), []);
  });

  it("validates metadata", () => {
    const { id } = store.create({ path: "m.md", content: "" });
    assert.throws(() => store.setMeta(id, { assistMode: "loud" }), NoteError);
    assert.throws(() => store.setMeta(id, { purpose: "x".repeat(2001) }), NoteError);
  });

  it("export copies notes and leaves sources intact", () => {
    store.create({ path: "x/one.md", content: "1" });
    store.create({ path: "two.md", content: "2" });
    const r = store.exportMarkdown();
    assert.equal(r.count, 2);
    assert.equal(readFileSync(path.join(r.dir, "x", "one.md"), "utf8"), "1");
    assert.equal(readFileSync(disk("x/one.md"), "utf8"), "1");
    assert.equal(store.listAll().notes.length, 2, "exports folder is outside notes and is not re-imported");
  });
});
