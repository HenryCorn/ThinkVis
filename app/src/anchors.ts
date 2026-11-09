/**
 * Quote anchors. A feedback item stores the exact quote it is about, its
 * offsets and a little surrounding text at the revision it was written for.
 * Later we answer two separate questions:
 *   position: where is that quote in the note now? exact, moved, ambiguous or missing.
 *   freshness: is the note still the revision the feedback was written for?
 * An exact quote does not mean the feedback is still current.
 */
export type Anchor = { quote: string; start: number; end: number; prefix: string; suffix: string };
export type PositionStatus = "exact" | "moved" | "ambiguous" | "missing";
export type Position = { status: PositionStatus; start: number | null; end: number | null };

const CONTEXT = 40;

export function occurrences(text: string, quote: string): number[] {
  const out: number[] = [];
  if (!quote) return out;
  let i = text.indexOf(quote);
  while (i !== -1) {
    out.push(i);
    i = text.indexOf(quote, i + 1);
  }
  return out;
}

/** Returns an anchor only if the quote occurs exactly once. Ambiguous or absent quotes are refused. */
export function makeAnchor(text: string, quote: string): Anchor | { error: "missing" | "ambiguous" | "too_short" | "too_long" } {
  if (quote.trim().length < 3) return { error: "too_short" };
  if (quote.length > 400) return { error: "too_long" };
  const at = occurrences(text, quote);
  if (at.length === 0) return { error: "missing" };
  if (at.length > 1) return { error: "ambiguous" };
  const start = at[0];
  const end = start + quote.length;
  return { quote, start, end, prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT) };
}

function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** Locate an anchor in the current text. Never guesses between equally good candidates. */
export function locate(text: string, a: Anchor): Position {
  // Same offsets and same text: still exact, even if the quote now also appears elsewhere.
  if (text.slice(a.start, a.end) === a.quote) return { status: "exact", start: a.start, end: a.end };
  const at = occurrences(text, a.quote);
  if (at.length === 0) return { status: "missing", start: null, end: null };
  if (at.length === 1) return { status: "moved", start: at[0], end: at[0] + a.quote.length };
  const scored = at.map((s) => ({
    s,
    score: commonSuffixLen(text.slice(Math.max(0, s - CONTEXT), s), a.prefix) + commonPrefixLen(text.slice(s + a.quote.length, s + a.quote.length + CONTEXT), a.suffix),
  }));
  scored.sort((x, y) => y.score - x.score);
  if (scored[0].score > 0 && scored[0].score > scored[1].score) return { status: "moved", start: scored[0].s, end: scored[0].s + a.quote.length };
  return { status: "ambiguous", start: null, end: null };
}
