import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { Broker } from "../src/broker.ts";
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
  const broker = new Broker(store, [
    { id: "mock-echo", adapter: "mock", label: "Mock", model: "mock-echo" },
    { id: "mock-auth", adapter: "mock", label: "Mock auth failure", model: "mock-auth" },
  ], {
    mockReply: (req) => (req.system.includes("Respond with ONLY a JSON object")
      ? JSON.stringify({ findings: [{ quote: "photosynthesis happens in the nucleus", kind: "correction", comment: "Chloroplasts do that." }] })
      : undefined),
  });
  ({ server } = createApp(store, { token, broker }));
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

  it("chat: lists connections, previews, sends, stores the thread, maps provider errors", async () => {
    const post = (p: string, b: unknown) => fetch(`${base}${p}`, { method: "POST", headers: json, body: JSON.stringify(b) });
    const note = await (await post("/api/notes", { path: "chat/Note.md", content: "# Chat\nbody" })).json();

    const list = await (await fetch(`${base}/api/connections`, { headers: { Cookie: cookie } })).json();
    assert.deepEqual(list.connections.map((c: any) => c.id), ["mock-echo", "mock-auth"]);
    assert.ok(!JSON.stringify(list).match(/key|secret|token/i));

    const prev = await post("/api/chat/preview", { noteId: note.id, message: "hi", connectionId: "mock-echo" });
    assert.equal(prev.status, 200);
    assert.deepEqual((await prev.json()).manifest.tools, []);

    const sent = await post("/api/chat/send", { noteId: note.id, message: "hi", connectionId: "mock-echo", requestId: "http-test-0001" });
    assert.equal(sent.status, 200);
    assert.equal((await sent.json()).assistant.provider, "mock");

    const thread = await (await fetch(`${base}/api/notes/${note.id}/thread`, { headers: { Cookie: cookie } })).json();
    assert.equal(thread.messages.length, 2);

    const bad = await post("/api/chat/send", { noteId: note.id, message: "hi", connectionId: "mock-auth", requestId: "http-test-0002" });
    assert.equal(bad.status, 502);
    assert.equal((await bad.json()).code, "auth");

    const noConn = await post("/api/chat/send", { noteId: note.id, message: "hi", connectionId: "nope", requestId: "http-test-0003" });
    assert.equal(noConn.status, 404);

    const noCsrf = await fetch(`${base}/api/chat/send`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(noCsrf.status, 403);
    assert.deepEqual(await (await post("/api/chat/cancel", { requestId: "http-test-9999" })).json(), { cancelled: false });
  });

  it("feedback: generate, list, resolve, reply, personas, proactive settings and export", async () => {
    const post = (p: string, b: unknown) => fetch(`${base}${p}`, { method: "POST", headers: json, body: JSON.stringify(b) });
    const send = (m: string, p: string, b: unknown) => fetch(`${base}${p}`, { method: m, headers: json, body: JSON.stringify(b) });
    const get = async (p: string) => (await fetch(`${base}${p}`, { headers: { Cookie: cookie } })).json();
    const note = await (await post("/api/notes", { path: "fb/Note.md", content: "# Bio\nI think photosynthesis happens in the nucleus.\n" })).json();

    const g = await post(`/api/notes/${note.id}/feedback/generate`, { connectionId: "mock-echo", requestId: "http-fb-00001" });
    assert.equal(g.status, 200);
    assert.equal((await g.json()).created.length, 1);

    const listed = await get(`/api/notes/${note.id}/feedback`);
    assert.equal(listed.feedback.length, 1);
    assert.equal(listed.feedback[0].position.status, "exact");
    assert.equal(listed.proactive.blockedBy, "disabled");
    const fid = listed.feedback[0].id;

    const rep = await post(`/api/feedback/${fid}/reply`, { message: "why?", connectionId: "mock-echo", requestId: "http-fb-00002" });
    assert.equal(rep.status, 200);
    assert.equal((await rep.json()).thread.length, 2);

    const res = await send("PATCH", `/api/feedback/${fid}`, { status: "resolved" });
    assert.equal((await res.json()).status, "resolved");
    assert.equal((await send("PATCH", `/api/feedback/${fid}`, { status: "bogus" })).status, 400);

    const personas = await get("/api/personas");
    assert.ok(personas.personas.some((p: any) => p.id === "builtin-socratic"));
    const created = await (await post("/api/personas", { name: "Mine", instructions: "Be brief." })).json();
    assert.equal((await send("PUT", `/api/personas/${created.id}`, { name: "Mine", instructions: "Be briefer." })).status, 200);
    assert.equal((await send("PATCH", `/api/notes/${note.id}`, { personaId: created.id })).status, 200);
    assert.equal((await get(`/api/notes/${note.id}/feedback`)).personaId, created.id);

    assert.equal((await send("PUT", "/api/settings/proactive", { enabled: true })).status, 400, "needs a connection first");
    const on = await send("PUT", "/api/settings/proactive", { connectionId: "mock-echo", enabled: true });
    assert.equal((await on.json()).enabled, true);
    await send("PATCH", `/api/notes/${note.id}`, { assistMode: "proactive" });
    const act = await post(`/api/notes/${note.id}/activity`, {});
    assert.equal((await act.json()).state, "too_short");
    await send("PUT", "/api/settings/proactive", { enabled: false });

    const exp = await (await post("/api/export", {})).json();
    const { readFileSync } = await import("node:fs");
    assert.match(readFileSync(path.join(exp.dir, "fb", "Note.md"), "utf8"), /## Feedback/);
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
