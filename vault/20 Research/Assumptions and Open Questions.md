# Assumptions and Open Questions

## Confirmed user intent
- Personal use, running locally.
- Independent functionality inspired by Riddled, researched with REA.
- Obsidian vault for research; Herdr delegation welcomed.
- Ability to use different existing providers/models.

## Implementation hypotheses — not recovered facts
| Hypothesis / proposed choice | Why plausible | How to resolve cheaply |
|---|---|---|
| A Markdown-compatible notebook is a better foundation than a full LMS. | Observed Riddled writing/feedback loop and user's personal-use scope. | Ask which study tasks matter most; build a small notebook slice. |
| Standalone local app is preferable to a first-pass Obsidian plugin. | Easier controlled provider/runtime host; research vault remains useful. | User choice; compare plugin security/UX/packaging spike if requested. |
| Existing subscription access can be reused through some supported runtimes. | Public Pi/Copilot integration documentation describes routes. | Verify exact runtime/provider entitlement and tools/privacy controls; never copy tokens or assume general API use. |
| Proactive feedback should be debounced and revision-scoped. | Useful behavior observed, exact scheduling unknown. | Implement own bounded policy and deterministic tests. |
| Stable block + quote/context anchors will be sufficient for the MVP. | Source JSON carries quotes; robust local matching is implementable. | Duplicate/moved/deleted quote and external-edit acceptance tests. |
| Markdown source plus SQLite metadata supports Obsidian interoperability. | Portable notes plus app-owned threads/history. | Lossless supported-subset round-trip and recovery spike; choose canonical format explicitly. |

## User choices before implementation
1. Standalone browser/desktop app, Obsidian plugin, or a later companion integration?
2. Which connection types should work first: current Pi/Copilot access, direct APIs, local Ollama/LM Studio, or a combination? Supply names/route preferences, **not secrets in chat**.
3. Is private-local inference required for some notes, or is explicitly selected remote inference acceptable?
4. Preferred source-data folder and backup behavior; do not assume the research vault is the runtime app's data folder.
5. Core notebook/misconception tutoring first, or active-recall/flashcard/review features in the first MVP?

## Research unknowns
- Exact AI scheduling, debounce, intervention-frequency thresholds and duplicate suppression.
- Note marker retrieval and real context inclusion/freshness; common-knowledge correct answers are not sufficient proof.
- Anchor drift, duplicate quotes, thread replies, reopen/dismiss semantics and conversion to a note.
- Undo/redo, large paste/formatting, unsupported Markdown, crashes/offline/concurrent edits, cross-device sync.
- Attachment types/limits, image generation and voice/transcription behavior.
- PDF/Word export fidelity; sharing/access revocation intentionally not exercised.
- Model identity/settings, private system prompts, moderation/retention guarantees, backend storage and billing-unit details.
- Exact provider entitlements, local hardware/runtime capacity and model quality for this user's future app.

## Explicit non-goals for this pass
No private backend recovery, cloning brand assets, bypassing paid access or Google login controls, extracting auth tokens, exhausting free responses, publishing notes, or deploying a service. Paid-plan and teams marketing does not imply tested availability.

## What counts as a good guess
A written hypothesis with alternatives, a reason, a cheap test and a fallback. A guess must not appear as a verified Riddled fact. Own product choices can be useful even when there is no corresponding vendor feature; label them accordingly.
