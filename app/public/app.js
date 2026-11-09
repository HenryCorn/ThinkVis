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
      api("POST", "/api/notes/" + state.current + "/activity", {}).catch(() => {});
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
      await refresh(); renderTree(); loadThread(id); loadFeedback();
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

  // ---- feedback ----
  const fbState = { personas: [], busy: false, requestId: null, proactive: null };
  const fbList = $('fb-list');

  function fillPersonaSelect(sel, selected) {
    sel.textContent = '';
    fbState.personas.forEach((p) => sel.appendChild(new Option(p.name + (p.builtin ? '' : ' (yours)'), p.id)));
    if (selected) sel.value = selected;
  }
  const BADGE = { exact: 'Quote found', moved: 'Quote moved', ambiguous: 'Quote ambiguous', missing: 'Quote gone' };

  function renderFeedback(items) {
    fbList.textContent = '';
    if (!items.length) { fbList.appendChild(el('li', 'muted', 'No feedback yet.')); return; }
    items.forEach((f) => {
      const li = el('li', 'fb-item ' + f.status);
      const head = el('div', 'fb-head');
      head.appendChild(el('span', 'badge', f.kind));
      head.appendChild(el('span', 'badge ' + (f.position.status === 'exact' ? '' : 'warn'), BADGE[f.position.status]));
      if (f.freshness === 'stale') head.appendChild(el('span', 'badge warn', 'Written for an earlier version'));
      head.appendChild(el('span', 'badge', f.status));
      li.appendChild(head);
      li.appendChild(el('blockquote', 'fb-quote', f.quote));
      li.appendChild(el('p', 'fb-body', f.body));
      li.appendChild(el('p', 'tag', (f.provider.model || '') + ' · ' + (f.persona ? f.persona.id + ' v' + f.persona.version : '') + ' · ' + f.source));
      const row = el('div', 'row');
      if (f.position.start !== null) {
        const j = el('button', 'alt', 'Show in note'); j.type = 'button';
        j.addEventListener('click', () => { bodyEl.focus(); bodyEl.setSelectionRange(f.position.start, f.position.end); });
        row.appendChild(j);
      }
      const mk = (label, status) => { const b = el('button', 'alt', label); b.type = 'button'; b.addEventListener('click', async () => { await api('PATCH', '/api/feedback/' + f.id, { status }).catch((e) => ($('fb-status').textContent = e.message)); loadFeedback(); }); return b; };
      if (f.status === 'open') { row.appendChild(mk('Resolve', 'resolved')); row.appendChild(mk('Dismiss', 'dismissed')); } else row.appendChild(mk('Reopen', 'open'));
      const mkNote = el('button', 'alt', 'Make a note'); mkNote.type = 'button';
      mkNote.addEventListener('click', async () => {
        try { const n = await api('POST', '/api/feedback/' + f.id + '/note', {}); await refresh(); $('fb-status').textContent = 'Created ' + n.path; }
        catch (e) { $('fb-status').textContent = e.message; }
      });
      row.appendChild(mkNote);
      const r = el('button', 'alt', 'Reply' + (f.replies ? ' (' + f.replies + ')' : '')); r.type = 'button';
      r.addEventListener('click', () => toggleThread(li, f));
      row.appendChild(r);
      li.appendChild(row);
      fbList.appendChild(li);
    });
  }

  async function toggleThread(li, f) {
    const old = li.querySelector('.fb-thread');
    if (old) { old.remove(); return; }
    const box = el('div', 'fb-thread');
    try { (await api('GET', '/api/feedback/' + f.id)).thread.forEach((m) => { const p = el('p', 'fb-reply ' + m.role, ''); p.appendChild(el('span', 'tag', m.role === 'user' ? 'You' : (m.model || ''))); p.appendChild(document.createTextNode(m.content)); box.appendChild(p); }); } catch (e) { /* ignore */ }
    const ta = document.createElement('textarea'); ta.rows = 2; ta.setAttribute('aria-label', 'Reply'); ta.placeholder = 'Reply to this feedback';
    const send = el('button', '', 'Send reply'); send.type = 'button';
    const msg = el('span', 'muted', '');
    send.addEventListener('click', async () => {
      if (!ta.value.trim()) return;
      send.disabled = true; msg.textContent = 'Waiting for the model…';
      try { await api('POST', '/api/feedback/' + f.id + '/reply', { message: ta.value, connectionId: $('conn').value, requestId: crypto.randomUUID() }); await loadFeedback(); }
      catch (e) { msg.textContent = e.message; send.disabled = false; }
    });
    box.appendChild(ta); box.appendChild(send); box.appendChild(msg);
    li.appendChild(box);
  }

  async function loadFeedback() {
    if (!state.current) return;
    try {
      const d = await api('GET', '/api/notes/' + state.current + '/feedback');
      renderFeedback(d.feedback);
      if (d.personaId) $('persona').value = d.personaId;
    } catch (e) { $('fb-status').textContent = e.message; }
  }
  async function loadPersonas() {
    try { fbState.personas = (await api('GET', '/api/personas')).personas; } catch (e) { fbState.personas = []; }
    const keep = $('persona').value;
    fillPersonaSelect($('persona'), keep); fillPersonaSelect($('pro-persona')); fillPersonaSelect($('pe-pick'));
    showPersonaForm();
  }
  function showPersonaForm() {
    const p = fbState.personas.find((x) => x.id === $('pe-pick').value);
    if (!p) return;
    $('pe-name').value = p.name; $('pe-instr').value = p.instructions; $('pe-voice').value = p.voice; $('pe-freq').value = p.frequency;
    $('pe-save').disabled = p.builtin;
    $('pe-msg').textContent = p.builtin ? 'Built-in personas are read-only. Save as new to make your own copy.' : 'Version ' + p.version;
  }
  $('pe-pick').addEventListener('change', showPersonaForm);
  const personaBody = () => ({ name: $('pe-name').value, instructions: $('pe-instr').value, voice: $('pe-voice').value, frequency: $('pe-freq').value });
  $('pe-new').addEventListener('click', async () => {
    try { const r = await api('POST', '/api/personas', personaBody()); await loadPersonas(); $('pe-pick').value = r.id; showPersonaForm(); $('pe-msg').textContent = 'Saved as a new persona.'; }
    catch (e) { $('pe-msg').textContent = e.message; }
  });
  $('pe-save').addEventListener('click', async () => {
    try { const r = await api('PUT', '/api/personas/' + $('pe-pick').value, personaBody()); const id = $('pe-pick').value; await loadPersonas(); $('pe-pick').value = id; showPersonaForm(); $('pe-msg').textContent = 'Saved as version ' + r.version + '. Earlier feedback keeps the version that wrote it.'; }
    catch (e) { $('pe-msg').textContent = e.message; }
  });
  $('persona').addEventListener('change', () => state.current && api('PATCH', '/api/notes/' + state.current, { personaId: $('persona').value }).catch((e) => ($('fb-status').textContent = e.message)));

  $('get-fb').addEventListener('click', async () => {
    if (!state.current || fbState.busy) return;
    await flush();
    fbState.requestId = crypto.randomUUID(); fbState.busy = true; $('get-fb').hidden = true; $('cancel-fb').hidden = false;
    $('fb-status').textContent = 'Waiting for the model…';
    try {
      const r = await api('POST', '/api/notes/' + state.current + '/feedback/generate', { connectionId: $('conn').value, personaId: $('persona').value, requestId: fbState.requestId });
      const dropped = r.rejected.reduce((n, x) => n + x.count, 0);
      $('fb-status').textContent = r.stale ? 'The note changed while the model worked, so nothing was added.' : r.created.length + ' new' + (dropped ? ', ' + dropped + ' skipped (not usable or already seen)' : '') + '.';
      await loadFeedback();
    } catch (e) { $('fb-status').textContent = (e.data && e.data.code === 'cancelled') ? 'Cancelled.' : e.message; }
    finally { fbState.busy = false; $('get-fb').hidden = false; $('cancel-fb').hidden = true; }
  });
  $('cancel-fb').addEventListener('click', () => { if (fbState.requestId) api('POST', '/api/chat/cancel', { requestId: fbState.requestId }).catch(() => {}); });

  async function loadProactive() {
    try { fbState.proactive = await api('GET', '/api/settings/proactive'); } catch (e) { return; }
    const p = fbState.proactive;
    const sel = $('pro-conn'); sel.textContent = '';
    chat.conns.filter((c) => c.available).forEach((c) => sel.appendChild(new Option(c.label, c.id)));
    if (p.connectionId) sel.value = p.connectionId;
    if (p.personaId) $('pro-persona').value = p.personaId;
    $('pro-state').textContent = p.enabled ? '(on)' : '(off)';
    $('pro-toggle').textContent = p.enabled ? 'Turn off' : 'Turn on';
  }
  $('pro-toggle').addEventListener('click', async () => {
    const turningOn = !(fbState.proactive && fbState.proactive.enabled);
    try {
      fbState.proactive = await api('PUT', '/api/settings/proactive', { connectionId: $('pro-conn').value || null, personaId: $('pro-persona').value || null, enabled: turningOn });
      $('pro-state').textContent = fbState.proactive.enabled ? '(on)' : '(off)';
      $('pro-toggle').textContent = fbState.proactive.enabled ? 'Turn off' : 'Turn on';
    } catch (e) { $('pro-state').textContent = e.message; }
  });

  $('copy-md').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(bodyEl.value); setStatus('Copied as Markdown', 'ok'); }
    catch (e) { bodyEl.focus(); bodyEl.select(); setStatus('Select all is ready. Press Ctrl+C to copy.', 'dirty'); }
  });

  refresh().catch((e) => setStatus(e.message, "dirty"));
  loadConnections().then(() => loadPersonas()).then(loadProactive);
})();
