---
tags: [research, experiments]
status: first-pass-complete
---
# Experiment Log

## Scope and accounting
Research pass: 2026-11-09. Authorized tester: primary coding assistant, with user-supplied signed-in browser access. Only the Riddled origin and disposable research artifacts were intentionally inspected. Herdr delegates did not control the browser.

Three AI responses were intentionally elicited: two note-chat responses and one proactive margin response. This count is **not** a billing-unit measurement. A mid-pass Billing view displayed `About 30 responses left`; no initial balance or final exact balance was established. Stop rather than exhausting the non-refilling free allowance.

## EXP-01 — Baseline and sandbox creation
**Result:** reproduced once; no model request intentionally submitted during setup.

- Existing welcome note contained a photosynthesis misconception, a pre-existing correction and drawing. Do not treat those as newly generated test results.
- Open notes → New note created a separate disposable note. Set its mode to `When you ask` before entering synthetic content.
- Final actual title: `ThinkVis Research — Disposable` (with a trailing space in editor text). Marker: `TV-SANDBOX-001`.
- Actual body before the later mass paragraph:

```text
I am studying how plants obtain energy.
Photosynthesis happens in mitochondria, where sunlight turns water and carbon dioxide into glucose.
Research marker: TV-SANDBOX-001.Sandbox
```

The trailing `.Sandbox` is an input-automation artifact, not product content or a second note. A generic fill inserted multiline text into the title; normal editor keyboard entry was used to separate paragraphs. The first End key operated on a visual line rather than the entire wrapped title. Do not infer a Riddled editing bug from those automation mistakes.

- Saw `All notes saved` in navigation. No new margin feedback appeared during this bounded quiet-mode setup interval; not proof of all possible quiet-mode triggers.

## EXP-02 — Note-wide misconception correction
**Result:** reproduced once; one explicit AI submission.

Mode: `When you ask`. Persona: default Riddled. Exact question:

> In two sentences, identify the factual error in this note and correct it. Do not edit the note.

Returned two sentences corrected mitochondria to chloroplasts and contrasted photosynthesis with respiration. Note content remained unchanged. This establishes useful behavior on a simple known fact, **not** full-context retrieval, correctness across topics, or a tested note-marker lookup.

Transport evidence from selected Chrome DevTools request 16:
- `POST /api/riddled`, HTTP 200, JSON request and `application/json` response.
- Response envelope: `said`, nested `message.id` and `message.text`.
- UI first showed `Riddled is writing back`, then revealed words.
- Raw headers and request values are not stored. Value-free request/response shapes: [[90 Attachments/network-summary.json]].
- REA attach-window record: [[90 Attachments/REA/ev_0e3f01446db1ff46d13e048b766e03dd8e10f4e98dcf13566513540b73b74278.json]]. Its empty network window did **not** capture/prove the request; DevTools supplies that observation. See [[REA Evidence and Limitations]].

## EXP-03 — Proactive feedback and resolution
**Result:** reproduced once; one proactive response.

1. Select `Thinks with you`.
2. Append to the sandbox:

> Plants get most of their dry mass from minerals absorbed through their roots.

3. Within the subsequent 15-second observation wait, a margin correction appeared about the **earlier photosynthesis sentence**, not the newly appended dry-mass claim.
4. Open feedback → visible Reply/Send, Resolve, Dismiss, Open full screen. Thread menu offered Copy and Make a note.
5. Resolve from the thread menu removed the feedback from the margin.
6. Switch the sandbox back to `When you ask` to avoid further proactive generation.

Do not infer exact debounce/latency, paragraph selection, maximum comments per edit, or whether the mode switch rather than append initiated evaluation. We did not record a monotonic submit/complete latency. One stale-control click after Escape timed out; a fresh snapshot/menu was used, without repeating an AI request.

Selected DevTools request 27: `POST /api/riddled` 200 JSON. Returned `thought.kind`, `thought.quote`, `thought.message`, and nullable persona/version IDs. The quote matched the earlier misconception. See the value-free [[90 Attachments/network-summary.json]].

REA record around this state: [[90 Attachments/REA/ev_fcc02c56e37b9fd7bc7a29a95af0c9861e28b32eeb22807efea09fee1252d29b.json]]. Its snapshot/window timing must not be interpreted as the exact completion time. Later export and chat provide additional evidence of retained thread state.

## EXP-04 — Settings and custom persona
**Result:** create/edit/selection reproduced; style effect is supportive, not causal proof.

- Inspect Customize Riddled without changing global settings: default mode, pointer ink, reading pace, margin placement, appearance, text size, AI lettering, AI color.
- New Riddler form exposes six presets, name/description/instructions, voice, and intervention frequency.
- Created `ThinkVis Sandbox Tutor`, description `Disposable persona for personal learning-platform research.` Started from Socratic preset, then edited our own instruction text and saved:

> Help me reason about biology. When a claim is mistaken, ask one short diagnostic question before explaining. Stay focused on the selected note. Do not write or change my note.

A direct multiline fill did not persist the intended replacement in the initial form. We re-opened Edit, used keyboard select-all/type, verified the field text, and saved. Do not claim the first fill had changed persisted instructions.

- Selected this persona for the sandbox; note chat header changed while prior chat history remained.
- REA persona-list state: [[90 Attachments/REA/ev_c814f6b9154aec8e299ccf03cd7e2e04e9d572d97be620f594ed02351713fdb0.json]].
- UI settings snapshot: [[90 Attachments/UI/settings.txt]]. No vendor template prompt is adopted as ThinkVis implementation text.

## EXP-05 — Tutor question and thread context indicator
**Result:** reproduced once; third intentional AI response in this pass.

Persona: `ThinkVis Sandbox Tutor`; mode: `When you ask`. Exact request:

> Help me test my claim about where plant dry mass comes from. Start with one question.

Answer:

> If you grew a plant and measured its gain in dry mass alongside the loss of minerals from its soil, what would you predict if most of that mass came from minerals absorbed by its roots?

The answer is consistent with the tutor instructions, but the explicit user prompt also requested a question. No controlled A/B persona comparison was run. The note was unchanged. Chat showed `Reading this note: 1 thread` after resolution (not `1 open`). It does **not** prove which thread text was sent to the model.

- Attach-window Evidence: [[90 Attachments/REA/ev_a7defd911b9fa69f5586ffa206999597a28ba386859a98592edb820f6323d690.json]].
- Completed-chat snapshot Evidence: [[90 Attachments/REA/ev_33faf98a3a9eeebb483685d37c7cde38c1849257dc5202ad8dcb9b852d6005bd.json]]. Use this later snapshot rather than treating an earlier initial snapshot as a completed response.

## EXP-06 — Plans and public pricing
**Result:** observed UI/vendor statements, not independent service guarantees.

Billing labeled the account **Free**, displayed `About 30 responses left`, said Free does not refill, and offered Plus/Pro. No purchase/upgrade action was clicked.

Public pricing at `https://www.riddled.ai/pricing` stated:
- Free: unlimited notes/folders; about 30 responses once; spoken notes; PDF/Word/Markdown export.
- Plus: $9.99/month; ongoing read-along and margin conversations; monthly allowance rather than a message count.
- Pro: $19.99/month; twice Plus's room; optional $5 extra allowance advertised.
- All plans claim OpenAI's `GPT-6.1 Sol` for reading, answers, and drawing. **The displayed model name is a vendor claim, not an independently verified backend identity or an available model ID for our app.**
- Teams: $10/active person/month, shared workspace/personas/admin controls, **coming soon**.
- Notes remain usable when the AI allowance runs out; paid overage/reset behavior was not tested.

Sources: [[90 Attachments/UI/billing.txt]], [[90 Attachments/UI/public-pricing.txt]]. Prices and plan semantics may change. These commercial limits do not belong in our local app except as optional budget controls.

## EXP-07 — Markdown export
**Result:** actual downloaded Markdown verified.

- Export dialog offered PDF, Word, Markdown and Include the riddles (default enabled).
- Selected Markdown and exported the sandbox. Browser confirmed `Exported ThinkVis Research — Disposable.md.` Actual file appeared in Downloads and was read.
- Artifact: [[90 Attachments/sandbox-export]]. It contains the note body and a `Riddled's notes` section with a quoted photosynthesis sentence and the **resolved** correction.
- In this export, note-wide chat, persona instructions and explicit resolution metadata were absent. Note purpose was saved later in EXP-09, so purpose-export behavior was not tested. This is a result for one file, not a guarantee of all export variants.
- Original download SHA-256: `d934251c71868732184e873fa423dc3264c3a11409aa6bf9498eedb31ffe4dd4`.
- Dialog: [[90 Attachments/UI/export-dialog.txt]]. PDF/Word export were not executed. Clipboard copy was not executed.

## EXP-08 — Reload persistence
**Result:** reproduced once in the same Chrome profile/account; not an offline or cross-device test.

Reloaded the sandbox after `All notes saved`. Its title/body, quiet mode and selected custom persona persisted. Reopened chat: both user questions and both responses remained, and the resolved-thread count still read 1. Margin feedback stayed hidden after resolution. Folder was created later, so folder persistence across reload was not separately tested.

Sources: [[90 Attachments/UI/persisted-conversation.txt]] and [[90 Attachments/REA/ev_d5fdf689bd6a82c9459057de78fd86eebbe939b97597bc3cb8640580e58bf19a.json]].

## EXP-09 — Note purpose, folder organization, palette
**Result:** save/move observed; some checks remain incomplete.

- Saved this note purpose via Tell Riddled:

> This is a disposable biology study note. Help me diagnose misconceptions before offering a complete explanation.

  It appeared as an editable context chip. A further reload and model-side effect were not tested.
- Created folder `ThinkVis Research Sandbox`; dragged only our sandbox note into it; collapsing displayed count 1 and hid the sandbox note while the welcome note remained outside. Left folder collapsed.
- Folder options offered Rename and `Delete folder notes stay`. Neither executed.
- Palette title query `ThinkVis` produced the existing sandbox note and Start “ThinkVis” in DOM. Some accessibility snapshots reported an empty listbox even when DOM contained options. A body-marker query was inconclusive; do not conclude full-text search is absent.
- Passive palette Evidence: [[90 Attachments/REA/ev_7cbd1ddb943a4c51ee45c3ac7ebf9e9a3eba3f5e871e12386ba44119d7bb9014.json]]. It is not a full-text search success record.

## EXP-10 — REA static analysis and scenario boundary
**Result:** useful bounded static evidence; partial parsing, not a recovered backend.

See [[REA Evidence and Limitations]] for exact record links and limitations. Thirteen source records were inventoried; one script analysis hit its per-script deadline. Route view returned no candidates with partial coverage. That is **not proof that routes/endpoints are absent**.

No controlled REA scenario executed: its connect input requires HTTP discovery, while Chrome's enabled remote-debugging service provided a usable browser WebSocket but returned 404 for `/json/version`. Input rejection occurred before actions. Chrome DevTools performed actual inputs; REA records are passive observations, not those actions' execution receipts.

## Artifacts and cleanup state
Intentionally retained so the user can inspect/reuse them:
- Riddled folder: `ThinkVis Research Sandbox` (collapsed).
- One Riddled sandbox note: `ThinkVis Research — Disposable`, inside that folder, quiet mode.
- One custom Riddler: `ThinkVis Sandbox Tutor`, assigned only to the sandbox.
- Two note-chat exchanges and one resolved margin thread.
- One Markdown download in the user's Downloads plus its vault copy.
- Separate public pricing tab opened for research and closed after its text was saved. No unrelated tabs intentionally operated on.

No welcome/personal-note edits, note deletions, public shares, purchases, upgrades, microphone permission changes, or personal-file uploads. Do not delete the sandbox artifacts automatically; cleanup can be an explicit later user choice.

## Remaining discriminating tests
Thread reply/reopen, stale/duplicate anchors after edits, distinct-marker context recall, formatting/undo/paste limits, attachment inputs, actual drawings, voice, PDF/Word export, offline/conflict recovery, provider failures/cancellation, and multi-device behavior. Sharing and quota exhaustion are intentionally out of scope. Use [[Research Test Matrix]] to prioritize rather than spending responses speculatively.
