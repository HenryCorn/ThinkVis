import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { NoteStore } from "../src/notes.ts";
import { createApp } from "../src/server.ts";

let dir: string;
let store: NoteStore;
let server: ReturnType<typeof createApp>["server"];
let base: string;
let port: number;
const token = "t".repeat(64);
const cookie = `tv=${token}`;
const json = { "Content-Type": "application/json", "X-ThinkVis": "1", Cookie: cookie };

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "thinkvis-srv-"));
  store = new NoteStore(dir);
  ({ server } = createApp(store, { token }));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("HTTP host", () => {
  it("rejects requests without the cookie", async () => {
    assert.equal((await fetch(`${base}/api/notes`)).status, 401);
    assert.equal((await fetch(`${base}/api/notes`, { headers: { Cookie: "tv=wrong" } })).status, 401);
    assert.equal((await fetch(`${base}/`)).status, 401);
  });

  it("exchanges the token for an HttpOnly SameSite cookie", async () => {
    const bad = await fetch(`${base}/?token=nope`, { redirect: "manual" });
    assert.equal(bad.status, 401);
    const ok = await fetch(`${base}/?token=${token}`, { redirect: "manual" });
    assert.equal(ok.status, 302);
    const sc = ok.headers.get("set-cookie") ?? "";
    assert.match(sc, /HttpOnly/);
    assert.match(sc, /SameSite=Strict/);
  });

  it("rejects a foreign Host header (DNS rebinding) and foreign Origin", async () => {
    // fetch() ignores a Host override, so use a raw http request.
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: "/api/notes", headers: { Cookie: cookie, Host: "evil.example" } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 403);
    const r2 = await fetch(`${base}/api/notes`, { headers: { Cookie: cookie, Origin: "http://evil.example" } });
    assert.equal(r2.status, 403);
  });

  it("requires the CSRF header and JSON content type for writes", async () => {
    const noHeader = await fetch(`${base}/api/notes`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(noHeader.status, 403);
    const form = await fetch(`${base}/api/notes`, { method: "POST", headers: { Cookie: cookie, "X-ThinkVis": "1", "Content-Type": "text/plain" }, body: "{}" });
    assert.equal(form.status, 415);
  });

  it("serves the app with a restrictive CSP", async () => {
    const r = await fetch(`${base}/`, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.match(await r.text(), /<title>ThinkVis<\/title>/);
  });

  it("creates, edits, detects conflicts, searches and deletes over the API", async () => {
    const created = await (await fetch(`${base}/api/notes`, { method: "POST", headers: json, body: JSON.stringify({ path: "api/Note.md", content: "# Hello\nneedle" }) })).json();
    assert.ok(created.id);

    const saved = await fetch(`${base}/api/notes/${created.id}`, { method: "PUT", headers: json, body: JSON.stringify({ content: "# Hello\nneedle two", baseHash: created.hash }) });
    assert.equal(saved.status, 200);

    const stale = await fetch(`${base}/api/notes/${created.id}`, { method: "PUT", headers: json, body: JSON.stringify({ content: "stale", baseHash: created.hash }) });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, "conflict");

    const found = await (await fetch(`${base}/api/search?q=needle`, { headers: { Cookie: cookie } })).json();
    assert.equal(found.results.length, 1);

    const del = await fetch(`${base}/api/notes/${created.id}`, { method: "DELETE", headers: json, body: "{}" });
    assert.equal(del.status, 200);
    assert.equal((await fetch(`${base}/api/notes/${created.id}`, { headers: { Cookie: cookie } })).status, 404);
  });

  it("returns 400 for traversal and bad ids, 404 for unknown routes", async () => {
    const trav = await fetch(`${base}/api/notes`, { method: "POST", headers: json, body: JSON.stringify({ path: "../escape.md", content: "x" }) });
    assert.equal(trav.status, 400);
    assert.equal((await fetch(`${base}/api/notes/not-a-uuid`, { headers: { Cookie: cookie } })).status, 404);
    assert.equal((await fetch(`${base}/api/nope`, { headers: { Cookie: cookie } })).status, 404);
    const bad = await fetch(`${base}/api/notes`, { method: "POST", headers: json, body: "[1]" });
    assert.equal(bad.status, 400);
  });
});
