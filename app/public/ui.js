(function () {
  "use strict";
  const A = window.ThinkVisApp;
  const T = window.ThinkVisTheme;
  if (!A || !T) return;
  const { $, el, api, state, bodyEl } = A;

  // ---------- quote highlights ----------
  // A mirror layer sits behind the transparent textarea and paints <mark>s at the
  // positions the server resolved for open feedback. Offsets are only valid for the
  // saved text, so marks hide while there are unsaved edits and return after the save.
  const mirror = $("mirror");
  let items = [];
  let ranges = [];

  function syncScroll() { mirror.scrollTop = bodyEl.scrollTop; }

  function renderMirror() {
    const text = bodyEl.value;
    mirror.textContent = "";
    ranges = [];
    if (!state.dirty && !state.conflict) {
      ranges = items
        .filter((f) => f.status === "open" && f.position && f.position.start !== null && f.position.end <= text.length && f.position.end > f.position.start)
        .map((f) => ({ id: f.id, s: f.position.start, e: f.position.end }))
        .sort((a, b) => a.s - b.s);
    }
    let pos = 0;
    const used = [];
    for (const r of ranges) {
      if (r.s < pos) continue;
      if (r.s > pos) mirror.appendChild(document.createTextNode(text.slice(pos, r.s)));
      const mk = document.createElement("mark");
      mk.dataset.id = r.id;
      mk.textContent = text.slice(r.s, r.e);
      mirror.appendChild(mk);
      pos = r.e;
      used.push(r);
    }
    ranges = used;
    mirror.appendChild(document.createTextNode(text.slice(pos) + (text.endsWith("\n") ? " " : "")));
    syncScroll();
  }

  function setActive(id) {
    mirror.querySelectorAll("mark.active").forEach((m) => m.classList.remove("active"));
    $("fb-list").querySelectorAll(".fb-item.active").forEach((m) => m.classList.remove("active"));
    if (!id) return;
    const m = mirror.querySelector('mark[data-id="' + id + '"]');
    if (m) m.classList.add("active");
    const card = $("fb-list").querySelector('.fb-item[data-id="' + id + '"]');
    if (card) card.classList.add("active");
    return card;
  }

  function markAtCaret() {
    if (bodyEl.selectionStart !== bodyEl.selectionEnd) return null;
    const p = bodyEl.selectionStart;
    const r = ranges.find((x) => p >= x.s && p <= x.e);
    return r ? r.id : null;
  }
  function followCaret() {
    const id = markAtCaret();
    const card = setActive(id);
    if (card) card.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  document.addEventListener("tv:feedback", (e) => { items = e.detail || []; renderMirror(); });
  document.addEventListener("tv:noteopened", () => { items = []; renderMirror(); hideBar(); });
  document.addEventListener("tv:saved", () => { A.loadFeedback(); });
  bodyEl.addEventListener("input", renderMirror);
  bodyEl.addEventListener("scroll", syncScroll);
  bodyEl.addEventListener("click", followCaret);
  bodyEl.addEventListener("keyup", (e) => { if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") followCaret(); });
  $("fb-list").addEventListener("mouseover", (e) => { const li = e.target.closest(".fb-item"); mirror.querySelectorAll("mark.active").forEach((m) => m.classList.remove("active")); if (li) { const m = mirror.querySelector('mark[data-id="' + li.dataset.id + '"]'); if (m) m.classList.add("active"); } });
  $("fb-list").addEventListener("mouseleave", () => mirror.querySelectorAll("mark.active").forEach((m) => m.classList.remove("active")));
  new ResizeObserver(syncScroll).observe(bodyEl);

  // ---------- selected-text assistance ----------
  const bar = $("sel-bar");
  let sel = null;
  function hideBar() { sel = null; bar.hidden = true; $("sel-note").textContent = ""; }
  function updateBar() {
    const a = bodyEl.selectionStart, b = bodyEl.selectionEnd;
    const text = bodyEl.value.slice(a, b).trim();
    if (text.length < 3) return hideBar();
    sel = { text };
    const one = text.replace(/\s+/g, " ");
    $("sel-text").textContent = "“" + (one.length > 48 ? one.slice(0, 47) + "…" : one) + "”";
    bar.hidden = false;
    $("sel-note").textContent = "";
  }
  bodyEl.addEventListener("mouseup", () => setTimeout(updateBar, 0));
  bodyEl.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "a" || e.key === "A" || e.key.startsWith("Arrow")) updateBar(); if (e.key === "Escape") hideBar(); });
  bodyEl.addEventListener("input", hideBar);

  const PROMPTS = {
    explain: (q) => "Explain this part of my note in plain words, and say what it connects to: " + q,
    check: (q) => "Is this part of my note correct? Quote what is right or wrong and say why: " + q,
    quiz: (q) => "Ask me one question that tests whether I understand this part of my note. Do not give the answer yet: " + q,
    ask: (q) => "About this part of my note, " + q + ": ",
  };
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-ask]");
    if (!btn || !sel) return;
    if ($("send").disabled || $("msg").disabled) { $("sel-note").textContent = A.chat.conns.some((c) => c.available) ? "A reply is already in progress." : "No model is connected."; return; }
    const q = sel.text.length > 600 ? sel.text.slice(0, 600) + " […]" : sel.text;
    const quoted = "“" + q + "”";
    $("msg").value = PROMPTS[btn.dataset.ask](quoted);
    if (btn.dataset.ask === "ask") { $("msg").focus(); $("msg").setSelectionRange($("msg").value.length, $("msg").value.length); $("msg").scrollIntoView({ block: "center" }); return; }
    $("send").click();
    $("thread").scrollIntoView({ block: "nearest" });
    hideBar();
  });

  // ---------- appearance ----------
  const apIds = { theme: "ap-theme", size: "ap-size", font: "ap-font", spacing: "ap-spacing", width: "ap-width" };
  function syncAppearanceForm() { const a = T.load(); for (const k in apIds) $(apIds[k]).value = a[k]; }
  function readAppearanceForm() { const a = {}; for (const k in apIds) a[k] = $(apIds[k]).value; return a; }
  for (const k in apIds) $(apIds[k]).addEventListener("change", () => T.save(readAppearanceForm()));
  $("ap-reset").addEventListener("click", () => { T.save(T.DEFAULTS); syncAppearanceForm(); });
  function openAppearance() { syncAppearanceForm(); $("appearance").showModal(); $("ap-theme").focus(); }
  $("open-appearance").addEventListener("click", openAppearance);

  // ---------- usage ----------
  const nf = new Intl.NumberFormat();
  function row(cells, tag) { const tr = document.createElement("tr"); cells.forEach((c, i) => { const td = document.createElement(tag || "td"); td.textContent = c; if (i > 0 && tag !== "th") td.className = "num"; else if (tag === "th" && i > 0) td.className = "num"; tr.appendChild(td); }); return tr; }
  function section(title) { const s = el("section", "us-sec"); s.appendChild(el("h3", "", title)); return s; }
  function table(head, rows) { const t = document.createElement("table"); const th = document.createElement("thead"); th.appendChild(row(head, "th")); t.appendChild(th); const tb = document.createElement("tbody"); rows.forEach((r) => tb.appendChild(row(r))); t.appendChild(tb); const w = el("div", "tablewrap"); w.appendChild(t); return w; }

  async function loadUsage() {
    const box = $("us-body");
    let u;
    try { u = await api("GET", "/api/usage"); } catch (e) { box.textContent = "Could not load usage: " + e.message; return; }
    box.textContent = "";

    const s1 = section("Requests this hour");
    const m = document.createElement("meter"); m.min = 0; m.max = u.hour.limit; m.value = Math.min(u.hour.used, u.hour.limit); m.setAttribute("aria-label", "Requests this hour");
    const p = el("p", "us-line"); p.appendChild(el("strong", "num", nf.format(u.hour.used))); p.appendChild(document.createTextNode(" of " + nf.format(u.hour.limit) + " allowed by ThinkVis. Counts every attempt, including retries."));
    s1.appendChild(p); s1.appendChild(m);
    box.appendChild(s1);

    const s2 = section("Replies by model");
    if (!u.models.length) s2.appendChild(el("p", "muted", "No chat replies yet."));
    else {
      s2.appendChild(table(["Model", "Replies", "Last 24h", "Tokens in", "Tokens out"], u.models.map((r) => [
        (r.model || "unknown") + (r.billing === "none" ? " (mock)" : "") + (r.billing === "subscription-bridge" ? " (bridge)" : ""),
        nf.format(r.replies), nf.format(r.last24h),
        r.inputTokens == null ? "not reported" : nf.format(r.inputTokens),
        r.outputTokens == null ? "not reported" : nf.format(r.outputTokens),
      ])));
      if (u.models.some((r) => r.unmeasured > 0)) s2.appendChild(el("p", "muted", "Some replies came without token counts. Subscription-bridge usage is not measured at all."));
    }
    box.appendChild(s2);

    const s3 = section("Feedback saved");
    if (!u.findings.length) s3.appendChild(el("p", "muted", "No feedback yet."));
    else s3.appendChild(table(["Source", "Items", "Last 24h"], u.findings.map((r) => [r.source === "proactive" ? "Proactive" : "Requested", nf.format(r.total), nf.format(r.last24h)])));
    box.appendChild(s3);

    const pr = u.proactive;
    const s4 = section("Proactive feedback");
    s4.appendChild(el("p", "us-line", (pr.enabled ? "On" : "Off") + ". " + nf.format(pr.runsToday) + " of " + nf.format(pr.maxRunsPerDay) + " runs used in the last 24 hours. Waits " + pr.quietSeconds + " seconds after you stop typing, then at least " + pr.cooldownMinutes + " minutes between runs on a note (scaled by the persona’s “speaks up” setting)."));
    box.appendChild(s4);

    box.appendChild(el("p", "muted us-foot", "This is what ThinkVis itself sent. Your provider’s own quota, plan or billing is not visible here, and token counts are whatever the provider reported."));
  }
  function openUsage() { $("usage").showModal(); loadUsage(); }
  $("open-usage").addEventListener("click", openUsage);
  $("us-refresh").addEventListener("click", loadUsage);

  // ---------- command palette ----------
  const pal = $("palette"), palInput = $("pal-input"), palList = $("pal-list");
  let shown = [], active = 0;

  const hasNote = () => !!state.current;
  function themeCmd(name, theme) { return { label: "Theme: " + name, run: () => T.save({ ...T.load(), theme }) }; }
  function sizeCmd(delta) {
    return { label: delta > 0 ? "Editor text larger" : "Editor text smaller", run: () => { const sizes = T.CHOICES.size; const a = T.load(); const i = Math.max(0, Math.min(sizes.length - 1, sizes.indexOf(a.size) + delta)); T.save({ ...a, size: sizes[i] }); } };
  }
  function staticCommands() {
    const c = [
      { label: "New note", run: () => $("new-note").click() },
      { label: "New folder", run: () => $("new-folder").click() },
      { label: "Get feedback on this note", when: hasNote, run: () => $("get-fb").click() },
      { label: "Ask about this note", when: hasNote, run: () => { $("msg").focus(); $("msg").scrollIntoView({ block: "center" }); } },
      { label: "Copy note as Markdown", when: hasNote, run: () => $("copy-md").click() },
      { label: "Export all notes as Markdown", run: () => $("export").click() },
      { label: "Turn proactive feedback on or off", run: () => { $("proactive-box").open = true; $("pro-toggle").click(); } },
      { label: "Show diagrams in this note", when: () => hasNote() && !$("note-diagrams").hidden, run: () => $("note-diagrams").scrollIntoView({ block: "start" }) },
      { label: "Appearance settings", run: openAppearance },
      { label: "Usage", run: openUsage },
      themeCmd("match my system", "system"), themeCmd("light", "light"), themeCmd("dark", "dark"),
      sizeCmd(1), sizeCmd(-1),
    ];
    return c.filter((x) => !x.when || x.when());
  }
  function noteCommands() { return state.notes.map((n) => ({ label: "Open " + n.title, hint: n.path, run: () => A.openNote(n.id) })); }

  function score(q, text) {
    if (!q) return 1;
    const t = text.toLowerCase();
    const at = t.indexOf(q);
    if (at >= 0) return 100 - Math.min(at, 50);
    let i = 0, gaps = 0, last = -1;
    for (const ch of q) { const j = t.indexOf(ch, i); if (j < 0) return 0; if (last >= 0 && j > last + 1) gaps++; last = j; i = j + 1; }
    return Math.max(1, 40 - gaps * 4);
  }
  function renderPalette() {
    const q = palInput.value.trim().toLowerCase();
    const all = staticCommands().concat(noteCommands());
    shown = all.map((c) => ({ c, s: Math.max(score(q, c.label), c.hint ? score(q, c.hint) - 10 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.c);
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
    palList.textContent = "";
    if (!shown.length) { const li = el("li", "pal-empty muted", "Nothing matches “" + palInput.value.trim() + "”."); palList.appendChild(li); }
    shown.forEach((c, i) => {
      const li = el("li", "pal-item"); li.id = "pal-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(i === active));
      li.appendChild(el("span", "", c.label));
      if (c.hint) li.appendChild(el("small", "muted", c.hint));
      li.addEventListener("mousemove", () => { if (active !== i) { active = i; markActive(); } });
      li.addEventListener("click", () => runCommand(i));
      palList.appendChild(li);
    });
    palInput.setAttribute("aria-activedescendant", shown.length ? "pal-" + active : "");
  }
  function markActive() {
    palList.querySelectorAll(".pal-item").forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
    palInput.setAttribute("aria-activedescendant", "pal-" + active);
    const li = palList.children[active]; if (li) li.scrollIntoView({ block: "nearest" });
  }
  function runCommand(i) { const c = shown[i]; if (!c) return; pal.close(); setTimeout(() => c.run(), 0); }
  function openPalette() { if (document.querySelector("dialog[open]")) return; palInput.value = ""; active = 0; renderPalette(); pal.showModal(); palInput.focus(); }
  palInput.addEventListener("input", () => { active = 0; renderPalette(); });
  palInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (shown.length) { active = (active + 1) % shown.length; markActive(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { active = (active - 1 + shown.length) % shown.length; markActive(); } }
    else if (e.key === "Enter") { e.preventDefault(); runCommand(active); }
  });
  pal.addEventListener("click", (e) => { if (e.target === pal) pal.close(); });
  for (const id of ["appearance", "usage"]) $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).close(); });
  $("open-palette").addEventListener("click", openPalette);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
  });

  window.ThinkVisUI = { renderMirror, openPalette, openUsage, openAppearance };
})();
