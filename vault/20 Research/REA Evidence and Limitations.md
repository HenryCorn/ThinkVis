---
tags: [research, rea, evidence]
status: partial-coverage
---
# REA Evidence and Limitations

## Setup verified
- REA MCP **6.8.0** advertised **229 tools** and successfully initialized.
- It runs on a separate Node **24.22.2** installation; system Node was not replaced.
- Chrome DevTools MCP attaches to the user's regular signed-in Chrome via `--autoConnect` and the user-enabled remote-debugging setting. Google login in the initially automated profile was blocked; the user signed in themselves in regular Chrome.
- REA browser discovery and passive inspection worked through the current **literal loopback WebSocket endpoint**, filtered to exact origin `https://www.riddled.ai`. Do not put that endpoint in shared vault notes.
- Discovered browser identified Chrome 156 in this run. Version is an observation, not an app requirement.

## What the tools did
| Tool | Performed work | Limit |
|---|---|---|
| `list_browser_targets` | Found the authorized Riddled page and its current target ID with an exact-origin filter. | Target listing is not login/feature/backend evidence; browser has other tabs, excluded from this research. |
| `inspect_web_page` | Captured DOM structure, accessibility, script/resource metadata and attach-window observations. | Passive: it did not click, submit, type or modify notes. DOM/accessibility snapshots and event windows need not describe the same completion instant. |
| `analyze_web_bundle` | Captured same-origin delivered JS and performed inert static analysis. Source maps were not fetched. | Parsing is not execution. One source hit a deadline. Route/endpoint reachability and server-only behavior remain unknown. |
| `inspect_analysis_view` | Queried retained source-status and unknowns pages without re-running analysis. | Views preserve parent ID and coverage; the complete parent remains in the live REA session, not copied into the vault. |
| `capture_browser_scenario` | **No actions executed.** Input rejected before navigation because the current connection supplied WS where this scenario implementation accepts explicit-port HTTP discovery only. | Current Chrome `/json/version` returned 404; WS discovery/inspection still worked. Do not retry an unchanged rejected request or pretend it performed a scenario. |
| Chrome DevTools tools | Performed the authorized UI actions and inspected two selected request/response exchanges. | These are separate observations, not REA scenario receipts. Header values and raw request payloads were not retained in the vault. |

## Primary evidence catalog
Files under `90 Attachments/REA` are REA-returned JSON records, not hand-authored summaries. Their limitations must travel with any claim. The first-pass discovery/inspection also lives outside this vault under `docs/research/riddled`.

| Record | Purpose / confidence boundary |
|---|---|
| [[90 Attachments/REA/ev_0e3f01446db1ff46d13e048b766e03dd8e10f4e98dcf13566513540b73b74278.json]] | Passive window around initial note chat; network requests absent from this window, not absent from browser history. |
| [[90 Attachments/REA/ev_fcc02c56e37b9fd7bc7a29a95af0c9861e28b32eeb22807efea09fee1252d29b.json]] | Passive state/window around proactive mode experiment; not an exact response latency trace. |
| [[90 Attachments/REA/ev_c814f6b9154aec8e299ccf03cd7e2e04e9d572d97be620f594ed02351713fdb0.json]] | Settings/persona-list state after sandbox persona save. |
| [[90 Attachments/REA/ev_a7defd911b9fa69f5586ffa206999597a28ba386859a98592edb820f6323d690.json]] | Window around custom-tutor question; completed text should be corroborated by the later snapshot. |
| [[90 Attachments/REA/ev_33faf98a3a9eeebb483685d37c7cde38c1849257dc5202ad8dcb9b852d6005bd.json]] | Completed note-chat state with custom tutor and both exchanges. |
| [[90 Attachments/REA/ev_7cbd1ddb943a4c51ee45c3ac7ebf9e9a3eba3f5e871e12386ba44119d7bb9014.json]] | Palette state; accessibility omission does not establish empty DOM results. |
| [[90 Attachments/REA/ev_d5fdf689bd6a82c9459057de78fd86eebbe939b97597bc3cb8640580e58bf19a.json]] | Reopened chat after reload, note/persona/mode and retained conversation state. |
| [[90 Attachments/REA/ev_2289fa32029dbdd385afe9de96f280b61bb67b06b2efbb7664741eb2dbfd5c72.json]] | Static route projection: no candidate items, **partial source coverage**. |
| [[90 Attachments/REA/ev_5e52c75fb5f1c21d47a052fad450db07c849b0d7b9ca1b8d05a4253648393399.json]] | Static source manifest/status page: 13 retained source records, one unavailable due to deadline. |
| [[90 Attachments/REA/ev_0f27df927e17621ef5c8e040c3cdd686ed28dc35d082e07b60694450b4cc18ca.json]] | Static unknowns page: dynamic/unsupported navigation interpretations and one deadline. |

Static parent ID: `ev_46da71ec0e190b573c986e90fdcd2b2c2459b010c075415009778677f6910a5e`. Projection records link this retained parent, but a future REA process will not automatically contain it. Do not mistake a view's own Evidence ID for the parent ID.

## Practical tool-contract quirks in this release
- Web-bundle analysis with `detail: summary` rejected an omitted `view` despite the compact advertisement marking it optional. Supplying an explicit `javascript-routes` view worked.
- A generic `summary` view for this parent was rejected; `javascript-routes` source/unknowns views worked. No unchanged retry was used.
- Per-script analysis deadline was 20 seconds; one captured script was explicitly unavailable. Re-running the full bundle without a concrete reason would waste time and is not needed to document the limitation.
- The analysis inventoried frontend assets, not an authoritative application feature surface. Empty route candidates cannot be promoted to 'no endpoints'—actual DevTools requests demonstrate endpoints exist.

## Network and privacy boundaries
- REA passive records **do not retain raw header collections, cookies, storage values, raw JSON bodies or WebSocket payloads**. Optional value-free shapes were requested in some windows; no raw credential collection was requested.
- Empty REA network arrays reflect attach-window coverage. The requests may start before observation attaches; source initialization itself adds delay. No exhaustive request count or timing conclusion follows.
- Two selected DevTools exchanges are summarized separately in [[90 Attachments/network-summary.json]]. Only field types, endpoint, content type and status are retained, not full requests, auth headers, or sandbox UUID values.
- User-authored note/chat text is retained because it is synthetic. Email addresses were removed from saved derived UI snapshots. No screenshot of unrelated tabs or user profile was intentionally taken or retained.
- Browser/REA access is powerful and not an OS sandbox. Keep exact-origin scope and close sensitive tabs before future shared sessions.

## What remains unrecoverable or unknown
Private backend code, exact server system prompts, moderation policy, actual model identity behind the vendor label, model settings, billing internals, retention/deletion guarantees, full routing graph, cross-device synchronization, offline conflict handling, AI scheduling/debounce thresholds, anchor-recovery algorithm, and account-wide permission semantics.

We can implement our own sensible choices for these. Record them in [[Decision Log]] and [[Assumptions and Open Questions]] rather than labeling guesses as reverse-engineered facts.
