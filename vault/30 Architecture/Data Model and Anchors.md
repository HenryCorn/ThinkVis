---
tags: [architecture, data-model, proposed]
status: proposal
---
# Data Model and Anchors

**Proposed app-owned schema**, not recovered Riddled storage. Observed quote-bearing JSON feedback is motivation, not proof of the vendor's anchoring algorithm.

## Entities
| Entity | Important fields / invariant |
|---|---|
| `Note` | Stable ID, relative Markdown path, title, source revision/hash, purpose, mode, persona ID, optional connection/model override, timestamps. Path is not identity. |
| `NoteRevision` | Immutable revision ID/hash, content snapshot or bounded history reference, block map, change provenance. A response never refers only to the mutable 'current note'. |
| `Folder` | Stable ID/path or repository directory mapping, ordering/collapse preference. Deleting a folder and deleting its notes are distinct operations. |
| `Persona` / `PersonaVersion` | Name/description; immutable instruction/style/frequency version. Existing feedback records the version used. Model and connection are separate fields. |
| `FeedbackThread` | Note ID, source revision, anchor, state (`open/resolved/dismissed/stale`), source actor/model, timestamps. Stale is preferably an anchor-validity dimension separate from conversational resolution. |
| `Anchor` | Block ID, exact quote, normalized quote, prefix/suffix context, original offsets, source hash, current resolved position, resolution method/confidence. No silent approximate match. |
| `ThreadMessage` | Thread ID, actor, validated text/content blocks, request ID, provider/model, persona version. A reply is not necessarily a new feedback anchor. |
| `NoteConversation` / `ChatMessage` | Note ID, portable app-owned messages, context manifest, optional native session handle hidden inside the connection adapter. |
| `Connection` | Adapter kind, approved endpoint, opaque credential reference, auth status, privacy/budget/fallback policy. **No secret value.** |
| `ModelProfile` | Connection-scoped wire ID/revision, declared/tested capabilities, limits, usage-price freshness. Family name alone is not executable identity. |
| `InferenceRequest` | Task, note/source revision, persona version, selected connection/model, immutable context manifest, state/attempts/cancel token reference. |
| `UsageRecord` | Request/attempt, reported/estimated/unknown units, token categories or subscription allowance, price source/time. Missing usage is never represented as free. |
| `Attachment` | Relative path, hash, MIME/size, provenance, approved processing status. Image presence is not proof the model saw it. |
| `RecoveryOperation` | Expected old revision, intended new revision, temp/target file, metadata transaction state. Reconcile interrupted file/SQLite changes. |

## Proposed anchor strategy

1. Assign stable block IDs within the supported document representation. If persisted in Markdown, choose an Obsidian-compatible or sidecar format deliberately and test external-editor preservation; this encoding is not yet fixed.
2. At request time, record source revision, block ID, exact quote and bounded prefix/suffix. Map source offsets to editor positions in app code, not by trusting model-supplied offsets.
3. For edits in the current editor session, transform anchor ranges through editor transactions. Deleting the anchored text or splitting/merging blocks requires explicit reconciliation.
4. When reopening or ingesting an external edit, try the stable block and unique exact quote first. If exactly one match remains in the approved block/context, re-anchor and record the method.
5. If not exact, try a bounded context-assisted candidate search. Treat fuzzy/normalized matches as lower confidence requiring a visible stale/review state; never silently assert correctness.
6. Track **positional anchor validity**, **context freshness** and **resolution state** independently. An unchanged quote or successfully transformed range can still have obsolete feedback after surrounding text changes; exact matching must not automatically mark old reasoning current. Multiple identical quotes are ambiguous. Do not select the first document match; use block identity/context or ask the user to relocate it.
7. A late model response for an older revision can be displayed as historical feedback or revalidated against current text. It cannot overwrite a new revision or revive resolved threads silently.
8. Resolving a thread changes its lifecycle state, not the source text or existence of its messages. Export includes/excludes resolved/dismissed content only according to explicit options.

## Proposed structured feedback envelope
Illustrative contract, not vendor JSON:

```json
{
  "schemaVersion": 1,
  "taskId": "request-id",
  "noteId": "note-id",
  "sourceRevision": "content-hash",
  "items": [
    {
      "blockId": "stable-block-id",
      "quote": "exact source excerpt",
      "kind": "question",
      "text": "A short diagnostic question or explanation.",
      "confidence": "needs_review"
    }
  ]
}
```

Derive persistence targets from trusted originating request state, never from model-returned identifiers. Require `taskId`, `noteId`, `sourceRevision`, `blockId` and every reference to match that exact authorized context manifest, not merely an existing note/block. Validate required/unknown fields, sizes, enumeration, quote membership and content policy. `items: []` is valid. `confidence` is model-supplied guidance, not calibrated evidence. The application adds provenance, anchor status, dedupe keys and timestamps; the model cannot choose database IDs, write files, resolve threads, or set canonical grades.

## Conversation/context invariants
- Notes, purpose, personas and prior messages are separate context components. Show which were selected and which were omitted/truncated.
- Switching a persona affects future inference and keeps historical provenance; it must not relabel old responses as generated by the new persona.
- Switching providers builds a bounded context from portable messages/evidence. Native reasoning/tool/session state is not universally portable.
- Record quoted source hash/span in references; a reference resolving to real text does not prove the factual claim is true.
- If a note changes during generation, the result must still identify the old source revision. Context freshness is observable, not assumed.

## Persistence and backup
Provisional Markdown-canonical note storage plus SQLite metadata is described in [[System Design]]. Exported Markdown alone is not a full app backup. A complete backup needs source notes, attachments, persona versions, conversations, feedback/anchors, migration version and a manifest of hashes; provider credentials are always excluded.

Use a portable-backup allowlist: app-owned source/content/metadata only. Exclude native adapter session handles, bridge session files, raw runtime caches, logs and credentials by default; any separate diagnostic archive needs explicit scope/redaction/consent. Full backups contain sensitive learning content; 'local' additionally requires an approved non-cloud-synced destination. A local folder path alone does not establish that. Restoring should never auto-enable remote connections, invoke models, import executable hooks, or overwrite conflicting live data without preview.

## Required tests before relying on anchors
Duplicate quotes; Unicode/emoji normalization; multiline selections; inline markup; heading/body boundaries; insertion before quote; deletion of quote; block move/split/merge; undo/redo; external Markdown edit; note rename; stale response; resolve during generation; deleted note; export/reimport with optional block IDs. These are **local acceptance tests not yet run**, not Riddled parity claims.
