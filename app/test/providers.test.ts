import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { anthropicAdapter } from "../src/providers/anthropic.ts";
import { googleAdapter } from "../src/providers/google.ts";
import { piAdapter } from "../src/providers/pi.ts";
import { ProviderError } from "../src/providers/types.ts";
import type { ChatRequest } from "../src/providers/types.ts";

const KEY = "sk-test-0123456789abcdef";
const req: ChatRequest = { system: "SYS", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }, { role: "user", content: "again" }], maxTokens: 100 };
const live = () => AbortSignal.timeout(5000);

function fakeFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    if (capture) { capture.url = url; capture.init = init; }
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}
const rejects = (p: Promise<unknown>, code: string, retryable?: boolean) =>
  assert.rejects(p, (e: unknown) => e instanceof ProviderError && e.code === code && (retryable === undefined || e.retryable === retryable));

describe("anthropic adapter", () => {
  it("sends the documented request, no tools, key only in a header", async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    const a = anthropicAdapter({ apiKey: () => KEY, fetch: fakeFetch(200, { content: [{ type: "text", text: "Hello " }, { type: "text", text: "there" }], stop_reason: "end_turn", usage: { input_tokens: 11, output_tokens: 3 } }, cap) });
    const r = await a.chat(req, { model: "some-model", signal: live() });
    assert.equal(r.text, "Hello there");
    assert.deepEqual(r.usage, { inputTokens: 11, outputTokens: 3 });
    assert.equal(cap.url, "https://api.anthropic.com/v1/messages");
    const headers = cap.init?.headers as Record<string, string>;
    assert.equal(headers["x-api-key"], KEY);
    assert.equal(headers["anthropic-version"], "2023-06-01");
    const body = JSON.parse(cap.init?.body as string);
    assert.deepEqual(Object.keys(body).sort(), ["max_tokens", "messages", "model", "system"]);
    assert.equal(body.tools, undefined);
    assert.ok(!cap.url?.includes(KEY) && !(cap.init?.body as string).includes(KEY));
  });

  it("maps HTTP failures to stable codes and never echoes upstream text or the key", async () => {
    const mk = (status: number, body: unknown = { error: { type: "x_error", message: `leaked ${KEY}` } }) => anthropicAdapter({ apiKey: () => KEY, fetch: fakeFetch(status, body) });
    await rejects(mk(401).chat(req, { model: "m", signal: live() }), "auth", false);
    await rejects(mk(429).chat(req, { model: "m", signal: live() }), "rate_limit", true);
    await rejects(mk(529).chat(req, { model: "m", signal: live() }), "unavailable", true);
    await rejects(mk(400).chat(req, { model: "m", signal: live() }), "bad_request", false);
    try {
      await mk(401).chat(req, { model: "m", signal: live() });
    } catch (e) {
      assert.ok(!(e as Error).message.includes(KEY));
      assert.ok(!(e as Error).message.includes("leaked"));
    }
  });

  it("rejects empty or tool-only output and bad keys without calling the network", async () => {
    await rejects(anthropicAdapter({ apiKey: () => KEY, fetch: fakeFetch(200, { content: [{ type: "tool_use", id: "t" }] }) }).chat(req, { model: "m", signal: live() }), "invalid_output");
    let called = false;
    const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
    await rejects(anthropicAdapter({ apiKey: () => undefined, fetch: f }).chat(req, { model: "m", signal: live() }), "not_configured");
    await rejects(anthropicAdapter({ apiKey: () => "bad key\nwith newline", fetch: f }).chat(req, { model: "m", signal: live() }), "not_configured");
    assert.equal(called, false);
  });

  it("reports cancel and timeout distinctly", async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("x", "AbortError"))))) as unknown as typeof fetch;
    const a = anthropicAdapter({ apiKey: () => KEY, fetch: hang });
    const c = new AbortController();
    const p1 = a.chat(req, { model: "m", signal: c.signal });
    c.abort(new DOMException("user", "AbortError"));
    await rejects(p1, "cancelled", false);
    await rejects(a.chat(req, { model: "m", signal: AbortSignal.timeout(20) }), "timeout", true);
  });
});

describe("google adapter", () => {
  it("maps roles, puts the key in a header, sends no tools", async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    const a = googleAdapter({ apiKey: () => KEY, fetch: fakeFetch(200, { candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 } }, cap) });
    const r = await a.chat(req, { model: "models/gem-1", signal: live() });
    assert.equal(r.text, "ok");
    assert.deepEqual(r.usage, { inputTokens: 5, outputTokens: 1 });
    assert.equal(cap.url, "https://generativelanguage.googleapis.com/v1beta/models/gem-1:generateContent");
    assert.equal((cap.init?.headers as Record<string, string>)["x-goog-api-key"], KEY);
    const body = JSON.parse(cap.init?.body as string);
    assert.deepEqual(body.contents.map((c: any) => c.role), ["user", "model", "user"]);
    assert.equal(body.systemInstruction.parts[0].text, "SYS");
    assert.equal(body.tools, undefined);
    assert.ok(!cap.url?.includes(KEY));
  });

  it("handles blocked, empty, failing and hostile model names", async () => {
    const mk = (status: number, body: unknown) => googleAdapter({ apiKey: () => KEY, fetch: fakeFetch(status, body) });
    await rejects(mk(200, { promptFeedback: { blockReason: "SAFETY" } }).chat(req, { model: "m", signal: live() }), "invalid_output");
    await rejects(mk(403, { error: { status: "PERMISSION_DENIED" } }).chat(req, { model: "m", signal: live() }), "auth");
    await rejects(mk(429, {}).chat(req, { model: "m", signal: live() }), "rate_limit", true);
    await rejects(mk(200, {}).chat(req, { model: "../../evil?x=1", signal: live() }), "bad_request");
  });
});

describe("pi bridge adapter (fake executable)", () => {
  const fake = path.resolve(import.meta.dirname, "fixtures", "fake-pi.mjs");
  const a = piAdapter({ command: [process.execPath, fake] });

  it("runs isolated: no tools or discovery, throwaway cwd, no secrets in env", async () => {
    process.env.THINKVIS_TEST_SECRET = "must-not-leak";
    try {
      const r = await a.chat(req, { model: "github-copilot/some-model", signal: live() });
      const seen = JSON.parse(r.text);
      for (const flag of ["-p", "--no-tools", "--no-session", "--no-extensions", "--no-mcp", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files", "--no-approve"]) {
        assert.ok(seen.args.includes(flag), `missing ${flag}`);
      }
      assert.equal(seen.leak, null);
      assert.ok(seen.cwd.includes("thinkvis-pi-"));
      assert.equal(seen.promptHasNote, true);
      assert.equal(r.usage, null);
    } finally {
      delete process.env.THINKVIS_TEST_SECRET;
    }
  });

  it("maps exit codes, empty output, start failure, bad model names and cancel", async () => {
    await rejects(a.chat(req, { model: "fail", signal: live() }), "unavailable");
    await rejects(a.chat(req, { model: "empty", signal: live() }), "invalid_output");
    await rejects(a.chat(req, { model: "--evil", signal: live() }), "bad_request");
    await rejects(piAdapter({ command: ["definitely-not-a-command-xyz"] }).chat(req, { model: "m", signal: live() }), "not_configured");
    const c = new AbortController();
    const p = a.chat(req, { model: "slow", signal: c.signal });
    setTimeout(() => c.abort(new DOMException("user", "AbortError")), 300);
    await rejects(p, "cancelled");
  });
});
