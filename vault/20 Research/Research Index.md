---
tags: [research, riddled, index]
status: active
---
# Research Index

## Goal and scope
Build **ThinkVis**, an independent personal learning notebook that runs locally and can use multiple user-authorized providers/models. Riddled is a behavioral reference, not a backend to depend on or a codebase to clone. The Obsidian vault is the research/decision workspace; it does not yet imply an Obsidian plugin or a running notebook application.

## Read in order
1. [[Feature Map]] — feature coverage and provenance.
2. [[Experiment Log]] — actual inputs, results, limitations, and artifact inventory.
3. [[REA Evidence and Limitations]] — what REA established and what it could not establish.
4. [[Research Test Matrix]] — 45 prioritized test cases and honest gaps.
5. [[System Design]] and [[Data Model and Anchors]] — our proposed implementation.
6. [[Provider and Model Architecture]] and [[Model Capability Matrix]] — optional access routes and capability gates.
7. [[Build Roadmap]], [[Decision Log]], and [[Assumptions and Open Questions]].

## Research methods
- Primary researcher alone controls the authorized signed-in Riddled tab using Chrome DevTools MCP; REA MCP supplies passive page Evidence and static browser-bundle analysis.
- Two named **Herdr** agents work in existing available shell panes in this repository. `model-architect` researches provider/model portability; `research-reviewer` develops the test matrix. They have no MCP/browser access, no credential-store access, no overlapping file ownership, and no authority to launch more agents.
- Preserve canonical REA records under `90 Attachments/REA`. Derived DevTools summaries and UI snapshots are clearly separate; do not present them as REA-generated execution traces.
- Use synthetic content and a bounded generation budget. Three AI responses were intentionally elicited during this pass (two note-chat responses and one proactive margin response); this is not a measurement of billable units or exhaustive requests.
- Keep user identity, tokens, cookies, browser endpoints, raw HTTP headers, and account payloads out of notes and screenshots. No unrelated browser content is part of the research dataset.

## Confidence vocabulary
| Label | Meaning |
|---|---|
| **Observed UI** | The control or text was visible; functionality may still be untested. |
| **Reproduced once** | An actual action produced a result in this account. Not a reliability benchmark. |
| **Vendor claim** | Pricing/settings documentation says it; not independently verified. |
| **Inference** | An interpretation supported by observations but not established as fact. |
| **Proposed** | Our own implementation or product choice. |
| **Unknown** | Not tested or inaccessible within authorized scope. |

## Main findings
- Riddled is primarily an **AI-assisted writing/thinking notebook**, not an observed course/LMS platform. Quizzes, flashcards, spaced repetition, and progress dashboards remain possible ThinkVis additions, not verified Riddled features.
- Notes have proactive/on-demand modes, note-specific purpose, selectable personas, note chat, and quote-anchored feedback threads.
- Actual chat, proactive feedback, resolve, persona creation/edit/selection, note/chat persistence across reload, folders/drag organization, and Markdown export were exercised.
- Two selected AI requests used JSON request/response transport. Word-by-word rendering is not proof of network streaming. No private prompts/backend/model implementation were recovered.
- Free-tier billing/public pricing say the response allowance is **one-time and non-refilling**. Do not spend it to probe its exact limit. Paid plans are outside this research scope.

## Current sandbox state
See [[Experiment Log#Artifacts and cleanup state]]. The welcome note was not edited. No share link, purchase, upgrade, microphone permission, personal-file upload, or account-profile change was performed.

## Source of truth and maintenance
New observations must add an experiment entry or evidence link before becoming a feature claim. When later results supersede the first-pass `docs/research/riddled/findings.md`, update that index instead of silently treating old unknowns as current. Exact plan/model claims are time-sensitive and must be rechecked before implementation decisions depend on them.
