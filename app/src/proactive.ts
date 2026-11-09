import { randomUUID } from "node:crypto";
import type { Broker } from "./broker.ts";
import type { Feedback } from "./feedback.ts";
import type { NoteStore } from "./notes.ts";
import { ProviderError } from "./providers/types.ts";

export type Timers = { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void };
const realTimers: Timers = {
  set: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; },
  clear: (h) => clearTimeout(h as NodeJS.Timeout),
};

export type ProactiveOptions = {
  debounceMs: number;
  cooldownMs: number;
  minChars: number;
  maxRunsPerDay: number;
  now: () => number;
  timers: Timers;
};

type NoteState = { timer: unknown | null; lastRunAt: number | null; lastRunHash: string | null; requestId: string | null; lastError: string | null; lastCreated: number };

/**
 * Opt-in, budgeted background feedback. It never fires on typing alone:
 * it needs the global switch, a chosen connection, the note in Proactive
 * mode, enough text, a change since the last run, a quiet period, a
 * per-note cooldown and a daily cap. Everything is rechecked when the
 * timer fires and again before each outbound attempt. Switching a note to
 * quiet cancels its queued run and asks any in-flight request to abort.
 */
export class Proactive {
  private store: NoteStore;
  private feedback: Feedback;
  private broker: Broker;
  private opts: ProactiveOptions;
  private notes = new Map<string, NoteState>();
  private runs: number[] = [];

  constructor(store: NoteStore, feedback: Feedback, broker: Broker, opts: Partial<ProactiveOptions> = {}) {
    this.store = store;
    this.feedback = feedback;
    this.broker = broker;
    this.opts = { debounceMs: 20_000, cooldownMs: 300_000, minChars: 200, maxRunsPerDay: 10, now: () => Date.now(), timers: realTimers, ...opts };
  }

  private state(noteId: string): NoteState {
    let s = this.notes.get(noteId);
    if (!s) { s = { timer: null, lastRunAt: null, lastRunHash: null, requestId: null, lastError: null, lastCreated: 0 }; this.notes.set(noteId, s); }
    return s;
  }

  private eligible(noteId: string): { ok: true; hash: string } | { ok: false; reason: string } {
    const cfg = this.feedback.getProactive();
    if (!cfg.enabled || !cfg.connectionId) return { ok: false, reason: "disabled" };
    let note;
    try { note = this.store.get(noteId); } catch { return { ok: false, reason: "no_note" }; }
    if (note.assistMode !== "proactive") return { ok: false, reason: "quiet" };
    if (note.content.length < this.opts.minChars) return { ok: false, reason: "too_short" };
    if (this.state(noteId).lastRunHash === note.hash) return { ok: false, reason: "unchanged" };
    const day = this.opts.now() - 86_400_000;
    this.runs = this.runs.filter((t) => t > day);
    if (this.runs.length >= this.opts.maxRunsPerDay) return { ok: false, reason: "daily_cap" };
    return { ok: true, hash: note.hash };
  }

  /** Called after the user saves an edit. Returns why nothing was scheduled, or "scheduled". */
  activity(noteId: string): string {
    const e = this.eligible(noteId);
    if (!e.ok) return e.reason;
    const s = this.state(noteId);
    if (s.timer) this.opts.timers.clear(s.timer);
    const sinceLast = s.lastRunAt === null ? Infinity : this.opts.now() - s.lastRunAt;
    const cfg = this.feedback.getProactive();
    const factor = this.feedback.cooldownFactor(cfg.personaId ?? this.feedback.notePersonaId(noteId));
    const delay = Math.max(this.opts.debounceMs, this.opts.cooldownMs * factor - sinceLast);
    s.timer = this.opts.timers.set(() => { s.timer = null; void this.run(noteId); }, delay);
    return "scheduled";
  }

  async run(noteId: string): Promise<{ ran: boolean; reason?: string; created?: number }> {
    const e = this.eligible(noteId);
    if (!e.ok) return { ran: false, reason: e.reason };
    const cfg = this.feedback.getProactive();
    const s = this.state(noteId);
    const requestId = "proactive-" + randomUUID();
    s.requestId = requestId;
    s.lastRunAt = this.opts.now();
    s.lastRunHash = e.hash;
    s.lastError = null;
    this.runs.push(this.opts.now());
    const stillAllowed = () => {
      const c = this.feedback.getProactive();
      const n = this.store.get(noteId);
      if (!c.enabled || n.assistMode !== "proactive") throw new ProviderError("cancelled", "Proactive feedback was turned off.");
    };
    try {
      const r = await this.feedback.generate({ noteId, connectionId: cfg.connectionId as string, personaId: cfg.personaId, requestId, source: "proactive", extraGuard: stillAllowed });
      s.lastCreated = r.created.length;
      return { ran: true, created: r.created.length, reason: r.stale ? "stale" : undefined };
    } catch (err) {
      s.lastError = err instanceof ProviderError ? err.code : "error";
      return { ran: true, reason: s.lastError };
    } finally {
      s.requestId = null;
    }
  }

  /** Quiet mode (or an unknown mode) invalidates queued work and aborts in-flight requests. */
  modeChanged(noteId: string): void {
    const s = this.notes.get(noteId);
    if (!s) return;
    let note;
    try { note = this.store.get(noteId); } catch { note = null; }
    if (note && note.assistMode === "proactive") return;
    if (s.timer) { this.opts.timers.clear(s.timer); s.timer = null; }
    if (s.requestId) this.broker.cancel(s.requestId);
  }

  /** Global switch turned off. */
  cancelAll(): void {
    for (const [id] of this.notes) {
      const s = this.notes.get(id) as NoteState;
      if (s.timer) { this.opts.timers.clear(s.timer); s.timer = null; }
      if (s.requestId) this.broker.cancel(s.requestId);
    }
  }

  status(noteId: string) {
    const s = this.notes.get(noteId);
    const e = this.eligible(noteId);
    return {
      queued: !!s?.timer,
      running: !!s?.requestId,
      lastRunAt: s?.lastRunAt ?? null,
      lastError: s?.lastError ?? null,
      lastCreated: s?.lastCreated ?? 0,
      blockedBy: e.ok ? null : e.reason,
      runsToday: this.runs.filter((t) => t > this.opts.now() - 86_400_000).length,
      maxRunsPerDay: this.opts.maxRunsPerDay,
    };
  }
}
