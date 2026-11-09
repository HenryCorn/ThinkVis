import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// The file is a classic browser script; load it the way a browser would.
const sandbox: any = {};
vm.runInNewContext(readFileSync(new URL("../public/diagram.js", import.meta.url), "utf8"), sandbox);
const D = sandbox.ThinkVisDiagram;

test("parses nodes, shapes, chains and edge labels", () => {
  const r = D.parseDiagram('flowchart TD\nA[Start] --> B{Is it?}\nB -->|yes| C(Done) --> D["x [y]"]\nB -.-> A');
  assert.ok(r.ok, r.error);
  const d = r.diagram;
  assert.equal(d.dir, "TD");
  assert.deepEqual(JSON.parse(JSON.stringify(d.nodes.map((n: any) => [n.id, n.shape, n.label]))), [["A", "rect", "Start"], ["B", "diamond", "Is it?"], ["C", "round", "Done"], ["D", "rect", "x [y]"]]);
  assert.equal(d.edges.length, 4);
  assert.equal(d.edges[1].label, "yes");
  assert.equal(d.edges[3].style, "dotted");
});

test("accepts graph LR and semicolons, ignores comments", () => {
  const r = D.parseDiagram("graph LR; A-->B; %% note\nB---C");
  assert.ok(r.ok, r.error);
  assert.equal(r.diagram.dir, "LR");
  assert.equal(r.diagram.edges[1].arrow, false);
});

test("rejects what it does not support, with a reason", () => {
  assert.match(D.parseDiagram("sequenceDiagram\nA->>B: hi").error, /Only flowcharts/);
  assert.match(D.parseDiagram("flowchart TD\nsubgraph x\nend").error, /not supported/);
  assert.match(D.parseDiagram("flowchart TD\nA[open --> B").error, /Missing \]/);
  assert.match(D.parseDiagram("flowchart TD\nA ~~> B").error, /Expected a connection/);
  assert.match(D.parseDiagram("flowchart TD").error, /no nodes/);
  assert.match(D.parseDiagram("x".repeat(7000)).error, /too long/);
});

test("enforces node and label limits", () => {
  const many = "flowchart TD\n" + Array.from({ length: 45 }, (_, i) => `N${i} --> N${i + 1}`).join("\n");
  assert.match(D.parseDiagram(many).error, /Too many nodes/);
  assert.match(D.parseDiagram("flowchart TD\nA[" + "w".repeat(90) + "] --> B").error, /longer than/);
});

test("layout puts later steps lower (TD) or further right (LR), and survives cycles", () => {
  const td = D.parseDiagram("flowchart TD\nA-->B-->C\nC-->A\nA-->C").diagram;
  D.layout(td);
  const [a, b, c] = ["A", "B", "C"].map((id) => td.nodes.find((n: any) => n.id === id));
  assert.ok(a.y < b.y && b.y < c.y);
  const lr = D.parseDiagram("flowchart LR\nA-->B").diagram;
  D.layout(lr);
  assert.ok(lr.nodes[0].x < lr.nodes[1].x);
  assert.equal(lr.nodes[0].y, lr.nodes[1].y);
});

test("splits fenced diagram blocks from text", () => {
  const parts = D.splitFences("before\n```mermaid\nflowchart TD\nA-->B\n```\nafter ```js\nx\n```");
  assert.deepEqual(JSON.parse(JSON.stringify(parts.map((p: any) => p.type))), ["text", "diagram", "text"]);
  assert.match(parts[1].text, /A-->B/);
});

// Minimal DOM stand-in: checks that labels only ever reach textContent.
function fakeDoc() {
  const make = (tag: string): any => ({ tag, attrs: {} as Record<string, string>, children: [] as any[], style: {}, textContent: "", setAttribute(k: string, v: string) { this.attrs[k] = v; }, appendChild(c: any) { this.children.push(c); return c; } });
  return { createElementNS: (_n: string, t: string) => make(t), createElement: make, createTextNode: (t: string) => ({ tag: "#text", textContent: t }), createDocumentFragment: () => make("#frag") };
}
const walk = (n: any, f: (n: any) => void) => { f(n); (n.children || []).forEach((c: any) => walk(c, f)); };

test("render never treats labels as markup", () => {
  const evil = '<img src=x onerror=alert(1)>';
  const r = D.parseDiagram(`flowchart TD\nA["${evil}"] -->|"${evil}"| B`);
  assert.ok(r.ok, r.error);
  const svg = D.renderDiagram(fakeDoc(), r.diagram);
  const texts: string[] = [];
  walk(svg, (n) => { if (n.tag === "text") texts.push(n.textContent); if (n.attrs) for (const v of Object.values(n.attrs)) assert.ok(!String(v).includes("onerror") || n.attrs["aria-label"] !== undefined); });
  assert.ok(texts.some((t) => t.includes("<img")));
  assert.equal(svg.tag, "svg");
});

test("richContent shows an error plus source for a bad diagram", () => {
  const frag = D.richContent(fakeDoc(), "hi\n```mermaid\nnot a diagram\n```");
  const all: string[] = [];
  walk(frag, (n) => all.push(n.textContent));
  assert.ok(all.some((t) => /Could not draw/.test(t)));
  assert.ok(all.some((t) => t === "not a diagram"));
});
