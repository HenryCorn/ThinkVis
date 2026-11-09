import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Broker, BrokerError, loadConnections } from "./broker.ts";
import { NoteError, NoteStore } from "./notes.ts";
import { PathError } from "./paths.ts";
import { ProviderError } from "./providers/types.ts";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public");
const STATIC: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BODY = 16 * 1024 * 1024;

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function send(res: http.ServerResponse, status: number, body: string | Buffer, type = "application/json; charset=utf-8", extra: Record<string, string> = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": type, ...extra });
  res.end(body);
}
const sendJson = (res: http.ServerResponse, status: number, value: unknown) => send(res, status, JSON.stringify(value));

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX_BODY) throw new NoteError("invalid", "Request body is too large.");
    chunks.push(chunk as Buffer);
  }
  if (total === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new NoteError("invalid", "Body is not valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new NoteError("invalid", "Body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

export function createApp(store: NoteStore, opts: { token?: string; broker?: Broker } = {}) {
  const broker = opts.broker ?? new Broker(store, []);
  const token = opts.token ?? randomBytes(32).toString("hex");

  const server = http.createServer(async (req, res) => {
    try {
      const port = (server.address() as AddressInfo | null)?.port;
      const host = req.headers.host ?? "";
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return sendJson(res, 403, { error: "Bad Host header." });
      const origin = req.headers.origin;
      if (origin !== undefined && origin !== `http://${host}`) return sendJson(res, 403, { error: "Bad Origin." });

      const url = new URL(req.url ?? "/", `http://${host}`);
      const method = req.method ?? "GET";

      // One-time token exchange: opens the app and sets an HttpOnly cookie.
      if (method === "GET" && url.pathname === "/" && url.searchParams.has("token")) {
        if (!safeEqual(url.searchParams.get("token") ?? "", token)) return sendJson(res, 401, { error: "Invalid token." });
        res.writeHead(302, { ...SECURITY_HEADERS, Location: "/", "Set-Cookie": `tv=${token}; HttpOnly; SameSite=Strict; Path=/` });
        return res.end();
      }

      const cookie = cookieValue(req.headers.cookie, "tv");
      if (!cookie || !safeEqual(cookie, token)) return sendJson(res, 401, { error: "Open the app with the link printed in the terminal." });

      if (method === "GET" && STATIC[url.pathname]) {
        const s = STATIC[url.pathname];
        return send(res, 200, readFileSync(path.join(PUBLIC_DIR, s.file)), s.type);
      }

      if (!url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Not found." });

      // CSRF guard: a custom header plus JSON content type cannot be sent cross-site without CORS preflight.
      if (method !== "GET") {
        if (req.headers["x-thinkvis"] !== "1") return sendJson(res, 403, { error: "Missing X-ThinkVis header." });
        if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) return sendJson(res, 415, { error: "Content-Type must be application/json." });
      }

      const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
      const [, resource, id] = parts;

      if (resource === "notes" && parts.length === 2) {
        if (method === "GET") return sendJson(res, 200, store.listAll());
        if (method === "POST") {
          const body = await readJson(req);
          return sendJson(res, 201, store.create({ path: body.path, content: body.content }));
        }
      }
      if (resource === "notes" && parts.length === 3) {
        if (!UUID.test(id)) return sendJson(res, 404, { error: "Not found." });
        if (method === "GET") return sendJson(res, 200, store.get(id));
        if (method === "PUT") {
          const body = await readJson(req);
          return sendJson(res, 200, store.save(id, body.content, body.baseHash));
        }
        if (method === "PATCH") {
          const body = await readJson(req);
          if (body.path !== undefined) store.move(id, body.path);
          if (body.purpose !== undefined || body.assistMode !== undefined) store.setMeta(id, body);
          return sendJson(res, 200, { ok: true });
        }
        if (method === "DELETE") {
          store.remove(id);
          return sendJson(res, 200, { ok: true });
        }
      }
      if (resource === "notes" && parts.length === 4 && parts[3] === "thread" && method === "GET") {
        if (!UUID.test(id)) return sendJson(res, 404, { error: "Not found." });
        return sendJson(res, 200, { messages: broker.thread(id) });
      }
      if (resource === "connections" && parts.length === 2 && method === "GET") {
        return sendJson(res, 200, { connections: broker.listConnections() });
      }
      if (resource === "chat" && parts.length === 3 && method === "POST") {
        const body = await readJson(req);
        if (parts[2] === "preview") return sendJson(res, 200, broker.preview(body as any));
        if (parts[2] === "cancel") return sendJson(res, 200, { cancelled: broker.cancel(body.requestId) });
        if (parts[2] === "send") return sendJson(res, 200, await broker.chat(body as any));
      }
      if (resource === "folders" && parts.length === 2 && method === "POST") {
        const body = await readJson(req);
        return sendJson(res, 201, store.createFolder(body.path));
      }
      if (resource === "search" && parts.length === 2 && method === "GET") {
        return sendJson(res, 200, { results: store.search(url.searchParams.get("q") ?? "") });
      }
      if (resource === "export" && parts.length === 2 && method === "POST") {
        return sendJson(res, 200, store.exportMarkdown());
      }
      return sendJson(res, 404, { error: "Not found." });
    } catch (e) {
      if (e instanceof NoteError) {
        const status = e.code === "not_found" ? 404 : e.code === "invalid" ? 400 : 409;
        return sendJson(res, status, { error: e.message, code: e.code, ...e.detail });
      }
      if (e instanceof PathError) return sendJson(res, 400, { error: e.message, code: "invalid" });
      if (e instanceof BrokerError) return sendJson(res, e.status, { error: e.message, code: e.code, ...e.detail });
      if (e instanceof ProviderError) {
        const status = e.code === "cancelled" ? 409 : e.code === "timeout" ? 504 : e.code === "not_configured" ? 409 : e.code === "rate_limit" ? 429 : 502;
        return sendJson(res, status, { error: e.message, code: e.code, retryable: e.retryable });
      }
      console.error(e);
      return sendJson(res, 500, { error: "Internal error." });
    }
  });

  return { server, token };
}

if (import.meta.main) {
  const dataDir = process.env.THINKVIS_DATA ?? path.resolve(import.meta.dirname, "..", "..", "app-data");
  const port = Number(process.env.THINKVIS_PORT ?? 4317);
  const store = new NoteStore(dataDir);
  const connectionsFile = path.join(store.dataDir, "connections.json");
  const broker = new Broker(store, loadConnections(connectionsFile), { enablePi: process.env.THINKVIS_ENABLE_PI_BRIDGE === "1" });
  const { server, token } = createApp(store, { broker });
  server.listen(port, "127.0.0.1", () => {
    const actual = (server.address() as AddressInfo).port;
    console.log(`ThinkVis data folder: ${store.dataDir}`);
    console.log(`Open: http://127.0.0.1:${actual}/?token=${token}`);
    const conns = broker.listConnections();
    console.log(conns.length ? conns.map((c) => `Connection ${c.id}: ${c.available ? "ready" : "unavailable (" + c.reason + ")"}`).join("\n") : `No AI connections. Add some to ${connectionsFile} (see app/connections.example.json).`);
    if (store.skipped.length) console.log(`Skipped ${store.skipped.length} file(s) that are not UTF-8 text or are too large.`);
  });
  const stop = () => server.close(() => { store.close(); process.exit(0); });
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
