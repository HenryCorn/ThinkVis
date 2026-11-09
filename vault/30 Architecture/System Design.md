---
tags: [architecture, proposed]
status: proposal
---
# System Design

**Everything here is a proposed ThinkVis design unless a statement explicitly points to an experiment.** This is not Riddled's recovered implementation and no application code has been built yet.

## Product boundary
A private, local-first study notebook that challenges misconceptions without taking over the user's writing. Start with the observed useful loop:

```text
write a note → optionally ask for help / enable read-along
→ receive a source-anchored question or explanation
→ discuss it → revise understanding → resolve the thread
```

A course/LMS, team workspace, publishing system, and subscription platform are not required. Quiz/flashcard/review-scheduling features are optional later additions. The research vault is a real Obsidian vault now; whether the running app is standalone or an Obsidian plugin is still a user decision. Recommend a standalone local web app first, with Markdown interoperability, rather than assuming a plugin can safely access all desired runtimes.

## Proposed runtime components
```text
Local browser UI (editor, margin threads, chat, model picker)
      │ authenticated loopback API / event stream
Local application host
      ├─ Note repository + revision/anchor engine
      ├─ Note-scoped conversations + persona versions
      ├─ AI task orchestrator + context planner
      ├─ Capability/entitlement/privacy/budget gates
      ├─ Provider broker and normalized events
      │    ├─ Native provider API adapters
      │    ├─ User-selected local compatible servers
      │    └─ Optional isolated Pi/Copilot runtime bridge
      └─ Persistence, lexical index, export, backup
```

Use a TypeScript-first stack as a **candidate**, not a committed choice: a rich-text editor such as Tiptap/ProseMirror, a local Node host, SQLite for app metadata and FTS, and Markdown files for notes. Observed Riddled editor DOM classes support that editor family; they do not prove its complete stack or versions. A .NET host could implement the same contract; choose after provider-bridge and packaging spikes. No Aspire scaffolding is needed for the current documentation-only repository.

## Storage and Obsidian interoperability
Recommended **provisional** direction:
- Source notes are Markdown in a user-selected data folder, with stable note identity and revision hash. Do not silently use this research vault as test/runtime data.
- SQLite stores conversations, thread state, persona versions, request/usage records, and rebuildable search/index metadata. Notes and AI state are app-owned, not provider-owned.
- Rich editing has an explicitly supported Markdown subset. Unsupported constructs are preserved or opened in source mode, not silently stripped. Round-trip tests precede enabling formatting features.
- External file edits are detected and reconciled; do not overwrite a changed file just because the editor has a stale draft.
- Metadata and file writes need a recovery journal because a filesystem replace and SQLite transaction are not one atomic transaction. Use temp + flush + atomic replace plus expected-revision checks; recover interrupted operations on startup.
- Export Markdown alone for readable portability; offer a full backup including app metadata for lossless thread/chat restoration. Clearly describe the difference.

If full-fidelity editor JSON becomes canonical instead, that is a different storage decision and must be approved/documented. Do not promise lossless arbitrary Markdown and arbitrary rich-text JSON simultaneously. See [[Data Model and Anchors]].

## Explicit task types
| Task | Inputs/context | Output / ownership |
|---|---|---|
| `noteChat` | Current note revision, purpose, persona, bounded conversation, optionally selected thread summaries | Answer text + optional verified references. No note edits. |
| `evaluateRevision` | Changed blocks plus sufficient surrounding context, prior thread fingerprints, purpose/persona | Zero or more candidate feedback objects; application validates/deduplicates. No output is a valid result. |
| `threadReply` | Exact thread quote/source revision, bounded thread history, current note excerpt | Thread answer; never silently convert into global note chat. |
| `explainSelection` | User-selected span, surrounding context and purpose | Explanation/question linked to that selection, with a scope preview. |
| `suggestEdit` (later) | User-authorized span and revision | Proposed patch/diff, requiring confirmation and revision check before application. |
| `generateDiagram` / `transcribe` (later) | Separately approved media input and capability | Local asset/transcript with provenance. Text capability is insufficient. |

Task names are ours; do not re-use Riddled endpoints or private task values as dependencies. Source request field names are evidence about one observed client exchange, not our API contract.

## Read-along orchestration
**Proposed policy, not recovered scheduling:**
1. Quiet mode: ordinary edits never schedule inference. Opening settings/search/export does not schedule inference.
2. Proactive mode: wait for a configurable idle interval and a meaningful edit; apply a cooldown, maximum pending requests and visible budget. Timer values require user testing; no fabricated Riddled timings.
3. Snapshot an immutable revision. Check selected provider/model, privacy/egress consent, persona version and allowance before enqueueing.
4. Immediately before every outbound attempt (including retries/repair), recheck current consent, mode, note existence, privacy/egress policy, selected route authorization and budget. Switching to quiet mode invalidates queued proactive work and requests abort for in-flight proactive work; cancellation cannot retract content already sent. Minimize context: changed blocks plus relevant surrounding text and unresolved feedback. Large notes need transparent truncation/retrieval, not hidden full-note uploads.
5. Cancel superseded work when safe. Responses carry the original revision; late results cannot attach blindly to new text.
6. Validate source anchors, output size/schema, severity and deduplication. Never treat silence or malformed output as evidence of correct understanding.
7. Place new feedback in the margin without rewriting source text. Allow read/resolve/dismiss; saving an actual source edit is a separate user action.
8. Record usage and reason for intervention. Repetitive feedback, escalating token use, or a stale-quote result must degrade gracefully.

Do not infer 'one comment per paragraph', timing thresholds, or automatic re-evaluation after resolve from the single Riddled test.

## Provider/model choice
See [[Provider and Model Architecture]] and [[Model Capability Matrix]].

- A **connection** is an authorized route (API, local server, supported runtime), not just a provider brand. A **model profile** is scoped to connection + endpoint + model ID/revision + adapter version.
- Choose a default and optional per-note/task override. Store which route actually produced each response; switching persona is independent of switching model.
- Prefer user's explicit pin. Unknown or failed capability means ineligible for tasks requiring that capability; text chat can work without native JSON schema, vision or tools.
- Support non-streaming providers. Normalize native streaming where available; do not require fake word reveal to mask response timing.
- Optional Pi/Copilot bridges must use documented programmatic interfaces, isolated resources and denied tools by default. Reuse an authorized runtime boundary, **not copied tokens**. A subscription does not establish general API entitlement.
- No automatic cloud fallback from local-only mode and no switching authenticated identities after denial. Optional fallback requires pre-approved routes and records all attempts/costs.

## Security and failure behavior
- Bind to loopback by default; authenticate browser-to-host requests; validate Host/Origin and protect state-changing endpoints from CSRF. Loopback alone is not an authorization boundary.
- Keep secrets out of the browser, Markdown, exports and logs. Endpoint URLs cannot carry credentials. Restrict redirects/hosts to prevent secret forwarding and SSRF.
- Treat rendered Markdown/model output and attachments as untrusted: sanitize HTML, forbid active scripts/unsafe URL schemes, disable remote-image auto-fetch and require explicit consent for external navigation/media. A remote image can leak a note-opening event even without an LLM request.
- Constrain repository paths by canonical root and symlink/reparse-point policy for notes, exports, backups and recovery operations. Imported recovery records cannot authorize arbitrary paths. Restore must defend against traversal and compressed/oversized input, with byte/file/depth limits.
- Source notes are untrusted model context, not executable instructions. Models have no shell, arbitrary filesystem, browser, MCP, or generic network tools in the MVP.
- Cancellation is an app state transition plus adapter abort. Ignore late output and leave the learner's text intact; remote compute/billing termination may remain uncertain.
- Auth errors stop; transient retries are bounded and owned in one layer; malformed structured output can have one bounded repair if policy allows. Failed grades/anchors are never persisted as accepted facts.
- Editing, lexical search, export and manual thread management work with no provider. Show offline/error/save-conflict states without erasing text.

## Acceptance criteria for the first working slice
1. Two local notes survive restart; welcome/sample fixtures stay isolated from user data.
2. Explicit note chat uses only previewed note scope, changes no source text, and labels provider/model.
3. At least one hosted/direct or authorized runtime route and one local-compatible mock route pass the same contract tests; live routes enabled only after user choice.
4. Proactive mode is opt-in; quiet-mode edits produce **zero inference calls** in tests.
5. Anchored feedback survives nearby edits or becomes visibly stale; never silently attaches to the wrong duplicate quote.
6. Resolved threads remain available in history/export; deletion is separate and confirmed.
7. Request cancellation and provider failure preserve drafts and avoid duplicate persisted responses.
8. Markdown and full-backup restoration tests document exactly what is lossless.
9. No secret values in frontend bundles, notes, exports, snapshots, logs or test fixtures.

The full coverage plan is [[Research Test Matrix]].
