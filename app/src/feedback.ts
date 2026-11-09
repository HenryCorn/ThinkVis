import { createHash, randomUUID } from "node:crypto";
import { locate, makeAnchor } from "./anchors.ts";
import type { Anchor } from "./anchors.ts";
import { BrokerError } from "./broker.ts";
import type { Broker } from "./broker.ts";
import { NoteError } from "./notes.ts";
import type { NoteStore } from "./notes.ts";
import { ProviderError } from "./providers/types.ts";
import type { ChatMessage } from "./providers/types.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const KINDS = ["correction", "question", "suggestion"] as const;
type Kind = (typeof KINDS)[number];
const STATUSES = ["open", "resolved", "dismissed"] as const;
type Status = (typeof STATUSES)[number];
const PERSONA_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
export const DEFAULT_PERSONA = "builtin-tutor";
const MAX_FINDINGS = 3;

const BUILTINS = [
  { id: "builtin-tutor", name: "Helpful tutor", instructions: "Be warm and direct. Say what is wrong and why, in one or two sentences." },
  { id: "builtin-socratic", name: "Socratic", instructions: "Do not give the answer. Ask one guiding question that leads the learner to notice the problem themselves." },
  { id: "builtin-checker", name: "Fact checker", instructions: "Be concise and exact. State the correct fact, and say how certain you are when it is not settled." },
];

export type ProactiveSettings = { enabled: boolean; connectionId: string | null; personaId: string | null };

export const VOICES = ["plain", "warm", "blunt", "playful"] as const;
export const FREQUENCIES = ["rarely", "when-it-matters", "often"] as const;
/** Multiplies the proactive cooldown: rarely waits longer, often waits less. */
const FREQUENCY_FACTOR: Record<string, number> = { rarely: 3, "when-it-matters": 1, often: 0.5 };
type PersonaRow = { id: string; builtin: number; version: number; name: string; instructions: string; voice: string; frequency: string; updated_at: string; archived_at: string | null };
type FbRow = {
  id: string; note_id: string; note_hash: string; quote: string; anchor_start: number; anchor_end: number; anchor_prefix: string; anchor_suffix: string;
  kind: Kind; body: string; status: Status; source: "requested" | "proactive"; persona_id: string | null; persona_version: number | null;
  connection_id: string | null; provider: string | null; billing: string | null; model: string | null; created_at: string; resolved_at: string | null;
};

export type Rejection = { reason: string; count: number };

/** Parse the model's JSON. Top-level malformation rejects everything; bad findings are dropped one by one. */
export function parseFindings(text: string): { kind: Kind; quote: string; comment: string }[] & { bad: number } {
  const stripped = text.replace(/```(?:json)?/gi, "");
  const a = stripped.indexOf("{");
  const b = stripped.lastIndexOf("}");
  if (a < 0 || b <= a) throw new ProviderError("invalid_output", "The model did not return the expected JSON.");
  let parsed: any;
  try {
    parsed = JSON.parse(stripped.slice(a, b + 1));
  } catch {
    throw new ProviderError("invalid_output", "The model did not return valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.findings)) throw new ProviderError("invalid_output", "The model's JSON had no findings list.");
  if (parsed.findings.length > 10) throw new ProviderError("invalid_output", "The model returned far too many findings.");
  let bad = 0;
  const out: { kind: Kind; quote: string; comment: string }[] = [];
  for (const f of parsed.findings) {
    if (!f || typeof f !== "object" || typeof f.quote !== "string" || typeof f.comment !== "string" || !KINDS.includes(f.kind)) { bad++; continue; }
    const comment = f.comment.trim();
    if (!comment || comment.length > 800) { bad++; continue; }
    out.push({ kind: f.kind, quote: f.quote, comment });
  }
  return Object.assign(out, { bad });
}

export class Feedback {
  private store: NoteStore;
  private broker: Broker;

  constructor(store: NoteStore, broker: Broker) {
    this.store = store;
    this.broker = broker;
    this.ensureBuiltins();
  }

  private get db() { return this.store.db; }

  // ---- personas -----------------------------------------------------------

  private ensureBuiltins(): void {
    const now = new Date().toISOString();
    for (const p of BUILTINS) {
      if (this.db.prepare("SELECT 1 FROM personas WHERE id = ?").get(p.id)) continue;
      this.db.prepare("INSERT INTO personas (id, builtin, version, name, instructions, created_at, updated_at) VALUES (?,?,?,?,?,?,?)").run(p.id, 1, 1, p.name, p.instructions, now, now);
      this.db.prepare("INSERT INTO persona_versions (persona_id, version, name, instructions, created_at) VALUES (?,?,?,?,?)").run(p.id, 1, p.name, p.instructions, now);
    }
  }

  listPersonas() {
    return (this.db.prepare("SELECT * FROM personas WHERE archived_at IS NULL ORDER BY builtin DESC, name COLLATE NOCASE").all() as PersonaRow[]).map((p) => ({
      id: p.id, builtin: !!p.builtin, version: p.version, name: p.name, instructions: p.instructions, voice: p.voice, frequency: p.frequency,
    }));
  }

  private checkPersonaFields(name: unknown, instructions: unknown, voice: unknown = "plain", frequency: unknown = "when-it-matters"): { name: string; instructions: string; voice: string; frequency: string } {
    if (typeof voice !== "string" || !(VOICES as readonly string[]).includes(voice)) throw new BrokerError("invalid", `Voice must be one of: ${VOICES.join(", ")}.`);
    if (typeof frequency !== "string" || !(FREQUENCIES as readonly string[]).includes(frequency)) throw new BrokerError("invalid", `Frequency must be one of: ${FREQUENCIES.join(", ")}.`);
    if (typeof name !== "string" || !name.trim() || name.length > 60) throw new BrokerError("invalid", "A persona needs a name up to 60 characters.");
    if (typeof instructions !== "string" || !instructions.trim() || instructions.length > 2000) throw new BrokerError("invalid", "Persona instructions must be 1 to 2000 characters.");
    return { name: name.trim(), instructions: instructions.trim(), voice, frequency };
  }

  createPersona(input: { name: unknown; instructions: unknown; voice?: unknown; frequency?: unknown }) {
    const f = this.checkPersonaFields(input.name, input.instructions, input.voice ?? "plain", input.frequency ?? "when-it-matters");
    const id = "custom-" + randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO personas (id, builtin, version, name, instructions, voice, frequency, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, 0, 1, f.name, f.instructions, f.voice, f.frequency, now, now);
    this.db.prepare("INSERT INTO persona_versions (persona_id, version, name, instructions, voice, frequency, created_at) VALUES (?,?,?,?,?,?,?)").run(id, 1, f.name, f.instructions, f.voice, f.frequency, now);
    return { id, version: 1 };
  }

  /** Editing creates a new version. Old feedback keeps pointing at the version that wrote it. */
  updatePersona(id: string, input: { name: unknown; instructions: unknown; voice?: unknown; frequency?: unknown }) {
    const p = this.db.prepare("SELECT * FROM personas WHERE id = ? AND archived_at IS NULL").get(id) as PersonaRow | undefined;
    if (!p) throw new BrokerError("not_found", "Persona not found.", 404);
    if (p.builtin) throw new BrokerError("invalid", "Built-in personas cannot be edited. Create your own copy.", 409);
    const f = this.checkPersonaFields(input.name, input.instructions, input.voice ?? p.voice, input.frequency ?? p.frequency);
    const version = p.version + 1;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE personas SET version=?, name=?, instructions=?, voice=?, frequency=?, updated_at=? WHERE id=?").run(version, f.name, f.instructions, f.voice, f.frequency, now, id);
    this.db.prepare("INSERT INTO persona_versions (persona_id, version, name, instructions, voice, frequency, created_at) VALUES (?,?,?,?,?,?,?)").run(id, version, f.name, f.instructions, f.voice, f.frequency, now);
    return { id, version };
  }

  private persona(id: string | null | undefined): PersonaRow {
    const pid = id ?? DEFAULT_PERSONA;
    if (!PERSONA_ID.test(pid)) throw new BrokerError("invalid", "Unknown persona.");
    const p = this.db.prepare("SELECT * FROM personas WHERE id = ? AND archived_at IS NULL").get(pid) as PersonaRow | undefined;
    if (!p) throw new BrokerError("not_found", "Persona not found.", 404);
    return p;
  }

  setNotePersona(noteId: string, personaId: unknown): void {
    this.store.get(noteId);
    if (personaId === null) { this.db.prepare("UPDATE notes SET persona_id = NULL WHERE id = ?").run(noteId); return; }
    if (typeof personaId !== "string") throw new BrokerError("invalid", "personaId must be text.");
    this.persona(personaId);
    this.db.prepare("UPDATE notes SET persona_id = ? WHERE id = ?").run(personaId, noteId);
  }

  /** Cooldown multiplier for a persona's intervention frequency. */
  cooldownFactor(personaId: string | null | undefined): number {
    try { return FREQUENCY_FACTOR[this.persona(personaId ?? DEFAULT_PERSONA).frequency] ?? 1; } catch { return 1; }
  }

  notePersonaId(noteId: string): string {
    const r = this.db.prepare("SELECT persona_id FROM notes WHERE id = ?").get(noteId) as { persona_id: string | null } | undefined;
    return r?.persona_id ?? DEFAULT_PERSONA;
  }

  // ---- proactive settings ---------------------------------------------------

  getProactive(): ProactiveSettings {
    const r = this.db.prepare("SELECT value FROM settings WHERE key = 'proactive'").get() as { value: string } | undefined;
    if (!r) return { enabled: false, connectionId: null, personaId: null };
    try {
      const v = JSON.parse(r.value);
      return { enabled: v.enabled === true, connectionId: typeof v.connectionId === "string" ? v.connectionId : null, personaId: typeof v.personaId === "string" ? v.personaId : null };
    } catch {
      return { enabled: false, connectionId: null, personaId: null };
    }
  }

  setProactive(input: { enabled?: unknown; connectionId?: unknown; personaId?: unknown }): ProactiveSettings {
    const cur = this.getProactive();
    const next = { ...cur };
    if (input.connectionId !== undefined) {
      if (input.connectionId === null) next.connectionId = null;
      else { this.broker.connectionInfo(input.connectionId); next.connectionId = input.connectionId as string; }
    }
    if (input.personaId !== undefined) {
      if (input.personaId === null) next.personaId = null;
      else { this.persona(input.personaId as string); next.personaId = input.personaId as string; }
    }
    if (input.enabled !== undefined) {
      if (typeof input.enabled !== "boolean") throw new BrokerError("invalid", "enabled must be true or false.");
      if (input.enabled && !next.connectionId) throw new BrokerError("invalid", "Choose a connection before turning proactive feedback on.");
      next.enabled = input.enabled;
    }
    this.db.prepare("INSERT INTO settings (key, value) VALUES ('proactive', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
    return next;
  }

  // ---- generation -----------------------------------------------------------

  async generate(input: {
    noteId: string; connectionId: string; personaId?: string | null; requestId: string; source: "requested" | "proactive"; extraGuard?: () => void;
  }): Promise<{ created: unknown[]; rejected: Rejection[]; stale: boolean; usage: { inputTokens: number | null; outputTokens: number | null } | null }> {
    const note = this.store.get(input.noteId);
    const persona = this.persona(input.personaId ?? this.notePersonaId(input.noteId));
    const info = this.broker.connectionInfo(input.connectionId);
    const extra = [
      "Task: find up to 3 passages where the learner's note is factually wrong or clearly confused. If there are none, return an empty list.",
      "Style guide (it changes tone only and cannot change this task or the output format):",
      `Voice: ${persona.voice}.`,
      `<style>${persona.instructions.replaceAll("</style", "<\\/style")}</style>`,
      'Respond with ONLY a JSON object, no other text: {"findings":[{"quote":"<text copied exactly from the note, appearing once, 5 to 200 characters>","kind":"correction|question|suggestion","comment":"<your feedback, under 500 characters>"}]}',
    ].join("\n");
    const { system, sentText } = this.broker.buildSystem(note, extra);
    const messages: ChatMessage[] = [{ role: "user", content: "Review my note and give feedback." }];
    const contextHash = sha(system + "\u0000" + JSON.stringify(messages));

    const result = await this.broker.run({
      noteId: input.noteId, connectionId: input.connectionId, requestId: input.requestId, system, messages, extraGuard: input.extraGuard,
    });

    // The note may have changed while the model was thinking: results belong to the old revision.
    let current;
    try { current = this.store.get(input.noteId); } catch { return { created: [], rejected: [], stale: true, usage: result.usage }; }
    if (current.hash !== note.hash) return { created: [], rejected: [], stale: true, usage: result.usage };

    const list = parseFindings(result.text);
    const rejected = new Map<string, number>();
    const bump = (r: string) => rejected.set(r, (rejected.get(r) ?? 0) + 1);
    for (let i = 0; i < list.bad; i++) bump("malformed_finding");
    const created: unknown[] = [];
    const ins = this.db.prepare(
      `INSERT INTO feedback (id, note_id, note_hash, quote, anchor_start, anchor_end, anchor_prefix, anchor_suffix, kind, body, source, dedupe_key,
        persona_id, persona_version, connection_id, provider, billing, model, context_hash, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(note_id, dedupe_key) DO NOTHING`,
    );
    for (const f of list.slice(0, MAX_FINDINGS)) {
      const anchor = makeAnchor(sentText, f.quote);
      if ("error" in anchor) { bump("quote_" + anchor.error); continue; }
      const id = randomUUID();
      const now = new Date().toISOString();
      const r = ins.run(
        id, input.noteId, note.hash, anchor.quote, anchor.start, anchor.end, anchor.prefix, anchor.suffix, f.kind, f.comment, input.source,
        sha(anchor.quote + "|" + f.kind), persona.id, persona.version, info.id, info.adapter, info.billing, info.model, contextHash, now,
      );
      if (r.changes === 0) { bump("duplicate"); continue; }
      created.push(this.get(id));
    }
    if (list.length > MAX_FINDINGS) rejected.set("over_limit", list.length - MAX_FINDINGS);
    return { created, rejected: [...rejected].map(([reason, count]) => ({ reason, count })), stale: false, usage: result.usage };
  }

  // ---- reading and state -----------------------------------------------------

  private shape(r: FbRow, content: string, hash: string) {
    const anchor: Anchor = { quote: r.quote, start: r.anchor_start, end: r.anchor_end, prefix: r.anchor_prefix, suffix: r.anchor_suffix };
    const replies = (this.db.prepare("SELECT COUNT(*) AS n FROM feedback_replies WHERE feedback_id = ?").get(r.id) as { n: number }).n;
    return {
      id: r.id, noteId: r.note_id, quote: r.quote, kind: r.kind, body: r.body, status: r.status, source: r.source,
      position: locate(content, anchor),
      freshness: r.note_hash === hash ? "current" : "stale",
      persona: r.persona_id ? { id: r.persona_id, version: r.persona_version } : null,
      provider: { connectionId: r.connection_id, adapter: r.provider, billing: r.billing, model: r.model },
      createdAt: r.created_at, resolvedAt: r.resolved_at, replies,
    };
  }

  list(noteId: string) {
    const note = this.store.get(noteId);
    const rows = this.db.prepare("SELECT * FROM feedback WHERE note_id = ? ORDER BY rowid").all(noteId) as FbRow[];
    return rows.map((r) => this.shape(r, note.content, note.hash));
  }

  private row(id: string): FbRow {
    const r = this.db.prepare("SELECT * FROM feedback WHERE id = ?").get(id) as FbRow | undefined;
    if (!r) throw new BrokerError("not_found", "Feedback not found.", 404);
    return r;
  }

  get(id: string) {
    const r = this.row(id);
    const note = this.store.get(r.note_id);
    const replies = this.db.prepare("SELECT id, role, content, provider, billing, model, created_at AS createdAt FROM feedback_replies WHERE feedback_id = ? ORDER BY rowid").all(id);
    return { ...this.shape(r, note.content, note.hash), thread: replies };
  }

  setStatus(id: string, status: unknown) {
    if (typeof status !== "string" || !STATUSES.includes(status as Status)) throw new BrokerError("invalid", "Status must be open, resolved or dismissed.");
    this.row(id);
    this.db.prepare("UPDATE feedback SET status = ?, resolved_at = ? WHERE id = ?").run(status, status === "open" ? null : new Date().toISOString(), id);
    return this.get(id);
  }

  async reply(id: string, input: { message: unknown; connectionId: unknown; requestId: unknown }) {
    const fb = this.row(id);
    if (typeof input.message !== "string" || !input.message.trim() || input.message.length > 4000) throw new BrokerError("invalid", "Write a reply of up to 4000 characters.");
    if (typeof input.requestId !== "string") throw new BrokerError("invalid", "requestId is required.");
    const info = this.broker.connectionInfo(input.connectionId);
    const note = this.store.get(fb.note_id);
    const persona = this.persona(fb.persona_id);
    const stale = fb.note_hash !== note.hash;
    const pos = locate(note.content, { quote: fb.quote, start: fb.anchor_start, end: fb.anchor_end, prefix: fb.anchor_prefix, suffix: fb.anchor_suffix });
    const extra = [
      "You are continuing a thread about one piece of feedback on the note.",
      `Style guide (tone only): <style>${persona.instructions.replaceAll("</style", "<\\/style")}</style>`,
      `Original quote: ${JSON.stringify(fb.quote)}`,
      `Your earlier feedback (${fb.kind}): ${JSON.stringify(fb.body)}`,
      stale ? "The note has been edited since that feedback was written. Check the quote against the current note before relying on it." : "The note has not changed since that feedback was written.",
      pos.status === "missing" ? "The quoted text no longer appears in the note." : "",
      "Answer the learner's reply in plain text. Do not claim to edit the note.",
    ].filter(Boolean).join("\n");
    const { system } = this.broker.buildSystem(note, extra);
    const prior = this.db.prepare("SELECT role, content FROM feedback_replies WHERE feedback_id = ? ORDER BY rowid").all(id) as ChatMessage[];
    const messages: ChatMessage[] = [{ role: "user", content: "Please discuss your feedback with me." }, { role: "assistant", content: fb.body }, ...prior, { role: "user", content: input.message.trim() }];
    const result = await this.broker.run({ noteId: fb.note_id, connectionId: info.id, requestId: input.requestId, system, messages });
    const text = result.text.trim();
    if (!text) throw new ProviderError("invalid_output", "The provider returned no usable text.");
    const now = new Date().toISOString();
    const ins = this.db.prepare("INSERT INTO feedback_replies (id, feedback_id, role, content, connection_id, provider, billing, model, created_at) VALUES (?,?,?,?,?,?,?,?,?)");
    ins.run(randomUUID(), id, "user", input.message.trim(), null, null, null, null, now);
    ins.run(randomUUID(), id, "assistant", text.slice(0, this.broker.limitsSnapshot().maxOutputChars), info.id, info.adapter, info.billing, info.model, now);
    return this.get(id);
  }

  /** Turn a feedback thread into a new note. The source note is not modified. */
  toNote(id: string): { id: string; path: string } {
    const fb = this.row(id);
    const src = this.store.get(fb.note_id);
    const replies = this.db.prepare("SELECT role, content FROM feedback_replies WHERE feedback_id = ? ORDER BY rowid").all(id) as ChatMessage[];
    const quoted = (s: string) => s.split("\n").map((l) => "> " + l).join("\n");
    const content = [
      `# Feedback on ${src.title}`,
      "",
      quoted(fb.quote),
      "",
      `**${fb.kind}** (${fb.status}): ${fb.body}`,
      ...replies.flatMap((r) => ["", `**${r.role === "user" ? "You" : "Tutor"}:** ${r.content}`]),
      "",
      `Source note: ${src.path}`,
      "",
    ].join("\n");
    const slug = fb.quote.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "feedback";
    for (let n = 1; n <= 50; n++) {
      const rel = `From feedback/${slug}${n > 1 ? "-" + n : ""}.md`;
      try {
        const made = this.store.create({ path: rel, content });
        return { id: made.id, path: rel };
      } catch (e) {
        if (!(e instanceof NoteError && e.code === "exists")) throw e;
      }
    }
    throw new BrokerError("conflict", "Too many notes with that name.", 409);
  }

  /** Feedback block appended to an exported copy of a note. Includes resolved and dismissed items; the source note is never touched. */
  exportSection(noteId: string): string {
    const items = this.list(noteId);
    if (!items.length) return "";
    const lines = ["", "", "---", "## Feedback", ""];
    for (const f of items) {
      lines.push(`- **${f.kind}** (${f.status}${f.freshness === "stale" ? ", written for an earlier version" : ""}) on “${f.quote.replace(/\s+/g, " ")}”: ${f.body.replace(/\s+/g, " ")}`);
    }
    return lines.join("\n") + "\n";
  }
}

