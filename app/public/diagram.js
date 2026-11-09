/*
 * ThinkVis diagrams: a small, strict flowchart language (a subset of Mermaid's
 * flowchart syntax) that the app parses and lays out itself, so a model or the
 * learner can write a diagram as plain text inside a ```mermaid fence and the
 * app draws it. No libraries, nothing is ever inserted as HTML: every label goes
 * through textContent. Anything outside the subset is reported, never guessed at.
 *
 * Supported:  flowchart TD|TB|LR   (or "graph")
 *   A[Rectangle]  B(Rounded)  C{Decision}  D["Quoted [text]"]
 *   A --> B   A --- B   A -.-> B   A ==> B   A -->|label| B   A --> B --> C
 * Not supported (reported as errors): subgraph, styling, click, other diagram types.
 */
(function (root) {
  "use strict";

  const LIMITS = { nodes: 40, edges: 80, label: 80, source: 6000 };
  const ARROWS = [["-.->", "dotted", true], ["==>", "thick", true], ["-->", "solid", true], ["---", "solid", false]];
  const NS = "http://www.w3.org/2000/svg";

  function fail(error, line) { return { ok: false, error: line ? "Line " + line + ": " + error : error }; }

  function parseDiagram(source) {
    if (typeof source !== "string") return fail("No diagram text.");
    if (source.length > LIMITS.source) return fail("Diagram is too long (over " + LIMITS.source + " characters).");
    const lines = source.replace(/\r/g, "").split("\n");
    let dir = null;
    const nodes = new Map();
    const edges = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      for (const raw of lines[i].split(";")) {
        const line = raw.trim();
        if (!line || line.startsWith("%%")) continue;
        if (dir === null) {
          const m = /^(flowchart|graph)\s*(TD|TB|LR)?$/i.exec(line);
          if (!m) return fail('Only flowcharts are supported. Start with "flowchart TD" or "flowchart LR".', lineNo);
          dir = (m[2] || "TD").toUpperCase() === "LR" ? "LR" : "TD";
          continue;
        }
        if (/^(subgraph|end|style|classDef|class|click|linkStyle)\b/i.test(line)) return fail('"' + line.split(/\s/)[0] + '" is not supported.', lineNo);
        const r = parseStatement(line, nodes, edges);
        if (r) return fail(r, lineNo);
        if (nodes.size > LIMITS.nodes) return fail("Too many nodes (limit " + LIMITS.nodes + ").", lineNo);
        if (edges.length > LIMITS.edges) return fail("Too many connections (limit " + LIMITS.edges + ").", lineNo);
      }
    }
    if (dir === null) return fail("Empty diagram.");
    if (!nodes.size) return fail("The diagram has no nodes.");
    return { ok: true, diagram: { dir, nodes: [...nodes.values()], edges } };
  }

  /** Returns an error string, or null on success. */
  function parseStatement(line, nodes, edges) {
    let pos = 0;
    const ws = () => { while (pos < line.length && /\s/.test(line[pos])) pos++; };

    function readNode() {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(pos));
      if (!m) return { error: "Expected a node name at: " + line.slice(pos, pos + 12) };
      const id = m[0];
      pos += id.length;
      let shape = null, label = null;
      const open = line[pos];
      const close = open === "[" ? "]" : open === "(" ? ")" : open === "{" ? "}" : null;
      if (close) {
        shape = open === "[" ? "rect" : open === "(" ? "round" : "diamond";
        pos++;
        let text;
        if (line[pos] === '"') {
          const end = line.indexOf('"', pos + 1);
          if (end < 0) return { error: "Unclosed quote in a label." };
          text = line.slice(pos + 1, end);
          pos = end + 1;
          if (line[pos] !== close) return { error: "Expected " + close + " after the quoted label." };
          pos++;
        } else {
          const end = line.indexOf(close, pos);
          if (end < 0) return { error: "Missing " + close + " in a node label." };
          text = line.slice(pos, end);
          pos = end + 1;
        }
        label = text.replace(/<br\s*\/?>/gi, "\n").replace(/\s+/g, (s) => (s.includes("\n") ? "\n" : " ")).trim();
        if (!label) return { error: "A node label is empty." };
        if (label.length > LIMITS.label) return { error: "A label is longer than " + LIMITS.label + " characters." };
      }
      let n = nodes.get(id);
      if (!n) { n = { id, label: id, shape: "rect" }; nodes.set(id, n); }
      if (label !== null) { n.label = label; n.shape = shape; }
      return { id };
    }

    let prev = readNode();
    if (prev.error) return prev.error;
    ws();
    while (pos < line.length) {
      const arrow = ARROWS.find((a) => line.startsWith(a[0], pos));
      if (!arrow) return "Expected a connection (-->, ---, -.-> or ==>) at: " + line.slice(pos, pos + 12);
      pos += arrow[0].length;
      let label = "";
      if (line[pos] === "|") {
        const end = line.indexOf("|", pos + 1);
        if (end < 0) return "Missing closing | in a connection label.";
        label = line.slice(pos + 1, end).replace(/^"|"$/g, "").trim();
        if (label.length > LIMITS.label) return "A connection label is too long.";
        pos = end + 1;
      }
      ws();
      const next = readNode();
      if (next.error) return next.error;
      edges.push({ from: prev.id, to: next.id, label, style: arrow[1], arrow: arrow[2] });
      prev = next;
      ws();
    }
    return null;
  }

  // ---------- layout ----------
  function wrap(label) {
    const out = [];
    for (const part of label.split("\n")) {
      let cur = "";
      for (const w of part.split(" ")) {
        if (cur && (cur + " " + w).length > 22) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
      }
      out.push(cur);
    }
    return out;
  }

  function layout(d) {
    const byId = new Map();
    d.nodes.forEach((n) => {
      n.lines = wrap(n.label);
      const textW = Math.max(...n.lines.map((l) => l.length)) * 7.2;
      const textH = n.lines.length * 17;
      n.w = Math.max(60, textW + (n.shape === "diamond" ? 56 : 28));
      n.h = Math.max(36, textH + (n.shape === "diamond" ? 34 : 18));
      byId.set(n.id, n);
    });

    // Layers: longest path over the graph with back edges (cycles) ignored.
    const out = new Map(d.nodes.map((n) => [n.id, []]));
    d.edges.forEach((e) => { if (e.from !== e.to) out.get(e.from).push(e.to); });
    const state = new Map(), dag = new Map(d.nodes.map((n) => [n.id, []]));
    const visit = (id) => {
      state.set(id, 1);
      for (const to of out.get(id)) {
        if (state.get(to) === 1) continue;
        dag.get(id).push(to);
        if (!state.has(to)) visit(to);
      }
      state.set(id, 2);
    };
    d.nodes.forEach((n) => { if (!state.has(n.id)) visit(n.id); });
    const layer = new Map();
    const depthOf = (id, seen) => {
      if (layer.has(id)) return layer.get(id);
      let best = 0;
      for (const [from, tos] of dag) if (tos.includes(id)) best = Math.max(best, depthOf(from) + 1);
      layer.set(id, best);
      return best;
    };
    d.nodes.forEach((n) => depthOf(n.id));

    const layers = [];
    d.nodes.forEach((n) => { (layers[layer.get(n.id)] = layers[layer.get(n.id)] || []).push(n); });
    const pos = new Map();
    const reindex = () => layers.forEach((L) => L.forEach((n, i) => pos.set(n.id, i)));
    reindex();
    const neighbours = (n, up) => d.edges.filter((e) => (up ? e.to === n.id : e.from === n.id)).map((e) => byId.get(up ? e.from : e.to)).filter((m) => m && layer.get(m.id) === layer.get(n.id) + (up ? -1 : 1));
    for (let sweep = 0; sweep < 4; sweep++) {
      const down = sweep % 2 === 0;
      const order = down ? layers.map((_, i) => i) : layers.map((_, i) => layers.length - 1 - i);
      for (const li of order) {
        const L = layers[li];
        const key = new Map(L.map((n) => { const ns = neighbours(n, down); return [n.id, ns.length ? ns.reduce((s, m) => s + pos.get(m.id), 0) / ns.length : pos.get(n.id)]; }));
        L.sort((a, b) => key.get(a.id) - key.get(b.id) || pos.get(a.id) - pos.get(b.id));
        reindex();
      }
    }

    const TD = d.dir === "TD";
    const depthSize = (n) => (TD ? n.h : n.w), breadthSize = (n) => (TD ? n.w : n.h);
    const gapDepth = TD ? 54 : 80, gapBreadth = 28, pad = 20;
    const widths = layers.map((L) => L.reduce((s, n) => s + breadthSize(n), 0) + gapBreadth * (L.length - 1));
    const maxBreadth = Math.max(...widths);
    let depth = pad;
    layers.forEach((L, li) => {
      const thick = Math.max(...L.map(depthSize));
      let b = pad + (maxBreadth - widths[li]) / 2;
      L.forEach((n) => {
        const cd = depth + thick / 2, cb = b + breadthSize(n) / 2;
        n.x = TD ? cb : cd; n.y = TD ? cd : cb;
        b += breadthSize(n) + gapBreadth;
      });
      depth += thick + gapDepth;
    });
    const total = { w: (TD ? maxBreadth : depth - gapDepth) + pad * 2, h: (TD ? depth - gapDepth : maxBreadth) + pad * 2 };
    d.nodes.forEach((n) => { n.layer = layer.get(n.id); });
    return { byId, width: total.w, height: total.h };
  }

  function clip(n, dx, dy) {
    const a = n.w / 2, b = n.h / 2;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const t = n.shape === "diamond" ? 1 / (Math.abs(ux) / a + Math.abs(uy) / b) : Math.min(a / (Math.abs(ux) || 1e-9), b / (Math.abs(uy) || 1e-9));
    return { x: n.x + ux * t, y: n.y + uy * t };
  }

  // ---------- rendering (DOM only, text via textContent) ----------
  function s(doc, tag, attrs, text) {
    const e = doc.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function addLabel(svg, doc, label, mx, my) {
    const w = label.length * 6.6 + 10;
    svg.appendChild(s(doc, "rect", { x: mx - w / 2, y: my - 9, width: w, height: 18, rx: 4, class: "tv-labelbg" }));
    svg.appendChild(s(doc, "text", { x: mx, y: my + 4, "text-anchor": "middle", class: "tv-edgelabel" }, label));
  }

  function renderDiagram(doc, d) {
    const L = layout(d);
    const bowed = d.edges.some((e) => { const x = L.byId.get(e.from), y = L.byId.get(e.to); return x !== y && (Math.abs(x.layer - y.layer) !== 1 || y.layer < x.layer); });
    const m = bowed ? 70 : 0;
    const svg = s(doc, "svg", { viewBox: -m + " " + -m + " " + Math.ceil(L.width + 2 * m) + " " + Math.ceil(L.height + 2 * m), class: "tv-diagram", role: "img", "aria-label": "Diagram: " + d.nodes.map((n) => n.label.replace(/\n/g, " ")).join(", ") });
    svg.style.maxWidth = Math.ceil(L.width + 2 * m) + "px";
    const defs = s(doc, "defs", {});
    const marker = s(doc, "marker", { id: "tv-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
    marker.appendChild(s(doc, "path", { d: "M0 0 L10 5 L0 10 z", class: "tv-arrowhead" }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    const pairs = new Set(d.edges.map((e) => e.from + ">" + e.to));
    d.edges.forEach((e) => {
      const a = L.byId.get(e.from), b = L.byId.get(e.to);
      const cls = "tv-edge " + e.style;
      if (a === b) {
        const x = a.x + a.w / 2, y = a.y;
        svg.appendChild(s(doc, "path", { d: "M" + x + " " + (y - 8) + " C" + (x + 34) + " " + (y - 24) + " " + (x + 34) + " " + (y + 24) + " " + x + " " + (y + 8), class: cls, "marker-end": e.arrow ? "url(#tv-arrow)" : "none", fill: "none" }));
        return;
      }
      let dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      if (a.layer !== b.layer && Math.abs(a.layer - b.layer) !== 1 || b.layer < a.layer) {
        // Backward or layer-skipping edge: bow it sideways so it does not run through other boxes.
        const sign = b.layer < a.layer ? 1 : -1;
        const bow = 46 + 10 * Math.abs(a.layer - b.layer);
        const cx = (a.x + b.x) / 2 + (-dy / len) * bow * sign, cy = (a.y + b.y) / 2 + (dx / len) * bow * sign;
        const q1 = clip(a, cx - a.x, cy - a.y), q2 = clip(b, cx - b.x, cy - b.y);
        const mx = 0.25 * q1.x + 0.5 * cx + 0.25 * q2.x, my = 0.25 * q1.y + 0.5 * cy + 0.25 * q2.y;
        svg.appendChild(s(doc, "path", { d: "M" + q1.x + " " + q1.y + " Q" + cx + " " + cy + " " + q2.x + " " + q2.y, class: cls, "marker-end": e.arrow ? "url(#tv-arrow)" : "none" }));
        if (e.label) addLabel(svg, doc, e.label, mx, my);
        return;
      }
      const off = pairs.has(e.to + ">" + e.from) ? 7 : 0;
      const ox = (-dy / len) * off, oy = (dx / len) * off;
      const p1 = clip(a, dx, dy), p2 = clip(b, -dx, -dy);
      const x1 = p1.x + ox, y1 = p1.y + oy, x2 = p2.x + ox, y2 = p2.y + oy;
      svg.appendChild(s(doc, "line", { x1, y1, x2, y2, class: cls, "marker-end": e.arrow ? "url(#tv-arrow)" : "none" }));
      if (e.label) addLabel(svg, doc, e.label, (x1 + x2) / 2, (y1 + y2) / 2);
    });

    d.nodes.forEach((n) => {
      const g = s(doc, "g", { class: "tv-node" });
      const x = n.x - n.w / 2, y = n.y - n.h / 2;
      if (n.shape === "diamond") g.appendChild(s(doc, "polygon", { points: [[n.x, y], [n.x + n.w / 2, n.y], [n.x, y + n.h], [x, n.y]].map((p) => p.join(",")).join(" ") }));
      else g.appendChild(s(doc, "rect", { x, y, width: n.w, height: n.h, rx: n.shape === "round" ? n.h / 2 : 6 }));
      const top = n.y - ((n.lines.length - 1) * 17) / 2 + 4;
      n.lines.forEach((line, i) => g.appendChild(s(doc, "text", { x: n.x, y: top + i * 17, "text-anchor": "middle" }, line)));
      svg.appendChild(g);
    });
    return svg;
  }

  // ---------- fences ----------
  const FENCE = /```(?:mermaid|diagram)[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?```/g;

  function splitFences(text) {
    const parts = [];
    let last = 0, m;
    FENCE.lastIndex = 0;
    while ((m = FENCE.exec(text))) {
      if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
      parts.push({ type: "diagram", text: m[1] });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
    return parts;
  }

  /** A node list: text as text nodes, diagrams as SVG, unparseable diagrams as source plus the reason. */
  function richContent(doc, text) {
    const frag = doc.createDocumentFragment();
    splitFences(text).forEach((p) => {
      if (p.type === "text") { frag.appendChild(doc.createTextNode(p.text)); return; }
      const r = parseDiagram(p.text);
      const box = doc.createElement("div");
      box.className = "diagram-box";
      if (r.ok) {
        box.appendChild(renderDiagram(doc, r.diagram));
        const det = doc.createElement("details");
        const sum = doc.createElement("summary"); sum.textContent = "Diagram source";
        const pre = doc.createElement("pre"); pre.textContent = p.text;
        det.appendChild(sum); det.appendChild(pre); box.appendChild(det);
      } else {
        const err = doc.createElement("p"); err.className = "diagram-error"; err.textContent = "Could not draw this diagram. " + r.error;
        const pre = doc.createElement("pre"); pre.textContent = p.text;
        box.appendChild(err); box.appendChild(pre);
      }
      frag.appendChild(box);
    });
    return frag;
  }

  const api = { parseDiagram, layout, renderDiagram, splitFences, richContent, LIMITS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ThinkVisDiagram = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
