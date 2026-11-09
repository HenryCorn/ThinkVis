# Provider and Model Architecture

## Decision summary

**Proposed design, not an implementation:** make the learning notebook local-first and provider-neutral through an app-owned inference broker. Support three explicit connection types: **direct provider API**, **local compatible server**, and **supported agent-runtime bridge**. Keep notes, learning history, rubrics, retrieval, and export independent of all three.

Prefer direct APIs and local endpoints for bounded notebook tasks. Offer Pi and GitHub Copilot bridges as optional integrations for people who already have usable access; neither an installed agent nor a paid chat subscription proves inference entitlement. A bridge is an agent runtime with its own tools, persistence, retries, and security surface—not just an interchangeable HTTP client.

Related: [[Model Capability Matrix]] and [[System Design]]. **MVP scope:** notebook editing, note chat, anchored feedback and personas. Quizzes, rubric grading, flashcards, due dates and spaced repetition below are optional later task profiles, not observed Riddled features or baseline MVP requirements.

### Evidence boundary

- **Verified documentation** below means public documentation was read, not that an endpoint, account, model, quota, or integration was tested.
- Pi's installed public package is `@earendil-works/pi-coding-agent` **1.5.0**. Its SDK, model, provider, CLI-integration, custom-provider, and security documents were read in full; relevant public SDK examples were also read. No private Pi state was inspected.
- GitHub and model-server documentation describes the fetched upstream documentation snapshot; installed versions may differ. Pin and recheck versions before implementation. Upstream `main` links are mutable.
- No browser, MCP, account sign-in, credentials, private configuration, existing app data, model requests, installs, or implementation were used. This document makes no claims about Riddled's observed behavior.

## 1. Access is a connection property, not a model property

| Access route | What the user supplies or authorizes | What must not be inferred |
|---|---|---|
| Direct hosted API | Provider API credential, or provider-supported cloud identity; eligible project, billing, and model access | A ChatGPT, Claude, Gemini, or Copilot subscription does not by itself establish API entitlement or transfer subscription allowance to that API. |
| Local inference | User-selected running server and an available local model; optional server credential | An OpenAI-compatible protocol does not mean OpenAI hosting, billing, complete API compatibility, or good tool/JSON performance. |
| Agent subscription/OAuth | User explicitly opts into a documented runtime authentication route; provider/account policy permits use | An OAuth token is not a generic API key, and a model available through one agent is not necessarily available through another route. |
| Bridge with BYOK | Runtime plus separately entitled provider API access | Using a bridge does not turn separately billed API traffic into subscription-included usage. |

**Verified:** Pi documents provider-specific OAuth/API-key login and compatible endpoints [P2–P4]. Copilot SDK documents signed-in CLI credentials, supported GitHub tokens, and BYOK; its standard personal-user route requires Copilot access, while BYOK uses provider access and billing [G1–G3]. Copilot also documents separate organization-attributed automation; do not silently select it for a personal notebook [G2].

**Proposed onboarding:** ask “What connection do you want to use?” rather than “Which subscriptions do you own?” Show `Not configured → Configured → Authorized → Capability checked`, with expired/denied/offline states. An optional synthetic connection test must disclose that it can consume allowance. Listing models or finding a binary is not proof of permission to infer. Never scan credential stores to guess available providers.

## 2. Boundaries and data flow

```text
Notebook UI / local desktop renderer
  → authenticated loopback broker or desktop IPC
    → task planner + bounded context/retrieval
    → capability + entitlement + privacy + budget gates
    → selected adapter
       ├─ native provider SDK / HTTP API
       ├─ user-approved local compatible endpoint
       └─ isolated Pi or Copilot runtime bridge
    → stream normalizer → final schema/evidence validation
    → app-owned learning records and usage ledger
```

All of this is **proposed**. The UI receives output and status, never provider secrets. Local Markdown/assets and a local metadata/search store remain the source of truth. Keep core editing, browsing, lexical search and export usable without AI. If optional later quizzes, self-rating or scheduling are built, their manual/deterministic parts must also work without a provider session.

Separate interfaces:

- **Connection:** adapter kind, endpoint, credential reference, auth mode, account label, privacy class, permitted task types, spend/allowance policy. No secret values in notebook files.
- **Model profile:** connection-scoped wire ID, revision if known, declared and tested capabilities, context/output limits, cost metadata and freshness. A friendly family label is not an executable model ID.
- **Task request:** task/schema version, selected source IDs and hashes, learner answer, rubric, required modalities, deadlines, output budget, privacy restriction, tool policy, cancellation signal.
- **Result:** validated content, provenance, model/connection identity, finish reason, usage confidence, attempt history. Do not retain or require private chain-of-thought; request a concise pedagogical explanation instead.

The notebook owns conversation and learner state. Provider-native messages, reasoning items, tool IDs, and session handles stay inside the adapter. Switching providers starts a new inference context built from selected notebook facts and a transparent summary, not a blind replay of another provider's opaque transcript. OpenAI's SDK explicitly warns that filtering replayable Responses output can lose required items [D1]. Preserve native state within its own adapter; do not pretend it is portable.

## 3. Integration options

### A. Direct provider APIs — preferred hosted route

**Verified:** official OpenAI, Anthropic, and Google SDK documentation shows independently authenticated API access. OpenAI documents SSE streaming, request cancellation, and configurable retry/timeouts; Google distinguishes API-key and cloud-project authentication [D1–D3].

**Proposed:** thin native adapters preserve provider-specific streaming, structured-output, usage, and multimodal semantics behind a small notebook contract. Do not force all providers through the OpenAI schema. Treat structured output, embeddings, image input, and tool calling as separate capabilities. Native API adapters minimize agent defaults and are usually easier to bound, but add maintenance and require actual API entitlement.

### B. Ollama / LM Studio — preferred private-inference route

**Verified:** Ollama documents `http://localhost:11434/v1`, a subset of OpenAI APIs, streaming, JSON/schema output, tools, embeddings, and model-dependent vision. A dummy client key is ignored by the local Ollama server [L1–L2]. LM Studio documents compatible endpoints at an example `http://localhost:1234/v1`, streaming chat, schema-constrained output, and tool calling; structured-output and tool reliability still depend on the model [L3–L6]. Ports are examples, not discovery results.

**Proposed:** share a conservative compatible-HTTP transport but maintain endpoint-specific profiles and tests. Start with Chat Completions; enable Responses only after that server/version passes its own tests. Ollama explicitly documents stateless Responses without `previous_response_id`/`conversation` [L1]. Do not automatically download models, start servers, change binding, or probe arbitrary local ports.

“Local endpoint” is not equivalent to “offline inference”: Ollama documentation includes cloud models and cloud forwarding [L1]. Private-local mode must require local model execution and no external tools, proxies, or model/cloud fallback; verify the deployment's egress policy rather than trusting its hostname. Local compute still costs hardware, memory, energy, and time.

### C. Pi bridge — useful optional reuse, version-specific

**Verified:** Pi's SDK embeds its agent in Node/Bun with `createAgentSession`, `SessionManager.inMemory()`, configurable models/resources/tools, streamed session events, `abort()`, and disposal [P1]. Defaults include discovery, configured credentials, persistent sessions, and tools; **the minimal SDK example is not an isolation recipe**. Pi CLI offers final-text print, one-run JSONL events, and long-lived JSONL RPC; `RpcClient` is documented [P5]. JSON mode is an event envelope, not schema-constrained model output. In this version `agent_settled`, not just `agent_end`, marks completion of automatic work [P1, P5].

Pi documents provider-specific login and local-compatible models, including Ollama/LM Studio [P2–P4]. This is evidence of Pi integration mechanisms, **not verification that any particular subscription is authorized for notebook embedding**. Resolve each proposed provider route against its current terms and supported login flow; mark it unavailable if uncertain. No credential extraction, unofficial token conversion, or reverse-engineered subscription endpoint is acceptable.

**Proposed:** offer an isolated subprocess RPC adapter for a language-neutral host, or SDK adapter if the host is Node/Bun and can own all configuration explicitly. Do not embed the agent just to obtain a model picker. Use app-owned history/settings/resources, an explicit model, no discovered instructions/extensions/skills, and no tools by default. SDK full-control examples demonstrate explicit resource/model/runtime boundaries [P7–P8]. Credentials remain behind a deliberately authorized runtime interface; never import the user's credential file into the notebook. Reuse an existing authenticated runtime only as an explicit user choice and only when its broader persistence/discovery/privacy behavior can be constrained and explained.

Pi states that project trust and working directory are **not a sandbox**, and it does not request approval for every tool call [P6]. A subprocess alone is also not a sandbox: apply OS/process/file/network restrictions. If the selected bridge cannot guarantee the notebook's declared policy, disable that bridge for the task.

### D. GitHub Copilot SDK bridge — supported Copilot route

**Verified:** the official SDK drives the Copilot runtime over JSON-RPC, ordinarily in a child process; it exposes runtime model listing and counts standard usage under Copilot CLI billing/allowances [G1]. Its authenticated-user route can use CLI sign-in; BYOK is separately billed to the configured provider and does not require the personal Copilot subscription route [G2–G3]. **Copilot access is not an OpenAI/Anthropic API key.**

The SDK documents assistant deltas, final messages, idle events, session abort, tool filters, permission handling, and separate runtime data-directory controls [G4]. Its default runtime exposes powerful first-party tools; examples using `approveAll` are unsuitable for a notebook. Docs also describe telemetry/session-store controls [G1, G4]. Upstream README currently says generally available; still validate the exact SDK/runtime pair rather than relying on older preview assumptions [G1].

**Proposed:** make this an opt-in adapter with explicit identity, visible allowance label, isolated app-owned session storage, denied tools by default, disabled discovery/telemetry where supported, and external isolation. Distinguish runtime listing from actual model eligibility and feature support. Prefer the official SDK over scraping terminal output or calling undocumented Copilot inference endpoints. Because upstream overview and detailed BYOK docs differ in their identity-support descriptions, do not promise a specific managed-identity flow without version-level validation [G1, G3].

## 4. Capability routing and learning feedback

Routing is **proposed** and uses hard eligibility filters before preference scoring:

1. Respect explicit connection/model pinning and local-only/data-egress policy.
2. Require authorized connection, task modality, sufficient effective context/output budget, and task-specific schema/tool capability.
3. Require a learning-quality baseline for the task/language, not just protocol success. Unknown capability is not “yes.”
4. Rank remaining choices by user preference, measured latency, cost/allowance, and evaluated quality. Show the choice and why; never send note content to a remote classifier just to route it without consent.

Saving is deterministic app logic. If later learning features are approved, use deterministic code for spaced-repetition intervals, due dates and score aggregation; the model suggests rubric feedback but does not own canonical progress.

**Optional later grading-task envelope, not the MVP margin-feedback contract:** `schemaVersion`, `taskId`, `questionId`, `rubricVersion`, `verdict` (`correct|partial|incorrect|insufficient_evidence`), bounded per-criterion scores, `strengths`, `gaps`, `nextStep`, `evidence[]` (source ID/hash and span), and an uncertainty/abstention explanation. Validate JSON shape, size, score ranges, and that evidence resolves against the supplied sources. Evidence existence does not prove factual correctness; retain learner override and test citation faithfulness. Avoid exposing a canonical answer before the learner submits when in recall mode.

Prefer verified native schema output; otherwise use prompted JSON with local validation. At most one bounded repair attempt, within the original privacy/spend policy. If still invalid, show a labeled unvalidated explanation and allow retry/manual feedback; **never silently persist a grade from malformed or partial output**. JSONL transport and function-call syntax are not schema guarantees.

## 5. Streaming, cancellation, and persistence

**Proposed normalized events:** `started`, `textDelta`, `toolRequested`, `usageUpdated`, and exactly one terminal `completed|failed|cancelled`. Include request/attempt ID, sequence, and selected connection/model. Buffer malformed/split UTF-8/JSON safely, cap buffer/event sizes, and ignore late events after terminal state. Display generated text provisionally; persist structured feedback only after a successful final result validates. A truncated finish is not a completed grade.

Register listeners before sending. Map the exact runtime's idle/settled semantics, not just “last text received.” Pass cancellation through HTTP abort or runtime abort; stop retries, queued tools, and pending approvals too. Wait a bounded shutdown interval, then terminate an app-owned child process tree if necessary. A parent kill does not prove remote compute stopped or that billing ceased. Never kill a user-shared agent process. Cancellation preserves the learner's answer and leaves no new accepted grade.

Retries belong to one policy owner. Disable or account for nested SDK/runtime retries; OpenAI's documented SDK default retries can otherwise multiply broker retries [D1]. Include compaction and schema-repair turns in attempt/time/spend limits. Bridge control responses that merely accept a prompt must not be interpreted as completion [P5].

## 6. Safe tool limits, credentials, privacy, and cost

All controls in this section are **proposed requirements**, not claims that a bridge already enforces them.

- **No tools needed for core tutoring.** Retrieve bounded source excerpts in app code before inference. Optional tools are narrow app-owned `searchSelectedNotes`/`readSelectedExcerpt` functions, scoped by note IDs and access policy, not arbitrary paths. Deny shell, generic filesystem, browser, MCP, network fetching, arbitrary code, subagents, and installs. Any later write feature returns a proposed edit for user confirmation and an app transaction.
- Start with no tools; for a tool-enabled profile cap calls/rounds, result bytes, per-call time, total time, and parallelism. Example policy values (not SDK guarantees): 3 read-only calls, 2 rounds, 64 KiB total tool results, no parallel tool execution. Revalidate permission on dispatch, even if a model saw an older tool list. Prompt instructions and “read-only” labels are not access controls.
- **Credential broker:** use OS secret storage or deliberate environment/runtime handoff outside the renderer. Record only opaque credential references. No keys/tokens in Markdown, SQLite exports, prompts, model metadata, URLs, analytics, stderr captures, or command-line arguments. Do not accept executable credential commands from imported notebooks. Do not inherit the entire parent environment into bridges; allowlist required variables.
- Reuse sign-in through the documented runtime flow only after user choice. Token refresh/logout/revocation remain provider/runtime-specific; deleting a local reference is not remote revocation. Never read or copy another app's auth database. Redact errors and logs; keep payload diagnostics off by default.
- **Local service security:** bind broker to loopback, authenticate local clients, validate Origin/Host and CSRF protections, and restrict endpoint hosts/redirects. Prevent URL credentials, credential forwarding across hosts, arbitrary SSRF, and unauthenticated LAN exposure. Approve non-loopback HTTP only as an explicit high-risk configuration; use verified TLS remotely.
- **Privacy:** label each connection `local-execution`, `remote-provider`, or `bridge-with-remote-inference`. Preview the source scope, redact unrelated personal information, and never send the whole vault by default. Local storage does not make hosted inference local. Review provider retention/training and runtime telemetry/session-file behavior separately; a telemetry toggle is not a zero-retention guarantee. Document bridge caches/session files in privacy/deletion behavior, but exclude raw native session handles, runtime caches and bridge session files from portable backups by default. Backups use an app-owned allowlist; a separate diagnostic/runtime archive requires explicit consent and redaction. A local path may be cloud-synchronized, so private-local storage requires an approved non-synced destination.
- **Usage ledger:** record task/attempt IDs, provider/connection/model, timestamps, reported input/output/cache tokens, finish reason, and known/estimated/unknown cost. Never treat missing usage or catalog price zero as confirmed free. Record subscription allowances/request multipliers as provider-reported units when available; do not convert them to fictional token-dollar accuracy. Rates, allowances, organization policy, and model eligibility are dynamic [G1–G3].
- Set output/time/attempt/concurrency limits and per-task/session spend limits. Present API charges versus subscription allowance versus local compute distinctly. Preflight estimates are not exact bills; remote timeouts may still incur charges. Enforce provider-side caps where available and warn when bridge usage is not measurable enough for a strict monetary ceiling.

## 7. Fallback policy

**Default: no silent provider switch.** The app remains usable manually.

| Condition | Proposed behavior |
|---|---|
| Auth failure, entitlement denial, billing/quota exhaustion | Stop and explain; require user action or an already approved alternative. Never hunt for other credentials. |
| Transient network/429/5xx before useful output | Limited jittered retry respecting Retry-After, cancellation, deadline, and total budget; do not retry an uncertain side effect. |
| Partial stream / timeout | Preserve a labeled draft; no automatic replay, grade, or concatenation with another model's answer. Offer a separate attempt and disclose possible duplicate cost. |
| Context too large | Select fewer sources or use a transparent bounded summary. Never drop rubric/evidence silently. |
| Invalid structured result | One validated repair attempt if allowed; otherwise manual feedback/unvalidated draft. |
| Requested capability unavailable | Explain and offer an explicit model choice or a clearly reduced task; do not silently discard images or weaken grading guarantees. |
| Private/local-only task | Only approved local-execution fallbacks. Never leak to cloud because local inference is slow/offline. |

A preapproved fallback chain must preserve privacy, entitlement, modality, schema reliability, and budget constraints. Switching subscriptions, billing identities, provider, or privacy tier needs separate consent. Each attempt has independent provenance and usage; never merge different graders into a hidden canonical verdict.

## 8. Suggested delivery sequence and unresolved checks

1. **Foundation:** manual notebook workflows, app-owned task/schema contracts, provenance, cancellation, and no-tools policy.
2. **Initial adapters:** one native API adapter and one compatible-local adapter; user-entered connections, no automatic account/model discovery.
3. **Optional bridges:** Pi SDK/RPC and official Copilot SDK only after isolation, identity/terms, session storage, telemetry, allowance, and cancellation acceptance tests pass.
4. **Later:** evaluated per-task routing and explicitly approved fallback chains. Add embeddings as a distinct operation; changing embedding model/dimension requires a new index/reindex, not mixing vectors.

Open checks: target runtime language; which provider access routes the user actually chooses; each subscription's permitted embedding use; exact available model IDs/versions; local hardware/context limits; runtime/tool-discovery suppression; credential lifecycle; provider retention; and real learning-quality evaluations. No user entitlements or model performance were verified in this research.

## Sources

Sources below were read; public upstream documentation is mutable. Pi references P1–P8 refer to the installed **1.5.0** public package at `C:/Users/enrique.martinocana/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/`; relative paths below are under that package. Public upstream counterparts are provided for navigation, not a claim that `main` matches the installation.

- **P1:** `docs/sdk.md` — [SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md).
- **P2:** `docs/models.md` — [Models](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md).
- **P3:** `docs/providers.md` — [Providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).
- **P4:** `docs/custom-provider.md` — [Custom providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md).
- **P5:** `docs/cli-integration.md` — [CLI integration](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md).
- **P6:** `docs/security.md` — [Security](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md).
- **P7:** `examples/sdk/12-full-control.ts` — [Full-control example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts).
- **P8:** `examples/sdk/09-api-keys-and-oauth.ts` — [Credential configuration example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts).
- **G1:** [Official GitHub Copilot SDK README](https://github.com/github/copilot-sdk/blob/main/README.md): runtime architecture, model discovery, default tools, status and billing overview.
- **G2:** [Copilot SDK authentication](https://github.com/github/copilot-sdk/blob/main/docs/auth/authenticate.md): signed-in identity, tokens, priority and disabling fallback.
- **G3:** [Copilot SDK BYOK](https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md): provider protocols, model listing, billing and limitations. Detailed bearer-token guidance differs from the README's narrower BYOK summary; validate the selected version.
- **G4:** [Copilot Node SDK reference](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md): relevant session, events, abort, data-directory, permission/tool, and telemetry sections inspected.
- **D1:** [Official OpenAI Node SDK README](https://github.com/openai/openai-node/blob/master/README.md): authentication, native conversation state, streaming, cancellation, retries and secret exposure.
- **D2:** [Official Anthropic TypeScript SDK README](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md): Claude API and server-side API-key initialization.
- **D3:** [Official Google Gen AI JS SDK README](https://github.com/googleapis/js-genai/blob/main/README.md): API-key/cloud identity, distinct service quotas/pricing and key security.
- **L1:** [Ollama OpenAI compatibility](https://docs.ollama.com/openai): local/cloud distinction, supported subset and stateless Responses.
- **L2:** [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs): schema support, compatible `response_format`, and cloud limitation.
- **L3:** [LM Studio OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat): endpoint list and example port.
- **L4:** [LM Studio Chat Completions](https://lmstudio.ai/docs/developer/openai-compat/chat-completions): streaming and payload parameters.
- **L5:** [LM Studio structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output): schema mode and model caveats.
- **L6:** [LM Studio tool use](https://lmstudio.ai/docs/developer/openai-compat/tools): request/execution separation and model/template caveats.
