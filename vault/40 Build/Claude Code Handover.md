---
tags: [handover, claude-code]
status: ready
---
# Claude Code Handover

## Current task state
Research/design phase completed. This repository is a **research and design vault**, not a working learning application. No feature code, API adapter, secret, runtime database, deployment, or provider connection exists here. Do not treat untracked files as disposable: the vault, README, `AGENTS.md`, `.gitignore`, and `scripts/validate-vault.mjs` are intentional deliverables. Nothing has been committed.

## User goals
- Obsidian vault containing the research/decisions.
- An independent **personal-use local learning notebook** inspired by observable Riddled functionality.
- Select among different user-authorized providers/models, including appropriate local models and existing supported runtime access.
- Use Herdr for orchestration, REA MCP for authorized browser evidence; transition from Pi panes to Claude Code panes now.

The user has **not yet chosen** standalone local app versus Obsidian plugin, canonical runtime data directory, first provider/connection route, or which optional learning features belong in MVP. Ask before coding or testing an inference connection.

## Evidence/read order
1. `AGENTS.md` — project guardrails and research state.
2. `vault/00 Home.md` → `vault/20 Research/Research Index.md`.
3. `vault/20 Research/Experiment Log.md`, `Feature Map.md`, `REA Evidence and Limitations.md`, `Research Test Matrix.md`, `Assumptions and Open Questions.md`.
4. `vault/30 Architecture/System Design.md`, `Data Model and Anchors.md`, `Provider and Model Architecture.md`, `Model Capability Matrix.md`.
5. `vault/40 Build/Architecture Review.md`, `Build Roadmap.md`, `Decision Log.md`.
6. `README.md`; run `node scripts/validate-vault.mjs` after edits.

## Research results in brief
On one free account, directly tested a disposable note: note chat, proactive quote-anchored correction, resolving feedback, custom persona create/edit/select, one Socratic response, same-profile reload persistence, note purpose, folder creation/drag/collapse, and actual Markdown export. A custom Socratic response is not a controlled persona comparison. Export included a resolved correction; saved note-purpose export was not tested. No welcome note changed.

Public pricing and the Billing UI described Free as ~30 responses once/non-refilling and all plans as the same named model; these are vendor claims, not independently verified model identity or backend facts. Three AI responses were intentionally elicited, then **generation testing stopped**. Do not generate further Riddled answers without a new user decision about allowance.

REA attached to user's normal Chrome via WebSocket; passive inspection and static bundle analysis worked, with incomplete coverage. This REA release rejected scenario capture because scenario connect expects HTTP discovery; no REA scenario actions ran. UI actions used Chrome DevTools instead. Do not claim private backend, prompts, anchor algorithm or model were recovered.

Two Herdr delegates completed:
- `model-architect`: sourced, version-aware provider compatibility/entitlement/privacy architecture and independent security review; findings incorporated into the system/data/provider docs.
- `research-reviewer`: updated 45-case matrix from primary experiment log, preserving unknowns and costs.

## Architecture/security constraints
- Keep the **MVP** limited to editor/notes, note-scoped chat, optional source-anchored feedback, personas, provider/model selection, privacy/usage, persistence/export. Quizzes/flashcards/rubric grades/spaced repetition are later optional ideas, not observed Riddled features or baseline requirements.
- Separate provider/connection authorization from model identity and pedagogical persona. Chat subscription is not automatically an API credential. Never read or copy other apps' auth stores. No credentials in vault, logs, flags, browser, or Markdown.
- Distinguish direct API, user-selected local-compatible endpoint, and explicit supported agent-runtime bridge (e.g. Pi/Copilot) with separate capability and entitlement checks. No unapproved silent fallback, especially from local-only to cloud.
- Recheck current consent/mode/note/privacy/route/budget immediately before every outbound attempt, including retry/repair. Quiet-mode switch invalidates queued proactive work and requests in-flight abort; transmitted text cannot be recalled.
- No model tools by default; no shell, arbitrary filesystem, browser, MCP, subagents or network fetching. Validate any returned references against the exact trusted request manifest; derive DB targets on the host, never from model-supplied IDs.
- Secure local host and content: loopback auth, Host/Origin/CSRF checks, sanitized Markdown/model output, unsafe HTML/URLs disabled, remote images blocked by default, canonical-root path/symlink containment, restore decompression/size limits.
- Distinguish anchor position from context freshness and thread resolution. Exact quote persistence does not mean old feedback is contextually current.
- Backups use an app-owned allowlist; exclude credentials, native session handles, bridge caches/logs by default. Local paths may be cloud-synced; private-local mode needs an approved non-synced destination.

## Immediate Claude Code task
This is a **handoff/read-only orientation**. Inspect repository/vault and validation output. Do not implement, install, configure providers, modify/delete existing files, commit, deploy, or open/control the browser. Confirm what the deliverables contain and report the 4-6 user decisions needed to choose the first implementation slice. Keep unresolved choices unresolved; ask the user before code changes.

The user requested Pi panes be closed after recording their work. Current managed ThinkVis workspace is `w3`; its Pi panes were `w3:p1` (current primary), `w3:p3` (architecture delegate, done), and `w3:p4` (research reviewer, done). The two completed delegate panes have been closed after their results were captured. A Claude Code pane is open in tab `w3:t2`, pane `w3:p5`, but startup is **blocked at Claude Code's interactive trust prompt** (“Claude Code'll be able to read, edit, and execute files here”). Do not choose Yes without user approval. Ask the user to focus that tab and explicitly approve trust (Enter) before Claude reads/edits/executes in this repository. After trust, complete the read-only orientation prompt above. The primary Pi pane `w3:p1` is to be closed now, as requested. Unrelated Pi panes in other workspaces (e.g. SimulationAPI) are **out of scope** and remain open. This note plus completed research docs are the handover; do not rely on Pi's ephemeral session history.
