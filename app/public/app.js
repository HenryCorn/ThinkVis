(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const treeEl = $("tree"), bodyEl = $("body"), pathEl = $("path"), statusEl = $("status");
  const state = { notes: [], folders: [], current: null, baseHash: null, dirty: false, saving: false, timer: null, conflict: false };

  async function api(method, url, body) {
    const opts = { method, headers: {} };
    if (method !== "GET") {
      opts.headers["X-ThinkVis"] = "1";
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body || {});
    }
    const res = await fetch(url, opts);
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) { const err = new Error(data.error || "Request failed"); err.status = res.status; err.data = data; throw err; }
    return data;
  }

  function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = "status" + (cls ? " " + cls : ""); }

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }

  function renderTree(results) {
    treeEl.textContent = "";
    if (results) {
      if (!results.length) treeEl.appendChild(el("p", "muted", "No matches."));
      results.forEach((r) => {
        const b = el("button", "item", r.title); b.type = "button";
        b.appendChild(el("small", "", r.snippet || r.path));
        b.addEventListener("click", () => openNote(r.id));
        treeEl.appendChild(b);
      });
      return;
    }
    const groups = new Map([["", []]]);
    state.folders.forEach((f) => groups.set(f, []));
    state.notes.forEach((n) => {
      const i = n.path.lastIndexOf("/");
      const dir = i < 0 ? "" : n.path.slice(0, i);
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir).push(n);
    });
    [...groups.keys()].sort().forEach((dir) => {
      if (dir) treeEl.appendChild(el("div", "folder", dir));
      groups.get(dir).forEach((n) => {
        const b = el("button", "item", n.title); b.type = "button";
        b.appendChild(el("small", "", n.path));
        if (state.current === n.id) b.setAttribute("aria-current", "true");
        b.addEventListener("click", () => openNote(n.id));
        treeEl.appendChild(b);
      });
    });
    if (!state.notes.length) treeEl.appendChild(el("p", "muted", "No notes yet."));
  }

  async function refresh() {
    const d = await api("GET", "/api/notes");
    state.notes = d.notes; state.folders = d.folders;
    if (!$("search").value.trim()) renderTree();
  }

  async function flush() {
    if (!state.current || !state.dirty || state.saving || state.conflict) return;
    clearTimeout(state.timer);
    state.saving = true; setStatus("Saving…");
    const sent = bodyEl.value;
    try {
      const r = await api("PUT", "/api/notes/" + state.current, { content: sent, baseHash: state.baseHash });
      state.baseHash = r.hash;
      state.dirty = bodyEl.value !== sent;
      setStatus(state.dirty ? "Unsaved changes" : "Saved", state.dirty ? "dirty" : "ok");
    } catch (e) {
      if (e.status === 409) { showConflict(e.data); }
      else setStatus("Could not save: " + e.message, "dirty");
    } finally {
      state.saving = false;
      if (state.dirty && !state.conflict) schedule();
    }
  }

  function schedule() { clearTimeout(state.timer); state.timer = setTimeout(flush, 800); }

  function showConflict(data) {
    state.conflict = true; state.diskVersion = data;
    $("conflict").hidden = false; bodyEl.readOnly = true;
    setStatus("Conflict", "dirty");
  }
  function clearConflict() { state.conflict = false; $("conflict").hidden = true; bodyEl.readOnly = false; }

  $("keep-mine").addEventListener("click", async () => {
    const d = state.diskVersion;
    if (!d || !d.currentHash) { clearConflict(); return setStatus("The file was removed on disk. Reload the list.", "dirty"); }
    state.baseHash = d.currentHash; clearConflict(); state.dirty = true; flush();
  });
  $("take-disk").addEventListener("click", () => { clearConflict(); state.dirty = false; openNote(state.current); });

  async function openNote(id) {
    await flush();
    try {
      const n = await api("GET", "/api/notes/" + id);
      clearConflict();
      state.current = id; state.baseHash = n.hash; state.dirty = false;
      bodyEl.value = n.content; pathEl.value = n.path;
      $("purpose").value = n.purpose; $("mode").value = n.assistMode;
      $("empty").hidden = true; $("editor").hidden = false;
      setStatus(n.externallyChanged ? "Reloaded: changed on disk" : "Saved", "ok");
      await refresh(); renderTree(); loadThread(id);
    } catch (e) { setStatus(e.message, "dirty"); await refresh(); }
  }

  bodyEl.addEventListener("input", () => { state.dirty = true; setStatus("Unsaved changes", "dirty"); schedule(); });
  window.addEventListener("beforeunload", (ev) => { if (state.dirty) { ev.preventDefault(); ev.returnValue = ""; } });

  $("new-note").addEventListener("click", async () => {
    await flush();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    try {
      const r = await api("POST", "/api/notes", { path: "Untitled " + stamp + ".md", content: "# Untitled\n\n" });
      await refresh(); await openNote(r.id); bodyEl.focus();
    } catch (e) { setStatus(e.message, "dirty"); }
  });
  $("new-folder").addEventListener("click", async () => {
    const name = pathEl.value.includes("/") ? pathEl.value.slice(0, pathEl.value.lastIndexOf("/")) + "/New folder" : "New folder";
    try { await api("POST", "/api/folders", { path: name }); await refresh(); } catch (e) { setStatus(e.message, "dirty"); }
  });
  $("rename").addEventListener("click", async () => {
    if (!state.current) return;
    await flush();
    try { await api("PATCH", "/api/notes/" + state.current, { path: pathEl.value }); await refresh(); setStatus("Moved", "ok"); }
    catch (e) { setStatus(e.message, "dirty"); }
  });
  let armedDelete = false;
  $("delete").addEventListener("click", async () => {
    if (!state.current) return;
    if (!armedDelete) { armedDelete = true; $("delete").textContent = "Confirm delete"; setTimeout(() => { armedDelete = false; $("delete").textContent = "Delete"; }, 4000); return; }
    armedDelete = false; $("delete").textContent = "Delete";
    try {
      await api("DELETE", "/api/notes/" + state.current);
      state.current = null; state.dirty = false; $("editor").hidden = true; $("empty").hidden = false; await refresh();
    } catch (e) { setStatus(e.message, "dirty"); }
  });
  $("purpose").addEventListener("change", () => state.current && api("PATCH", "/api/notes/" + state.current, { purpose: $("purpose").value }).catch((e) => setStatus(e.message, "dirty")));
  $("mode").addEventListener("change", () => state.current && api("PATCH", "/api/notes/" + state.current, { assistMode: $("mode").value }).catch((e) => setStatus(e.message, "dirty")));

  let searchTimer = null;
  $("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = $("search").value.trim();
      if (!q) return renderTree();
      try { renderTree((await api("GET", "/api/search?q=" + encodeURIComponent(q))).results); } catch (e) { /* ignore */ }
    }, 250);
  });

  $("export").addEventListener("click", async () => {
    try { const r = await api("POST", "/api/export"); $("export-msg").textContent = "Exported " + r.count + " note(s) to " + r.dir; }
    catch (e) { $("export-msg").textContent = e.message; }
  });


  // ---- chat ----
  const chat = { conns: [], busy: false, requestId: null };
  const threadEl = $('thread');

  function tagFor(m) {
    const bits = [m.model, m.provider, m.billing === 'api' ? 'API billing' : m.billing === 'subscription-bridge' ? 'subscription bridge (usage not measured)' : m.billing === 'none' ? 'no provider (mock)' : null];
    if (m.inputTokens != null || m.outputTokens != null) bits.push((m.inputTokens ?? '?') + ' in / ' + (m.outputTokens ?? '?') + ' out tokens');
    return bits.filter(Boolean).join(' · ');
  }
  function addMessage(m) {
    const li = el('li', m.role);
    li.appendChild(el('span', 'tag', m.role === 'user' ? 'You' : tagFor(m)));
    li.appendChild(document.createTextNode(m.content));
    threadEl.appendChild(li);
    threadEl.scrollTop = threadEl.scrollHeight;
  }
  async function loadThread(id) {
    threadEl.textContent = '';
    try { (await api('GET', '/api/notes/' + id + '/thread')).messages.forEach(addMessage); } catch (e) { $('chat-status').textContent = e.message; }
  }
  async function loadConnections() {
    try { chat.conns = (await api('GET', '/api/connections')).connections; } catch (e) { chat.conns = []; }
    const sel = $('conn'); sel.textContent = '';
    if (!chat.conns.length) { sel.appendChild(new Option('No connections configured', '')); sel.disabled = true; $('send').disabled = true; $('conn-info').textContent = 'Add one in app-data/connections.json'; return; }
    chat.conns.forEach((c) => { const o = new Option(c.label + (c.available ? '' : ' (unavailable)'), c.id); o.disabled = !c.available; sel.appendChild(o); });
    const first = chat.conns.find((c) => c.available);
    if (first) sel.value = first.id;
    updateConnInfo();
  }
  function updateConnInfo() {
    const c = chat.conns.find((x) => x.id === $('conn').value);
    $('conn-info').textContent = c ? (c.available ? c.model + ' · sends this note to ' + c.adapter : c.reason) : '';
    $('send').disabled = !c || !c.available;
  }
  $('conn').addEventListener('change', updateConnInfo);

  $('preview-box').addEventListener('toggle', async () => {
    if (!$('preview-box').open || !state.current) return;
    try {
      await flush();
      const p = await api('POST', '/api/chat/preview', { noteId: state.current, message: $('msg').value || '(your message)', connectionId: $('conn').value });
      const m = p.manifest;
      const lines = [
        'To: ' + m.connection.label + ' (' + m.connection.model + ')',
        'Characters: ' + m.totalChars + (m.noteTruncated ? ' (note truncated)' : ''),
        'Tools: none',
        '',
        '--- system ---',
        p.system,
        '',
        '--- messages ---',
      ].concat(p.messages.map((x) => x.role + ': ' + x.content));
      $('preview').textContent = lines.join('\n');
    } catch (e) { $('preview').textContent = e.message; }
  });

  function setBusy(b) { chat.busy = b; $('send').hidden = b; $('cancel').hidden = !b; $('msg').disabled = b; }
  $('send').addEventListener('click', async () => {
    const message = $('msg').value.trim();
    if (!message || !state.current || chat.busy) return;
    await flush();
    chat.requestId = crypto.randomUUID(); setBusy(true); $('chat-status').className = 'muted'; $('chat-status').textContent = 'Waiting for the model…';
    try {
      const r = await api('POST', '/api/chat/send', { noteId: state.current, message, connectionId: $('conn').value, requestId: chat.requestId });
      addMessage(r.user); addMessage(r.assistant); $('msg').value = ''; $('chat-status').textContent = '';
    } catch (e) {
      $('chat-status').className = 'chat-error';
      $('chat-status').textContent = (e.data && e.data.code === 'cancelled') ? 'Cancelled. Nothing was saved.' : e.message + (e.data && e.data.retryable ? ' You can try again.' : '');
    } finally { setBusy(false); $('msg').focus(); }
  });
  $('cancel').addEventListener('click', () => { if (chat.requestId) api('POST', '/api/chat/cancel', { requestId: chat.requestId }).catch(() => {}); });

  refresh().catch((e) => setStatus(e.message, "dirty"));
  loadConnections();
})();
