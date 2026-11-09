# Architecture Review

Herdr delegate `model-architect` reviewed the proposed [[System Design]] and [[Data Model and Anchors]] against the provider documents. This was **documentation review**, not a runtime security audit. Primary researcher incorporated all seven findings below into the design; none is evidence that an unbuilt app already enforces a control.

| Finding | Design resolution |
|---|---|
| Untrusted Markdown/model/attachment rendering could execute or leak data. | Sanitize rendered content, reject active HTML/unsafe URL schemes, block automatic remote images/embeds and require explicit external-navigation/media consent. |
| Paths/recovery/restore lacked containment. | Canonical-root containment with symlink/reparse-point policy across reads/writes/assets/export/recovery; imported journals cannot authorize arbitrary paths; restore resource limits. |
| Enqueue-time approval did not prevent later unauthorized dispatch. | Recheck current consent/mode/note existence/privacy/route/budget at **every outbound attempt**, including repair/retry. Quiet-mode switch invalidates queued proactive work and requests in-flight abort; cannot retract already-sent text. |
| Model-returned note/block IDs could target unauthorized content. | Derive targets from trusted request state; every identifier/reference must match the exact authorized originating manifest, not merely an existing note. |
| Exact quote match is not contextual freshness. | Track anchor position validity, context freshness and thread resolution independently. Surrounding text changes may stale feedback without moving the quote. |
| Backups could include credential-like native runtime state or sync externally. | Portable backup allowlist; exclude native handles, bridge session files, caches/logs/credentials by default; diagnostics require explicit scope. Local-only storage needs a non-synced destination. |
| Optional learning features were worded as baseline requirements. | Provider documents now explicitly distinguish notebook MVP from later quizzes/rubric grading/spaced repetition. Later grading schema is not the margin-feedback schema. |

## Remaining gate
Each proposed control requires implementation and acceptance tests. The research pass validates only vault integrity/links, JSON, attachment identity names, selected secret markers and the synthetic export hash; it does not validate provider isolation or application security.

## Research review
The separate Herdr `research-reviewer` updated [[Research Test Matrix]] from the completed [[Experiment Log]] and [[Feature Map]], preserving 45 prioritized cases and untested boundaries. It identified the purpose/export timing nuance: purpose was saved **after** export, so the file cannot establish how saved purpose is exported. Primary research notes were corrected accordingly.
