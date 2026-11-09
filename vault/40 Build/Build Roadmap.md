# Build Roadmap

## Current milestone — research workspace complete
- [x] Real Obsidian vault with core-plugin configuration and linked research notes.
- [x] Two independent Herdr delegates: provider architecture and research coverage.
- [x] REA MCP discovery/passive evidence/static analysis, with limitations preserved.
- [x] Actual sandbox note, chat, proactive thread, resolve, persona, persistence, folder and Markdown-export checks.
- [x] Separate observed behavior, vendor claims, inferences and independent proposals.
- [ ] Runtime learning application — **not implemented yet**.
- [ ] User's provider connections — **not configured or tested by this research**.

## Phase 0 — settle the runtime boundary
**Proposed next step.** Choose standalone local app versus Obsidian plugin. Recommended: standalone local web app with Markdown interoperability; this vault remains its research notebook. Confirm storage folder separately from this repository's research vault.

Choose the first authorized inference route(s). We know the research agent currently runs through a GitHub Copilot provider, but this is not a full inventory of the user's accounts or proof of arbitrary app API entitlement. Candidates:
- documented Pi/Copilot runtime bridge for access the user explicitly authorizes;
- one direct API-key route if the user has separately entitled API access;
- one user-selected local-compatible endpoint, or a deterministic mock for offline contract testing.

Do not request keys in chat, read credential stores, download models or start local servers without explicit configuration choices. Pin runtime/SDK versions and verify the chosen route's terms, no-tools isolation, cancellation and allowance behavior.

**Exit criterion:** user-approved runtime/storage direction and one approved connection type; no secret values committed.

## Phase 1 — notebook without AI
**Status 2026-11-09: first slice implemented in `app/` (23 passing tests). Browser UI not yet exercised by a human; recovery after power loss and large-vault performance not tested.**

- Local note repository, stable note IDs, supported Markdown round-trip subset and visible save/conflict states.
- Notes/folders, editor, lexical search, note purpose, per-note assistance mode.
- SQLite metadata migrations and recovery journal; no provider required.
- Portable Markdown export and full backup/restore distinction.

**Tests:** restart persistence, atomic-save recovery, external file edit, unsupported Markdown preservation, path traversal/symlink rules, export round-trip and no accidental source deletion.

## Phase 2 — explicit chat and provider portability
**Status 2026-11-09: implemented with mock-backed tests (48 passing). Not yet exercised against any real provider; streaming not done.**

- App-owned broker contract, connection/model profiles and model picker.
- Provider identity/usage labels on every response; no credential in renderer.
- Note-scope preview, context budget, isolated conversation history, non-streaming and streaming adapters.
- User cancellation, retry policy owner, tool-free defaults, explicit fallback policy.

**Tests:** common adapter suite against deterministic mock; selected real route only after authorization; no-source-edit guarantee; provider switch preserves app-owned history; auth/timeout/invalid output/cancel states; no local-only cloud fallback.

## Phase 3 — margin learning loop
- Source-revision-bound feedback schema, stable block/quote anchors and deduplication.
- Thread replies, resolve/dismiss/history/export, stale-anchor UI.
- Opt-in proactive scheduling with cooldown/spend/egress controls; quiet edits never infer.
- Versioned personas and note-specific purpose, independent from model choice.

**Tests:** duplicate quotes, anchor deletion/movement, old result after edit, resolve during generation, limits on intervention, persona adherence and quoted-source validation. Use [[Research Test Matrix]].

## Phase 4 — useful personal-learning additions
These are **our features, not observed Riddled parity**:
- Active recall prompts, user-authored or generated flashcards, transparent self-assessment.
- Optional rubric feedback with abstention and learner override.
- Deterministic spaced-repetition scheduling and progress from app-owned events.

Build only after the user prioritizes them. Never let malformed model output become a grade or review schedule.

## Phase 5 — optional media and packaging
- Images/diagrams and voice via separately capable adapters and explicit consent.
- PDF/Word export after Markdown is reliable.
- Desktop packaging only after loopback-host/browser security and backups are tested.
- Obsidian plugin/companion integration if desired; not a prerequisite for the local web MVP.

Sharing, teams, payments and cloud accounts are out of scope unless explicitly requested.

## Delivery rule
Every implementation slice adds tests and updates [[Decision Log]]. Keep hypotheses visible until verified. No auto-deploy, public hosting, merge or purchase is implied by research authorization.
