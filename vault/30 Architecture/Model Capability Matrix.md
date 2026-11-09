# Model Capability Matrix

Companion to [[Provider and Model Architecture]]. **This is a routing design and documentation-evidence matrix, not a benchmark or inventory of the user's accounts.** No model requests, endpoint probes, authentication, browser/MCP activity, installations, or private-configuration inspection were performed.

## Reading the matrix

- **D — documented:** the cited public documentation describes the mechanism. This is not a successful runtime test.
- **V — verify:** exact adapter/runtime/server version, model, account, or policy must be checked before enabling it.
- **P — proposed:** a notebook requirement or product decision, not an existing feature.
- **Unknown ≠ unsupported**, but unknown capabilities are ineligible for tasks that require them.

Sources use the identifiers and full source list in [[Provider and Model Architecture#Sources]]. Pi evidence is the installed public **1.5.0** package; other sources are the fetched, mutable upstream documentation. Specific model IDs, prices, context limits, and subscription allowances are deliberately not hardcoded here. The same model family can have different capabilities and entitlement through different connections.

## 1. Access and adapter matrix

| Connection | Documented integration | Required access / entitlement | Billing and privacy | Proposed role |
|---|---|---|---|---|
| OpenAI direct | **D:** official SDK, Responses/Chat, SSE, AbortSignal [D1] | **V:** API credential/eligible supported identity, model/project permissions, billing. No inference from ChatGPT plan ownership. | Remote API usage; token/cache price and retention depend on selected service/model/policy. Subscription allowance is not assumed applicable. | Primary native hosted adapter when user has API access. |
| Anthropic direct | **D:** official server-side Claude API SDK and API-key setup [D2] | **V:** independently authorized API access; do not treat a Claude app subscription/token as an unrestricted API credential. | Remote provider billing/policy; actual model costs and retention **V**. | Native hosted adapter; verify each task feature before advertising it. |
| Gemini direct / cloud project | **D:** official SDK distinguishes Developer API key and cloud-project credentials/services [D3] | **V:** correct API/project credentials, quota, billing and eligible models; consumer plan ownership is insufficient evidence. | Service-specific remote quotas/prices; service choice matters [D3]. | Native hosted adapter with explicit service identity. |
| Ollama local compatible endpoint | **D:** example `http://localhost:11434/v1`; local dummy client key is ignored [L1] | Running user-selected server and usable local model; hardware/version checks **V**. No hosted API key needed for ordinary local inference. | Local compute; **V:** truly local model, no cloud forwarding or external tool egress. Ollama also documents cloud access [L1]. | Preferred private-local candidate after deployment verification. |
| LM Studio local compatible endpoint | **D:** example `http://localhost:1234/v1`, reusable OpenAI clients [L3] | Running user-selected server and model. Endpoint auth/binding/configuration **V**; a dummy SDK key is not proof of server authentication [L4]. | Local compute; offline/egress, runtime logging and binding **V**. | Private-local candidate with independent LM Studio profile/tests. |
| Pi embedded SDK | **D:** Node/Bun session API, configurable runtime/model/resources/tools [P1, P7–P8] | Provider-specific credential route selected by user. **V:** actual subscription/OAuth eligibility and permitted embedding use; installation alone proves neither. | Underlying provider's API or agent allowance; **V:** catalog cost accuracy and account policy. Host shares process permissions. | Optional controlled Node/Bun integration, not the default model abstraction. |
| Pi CLI RPC / JSONL | **D:** long-lived bidirectional RPC and one-run JSON event output [P5] | Same provider entitlement requirements as selected Pi route; no automatic credential harvesting. | Underlying billing plus potential extra runtime retry/compaction turns; session discovery/storage **V**. | Optional language-neutral subprocess bridge; prefer RPC for cancellation/control. Print mode is insufficient for interactive streaming. |
| Official Copilot SDK, signed-in route | **D:** SDK normally drives runtime via JSON-RPC; documented CLI identity/token routes and model listing [G1–G2] | Eligible Copilot account/plan and permitted organization policy. GitHub identity or a token alone does not establish model access. | Copilot CLI allowance/billing model, not OpenAI API billing [G1]. Remote inference; runtime storage/telemetry **V**. | Optional supported route for existing Copilot access. |
| Official Copilot SDK, BYOK | **D:** OpenAI/Anthropic/Azure-compatible provider options, local-compatible servers [G3] | Independent provider API access, or selected local server; personal Copilot subscription route not required for BYOK [G1–G3]. | Provider-tracked usage rather than Copilot premium-request quota [G3]; runtime privacy remains separate. | Optional when runtime behavior is desired; otherwise prefer a simpler direct/local adapter. |
| Arbitrary agent CLI / unofficial subscription proxy | No general protocol, safety, entitlement or billing guarantee. | **V:** documented programmatic interface, terms and authorization required separately for every runtime. | Unknown. Screen scraping and copying OAuth tokens do not resolve this. | **P:** unsupported until separately reviewed; never a hidden fallback. |

“Supported” here describes a documented software integration, **not blanket approval by every upstream subscription provider for every embedding use case**. The official Copilot route is distinct from Pi's own provider adapters. Do not equate their credentials, permissions, model lists, or billing.

## 2. Capability evidence by connection

| Connection | Streaming / cancellation | Schema-constrained feedback | Tools and multimodal input | Discovery / usage | Enablement condition |
|---|---|---|---|---|---|
| Native OpenAI API | **D:** SSE and AbortSignal [D1] | **V:** exact model + API + schema dialect; validate final output locally regardless. | **V:** model and endpoint; do not replay opaque native state across providers. | **V:** account-visible models, token/cache usage, current price, effective limits. | Task-specific conformance and quality tests. |
| Native Anthropic / Gemini | **V:** implement/test exact native stream and abort contract; API access is documented [D2–D3]. | **V:** native schema/tool options per model/version; do not infer from OpenAI behavior. | **V:** distinct image/audio/file/tool capabilities and payload formats. | **V:** service-specific model IDs, quota/usage and limits. | Independent native adapter tests; no generic compatibility flag. |
| Ollama compatible Chat | **D:** streaming and `include_usage` supported [L1]. **V:** effective abort propagation/stopped generation. | **D:** JSON/schema output via `response_format` [L2]. **V:** chosen model and schema subset. Cloud structured-output support is explicitly limited [L2]. | **D:** tools and model-dependent vision; base64 image input, not general image URL support. `tool_choice` is not listed as supported [L1]. | **D:** `/v1/models`, embeddings [L1]. **V:** effective loaded context, actual usage and local model identity. | Use local model + verified profile; no cloud fallback. |
| LM Studio compatible Chat | **D:** `stream` payload support [L4]. **V:** cancellation semantics. | **D:** `response_format` JSON schema [L5]. **V:** model/engine; docs warn not all models are capable. | **D:** tool request protocol, native/default template differences [L6]. **V:** reliability and modalities of actual model. | **D:** models/embeddings endpoints [L3]. **V:** token reporting, loaded context, model revision. | Independent LM Studio conformance/learning evaluation, not an Ollama profile copy. |
| Pi SDK / RPC | **D:** SDK deltas, completed messages, abort; CLI RPC/event modes [P1, P5]. **V:** subprocess teardown and exact version mapping. | **V:** upstream capability and what selected Pi adapter exposes. JSONL events are **not** JSON-schema output [P5]. | **D:** configurable tools; defaults may be powerful. **V:** model modalities and safe disabled-discovery state [P1, P6–P7]. | **D:** model runtime/catalog and usage infrastructure [P2, P4]. **V:** fresh entitlement, actual allowance, total retries/compaction and price accuracy. | Explicit resources, model and credentials boundary; deny tools by default; OS isolation for subprocesses. |
| Official Copilot SDK | **D:** assistant deltas, final messages, idle events and session abort [G4]. | **V:** exact upstream model/runtime schema facility; do not claim portable constrained output from event JSON alone. | **D:** default first-party tools, configurable permission/tool handling [G1, G4]. **V:** no-tools policy and actual model modalities. | **D:** runtime model listing [G1]; BYOK may supply custom list [G3]. **V:** model eligibility, token telemetry, allowance and current charges. | Version-pinned SDK/runtime, explicit identity/privacy, controlled persistence, deny-by-default tools and isolation. |

**Important distinction:** model supports tools ≠ endpoint accepts tools ≠ adapter streams calls correctly ≠ host permits execution. Likewise, valid JSON ≠ schema compliance ≠ correct feedback ≠ faithful citations. A single `supportsJson: true` or `supportsTools: true` is too coarse.

## 3. Task routing profiles — proposed

**Scope:** note explanations, source-scoped chat and anchored feedback are the notebook MVP. Question generation, flashcards, grading, scheduling, embeddings and media are optional later features, not observed Riddled parity or baseline requirements. Acceptance rows mentioning them apply only if those tasks are built.

No task below requires an autonomous coding agent. Model quality must be evaluated using notebook-relevant examples, not assumed from model size or brand.

| Notebook task | Hard minimum | Preferred route | Safe degradation |
|---|---|---|---|
| Explain selected notes / Socratic hint | Text, bounded context, source anchors; streaming desirable but not required | User-pinned eligible local or hosted model | Non-streamed result with progress status; manual reading if unavailable. |
| Generate practice questions / flashcards | Validated question schema, answer/source separation, source linkage, adequate language quality | Verified schema-output profile | Prompted JSON + bounded local validation/repair, then manual authoring. Never insert malformed cards. |
| Grade a learner answer | Rubric/evidence context, validated feedback schema, abstention, acceptable grading calibration | Evaluated grader profile, not automatically the largest/most expensive model | Self-assessment/manual rubric. Unvalidated text may be shown but must not update canonical grade. |
| Summarize / organize selected notes | Bounded inputs, provenance, adequate context; schema only if metadata is saved | Lower-cost or local summarizer that passes coverage checks | Smaller source selection; explicit coverage warning. No silent omissions. |
| Answer with notebook evidence | App-owned retrieval, source/span references, answerability/abstention evaluation | Eligible text model; no model tools necessary if excerpts are supplied | Local search and source preview; no unsupported factual answer. |
| Extract from images / diagrams | Verified image input, size limits and task accuracy; source image reference | Explicitly vision-capable profile under privacy policy | User-approved local OCR/text path with accuracy warning, or ask for transcription. Never silently omit the image. |
| Speech transcription / spoken tutoring | Separate verified audio-input/output operation, format/size/latency limits | Dedicated local or API audio adapter | Text input/output. Never infer audio support from text/vision support. |
| Semantic retrieval | Verified embedding operation, fixed model/revision/dimension/distance and local index | Private-local embedding model if available and evaluated | Local lexical search. Switching embeddings requires a separate index/reindex. |
| Schedule reviews / aggregate progress / save notes | Deterministic local app logic, transactions and user policy | **No LLM** | Always available offline. Model feedback is advisory input, not the scheduler. |
| Optional read-only note lookup tool | Safe app-owned tool implementation plus verified call handling | Only an explicitly enabled tool profile | Pre-retrieve excerpts in app code; no shell/browser/filesystem fallback. |

Suggested non-provider-specific profiles: `tutor-text`, `question-author`, `rubric-grader`, `source-summarizer`, `vision-extractor`, `embedder`. The user may assign different eligible connections/models to each and pin a model per task. Do not require that a single model support every operation.

## 4. Capability registry contract — proposed

Store only public/non-secret model and connection metadata here; credential references resolve in a separate broker. Scope every record to **connection + endpoint + adapter version + model ID/revision**, not just brand/model name.

| Field group | Required information |
|---|---|
| Identity | Connection ID; adapter/runtime/server version; endpoint host; provider-scoped wire model ID; revision/quantization if known; human label. |
| Entitlement | Auth mode (`apiKey`, `runtimeOAuth`, `cloudIdentity`, `localNone`); credential reference only; last authorization result/time; account/organization label; permitted tasks. An expired token or old model list is not current authorization. |
| Capability evidence | Per capability: `unknown`, `documented`, `tested-pass`, `tested-fail`, or `stale`; source/version, test time and sanitized result. Keep declared versus observed metadata separately. |
| Operations/modalities | Chat, embeddings, image input, audio input/output separately; streaming; abort; tool-call dialect/parallelism; schema mode (`nativeSchema`, `jsonOnly`, `prompted`, `none`) and supported schema subset. |
| Effective limits | Context/output limits and source; image/audio/request-size limits; local runtime allocation; reserved prompt/tool/output budget. Unknown effective context is not the largest advertised family context. |
| Quality | Task/language-specific schema pass rate, grading agreement/calibration, abstention and citation faithfulness, latency distributions; evaluation-set/version and date. No fabricated benchmark numbers. |
| Usage/cost | Reported token categories and units; price source/currency/time; allowance units/multiplier if exposed; `reported`, `estimated`, or `unknown` confidence. Catalog zero is not proof of free inference. |
| Privacy/security | Local-execution versus remote path; endpoint allowlist; forwarding/tool egress; runtime persistence/telemetry status; retention policy evidence/date; allowed note sensitivity. |
| Health/policy | User pinning; eligible task types; approved fallback chain; concurrency, retry, deadline and spend limits; last health check without note contents. |

### Eligibility algorithm

1. Apply sensitivity/egress constraints and explicit user selection.
2. Require current selected-route authorization and all hard task capabilities.
3. Check effective input + reserved output budget and task quality threshold.
4. Check spend/allowance and deadline before choosing an eligible candidate.
5. Prefer the pinned connection; otherwise rank only within the user's approved set. Explain the decision.
6. If no candidate qualifies, show the missing capability or entitlement and offer manual mode. Do not relax privacy, structured-grading validity, or modality requirements silently.

Examples:

- Private journal grading + offline-only policy + local text model without reliable schema → manual rubric/self-assessment, not a hidden remote grader.
- Copilot-access-only user → use the official opted-in runtime if eligibility and tool/privacy constraints pass; never request an OpenAI API key merely because a Copilot model is OpenAI-branded.
- API key with no usable balance → stop with billing guidance; do not switch to a different authenticated identity automatically.
- Local vision unavailable → request textual transcription or explicit consent for another route; never answer as if the image was seen.

## 5. Acceptance checklist before an adapter is enabled

All checks below are **proposed tests, not completed tests**. Use synthetic fixtures first, with explicit consent for any quota-consuming checks; no notebook content is needed for capability probes.

| Test category | Required observation / failure behavior |
|---|---|
| Authorization | Missing/expired/wrong-scope credential and denied model fail clearly without trying other identities. No secret values in outputs/logs. |
| Streams | Split Unicode, fragmented tool arguments/JSON, empty result, stalled stream, malformed events, output truncation and late events produce a single correct terminal status. |
| Lifecycle | Subscribe before send; map actual completion (`agent_settled` for documented Pi version, appropriate Copilot idle/final result). A successful prompt-accept response alone is not completion. |
| Cancellation | Abort before send, mid-stream, during retry/repair, tool call and approval; no late persisted feedback. App-owned child teardown is bounded; do not terminate shared processes. Remote cost uncertainty is visible. |
| Schema | Required/unknown fields, enums, numeric bounds, nested schema subset, oversized results, refusal and abstention validated. No malformed or partial result accepted as a grade. |
| Evidence and learning quality | Citation spans/hashes resolve; unsupported answers abstain; rubric judgments evaluated against reviewed examples; hallucination and answer leakage measured. A protocol pass is not pedagogical validation. |
| Tools | No shell, browser, MCP, network fetching, arbitrary file access, subagents or installs. Calls outside approved IDs, counts, time and size budgets are denied by host policy even if requested by a model. |
| Discovery / isolation | No ambient context files, extensions, skills, hooks or private account stores loaded accidentally; no tools by default. Working directory alone is not a security boundary [P6]. |
| Usage | All retries, tool-related model turns, repair and compaction included; missing usage shown as unknown. API charge versus Copilot allowance versus local compute distinguished. |
| Privacy | Source scope preview and data minimization; no unapproved cloud forwarding. Session files, caches, telemetry and local-server request logs considered separately from provider retention. |
| Fallback | Auth/entitlement failures stop; transient retry is bounded; no automatic model switch after partial output; local-only never becomes remote; each accepted alternative is separately attributable. |
| Portability | Changing provider rebuilds context from app-owned evidence/summary; provider-native session state is not replayed blindly. Embedding changes do not mix vector spaces. |
| Offline/manual | Core notes, editing, lexical search and export work without a provider. If optional quizzes/grading/scheduling are built, their manual answers, self-assessment and deterministic due dates also remain available offline. |

## 6. Conclusions and open decisions

- **Recommended baseline:** app-owned task broker, deterministic learning state, native API adapters plus independently tested local compatible endpoints.
- **Recommended optional access reuse:** documented Pi SDK/RPC or official Copilot SDK, with explicit user choice and per-route entitlement checks. Reuse an authorized runtime boundary, never scrape/copy its credentials.
- **Do not promise:** all paid subscriptions work, all compatible endpoints are feature-equivalent, all models can grade reliably, all local URLs imply offline privacy, or agent tool controls provide an OS sandbox.
- **Still unknown:** the user's intended accounts/entitlements, actual running servers, installed bridge versions beyond Pi public package 1.5.0, hardware, current prices/allowances, provider retention, and evaluated learning quality. These are configuration/validation decisions, not facts established by this matrix.
