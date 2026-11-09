---
tags: [research, features]
status: first-pass-tested
---
# Feature Map

All findings are limited to one signed-in free account and this research pass. See [[Experiment Log]] for exact tests. **A visible affordance is not a tested capability.**

## Writing and organization
| Feature | Evidence/status | ThinkVis implication — proposed |
|---|---|---|
| Rich-text editor with first-heading title | **Reproduced once:** title and body paragraphs edited. DOM classes identify Tiptap/ProseMirror; that is frontend evidence, not a full dependency/version audit. | Structured editor with explicit title/body boundaries and documented Markdown round-trip subset. |
| Autosave | **Reproduced once:** `All notes saved`, followed by reload retaining the sandbox content. Does not establish offline, multi-device, or crash consistency. | Visible save states, revision hashes, atomic local writes and recoverable drafts. |
| Per-note purpose | **Reproduced once:** `Tell Riddled` opens an instruction/context form; saved synthetic purpose appears above the note. Prompt precedence and persistence across a subsequent reload remain untested. | Separate `purpose` field; scope it to the selected note. Not the chat transcript. |
| Notes/folders | **Reproduced once:** created a named folder, dragged the sandbox note into it, collapsed the folder and saw count 1 with the note hidden. | Plain organization independent of provider. Test undo and safe folder deletion locally. |
| Command palette | **Observed UI + title match:** title query produced the sandbox note and a start-new-note option in DOM. Accessibility snapshots omitted option descendants. | Search/create palette with accessible options; require full-text search separately. |
| Full-text search | **Unknown:** a body-marker query was attempted but no reliable settled DOM comparison was retained. | Implement local lexical full-text search deliberately; do not claim parity based on title matching. |
| Delete/copy | **Observed UI:** note menu exposes Copy as Markdown, Export, Delete. No deletion or clipboard copy tested. | Confirm destructive operations; export before delete; avoid hidden clipboard writes. |

## AI assistance
| Feature | Evidence/status | ThinkVis implication — proposed |
|---|---|---|
| Proactive mode | **Reproduced once:** selected `Thinks with you`, appended text, received a correction attached to an earlier sentence. Exact trigger/debounce/context policy is **unknown**. | Debounced, revision-scoped evaluation with per-note enablement, cooldown, deduplication, and visible spend/egress policy. |
| On-demand mode | **Reproduced once in a bounded interval:** no new margin thread appeared during initial setup; explicit note chat worked. Does not prove all implicit triggers are disabled. | Quiet means no model request on ordinary typing; explicit selection/chat actions allowed and attributable. |
| Margin feedback | **Reproduced once:** AI returned a correction and a quoted source sentence. The response object carried `thought`, `quote`, `kind`, nested `message`, and nullable persona version fields. | Typed feedback object with source revision + stable block + quote/prefix/suffix anchor. |
| Thread lifecycle | **Reproduced once:** Resolve removed thread from margin; chat later still reported one thread; Markdown export retained its feedback. | Distinguish open/resolved/dismissed from deleted. Export filters must be explicit. |
| Thread conversation | **Observed UI:** Reply textbox, Send, full-screen control. No thread reply submitted. | Independent thread messages, scoped context, status/error state. |
| Thread-to-note | **Observed UI:** Make a note menu item. Not executed. | Optional conversion with source attribution, no assumed account data model. |
| Note-wide chat | **Reproduced:** two submissions, returned useful responses; original note text stayed unchanged; history survived reload and persona switching. Does not prove full-context inclusion or context freshness. | App-owned conversation history; explicit note and thread scope; provider switching must rebuild portable context. |
| Response rendering | **Observed:** word-by-word UI reveal. **Transport:** two inspected requests were `application/json`, not a demonstrated streaming protocol. | Separate provider stream normalization from optional visual reveal. Always support non-streaming models. |
| AI status | **Network metadata:** repeated GET `/api/ai-status` and POST `/api/riddled` 200 were observed. Poll timing/semantics unknown. | Our own health/allowance API; do not depend on Riddled endpoints. |
| Selection/name-triggered invocation | **Vendor UI description:** quiet mode mentions saying its name, selecting words, or chat. Programmatic text selection did not establish the user-facing selection workflow. | Treat selected-text assistance as a separate task, with explicit content scope and tests. |

## Personas and configuration
| Feature | Evidence/status | ThinkVis implication — proposed |
|---|---|---|
| Custom personas | **Reproduced:** created, edited, saved, selected `ThinkVis Sandbox Tutor` on the sandbox note. | Versioned persona independent of model/provider. |
| Persona fields | **Observed and partly exercised:** name, description, instruction text, voice (`Plain/Warm/Blunt/Riddle`), intervention frequency (`Rarely/When it matters/Often`). | Separate semantic instructions, style, and generation-frequency policy. Values need validation. |
| Presets | **Observed UI:** Staff engineer, Editor, Skeptic, Socratic tutor, Investor, Blank; selecting a preset populated fields. | Author our own presets; do not copy exact vendor instruction text. |
| Persona effect | **One supportive example:** after selecting the sandbox tutor, a request to begin with a question yielded one diagnostic question. Both user prompt and persona favored that output; **not a controlled causal comparison**. | Evaluate persona adherence with fixed tests across selected models; don't equate selector changes with reliable behavior. |
| Appearance | **Observed UI only:** theme, text size, AI lettering/color, reading pace, both/right margins or marks-only, pointer ink, default new-note mode. No global setting changed. | Accessibility and typography before decorative parity; implement settings incrementally. |
| About-you/profile | Section controls visible; private content not investigated. | Optional user learning preferences, explicit inclusion in prompts. No automatic account scraping. |

## Media, portability, access
| Feature | Evidence/status | ThinkVis implication — proposed |
|---|---|---|
| Drawings | **Observed pre-existing welcome example:** image and enlargement control. Pricing says drawings use the allowance. No generation tested. | Optional separately capable adapter; never require image generation for text tutoring. |
| Voice | **Observed hint + vendor claim:** Alt-to-speak and pricing advertises spoken notes. No recording/permission requested. | Explicit microphone consent; separate transcription/audio capabilities and text fallback. |
| File/image input | AI request shape includes image count/key fields; this alone **does not establish upload UI or accepted formats**. No files uploaded. | Explicit attachment pipeline, MIME/size checks, no hidden multimodal drops. |
| Markdown export | **Reproduced:** actual downloaded file includes user paragraphs and the resolved feedback under a quoted anchor. Note-wide chat, persona instruction, and explicit resolution metadata were not present in this one export. Note purpose was saved later, so purpose-export behavior was not tested. | Portable Markdown plus optional sidecar metadata and separately selectable chats/threads. |
| PDF/Word export | **Observed UI only:** formats listed. Not exported. | Defer until Markdown round-trip works. |
| Sharing | **Observed control only:** read-only link description. Not clicked; no public link created. | Default private local app; sharing out of MVP. |
| Plans/model | **Vendor claim only:** public pricing says all plans use the same named model, with different allowance. Billing identified this account as Free. | Our app must expose connection + model identity and real capability/entitlement status rather than fixed branding. |
| Teams | **Public pricing:** coming soon, shared workspaces/personas/admin controls advertised. Not a tested available product. | Out of personal-use MVP. |

## Not observed; optional ThinkVis additions
Course authoring, course import, quizzes, flashcards, spaced repetition, knowledge graphs, long-term mastery tracking, citations to external textbooks, and grading dashboards were **not verified** in Riddled. Include only if useful to the user's learning goal, and label them as our own product choices.
