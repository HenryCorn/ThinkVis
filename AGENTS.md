# ThinkVis working agreement

## Current state
This repository contains an Obsidian research/design vault, not a working learning application. Start at `vault/00 Home.md`, then `vault/20 Research/Research Index.md` and `vault/40 Build/Build Roadmap.md`.

## User preferences
- Use **Herdr** for appropriately scoped parallel agent work when running inside its managed environment. Verify `HERDR_ENV=1` and read the installed `herdr --skill` before control operations. The binary may be supplied by `HERDR_BIN_PATH` rather than PATH on Windows.
- Use **REA MCP** for evidence-driven Riddled research. Primary researcher alone owns the live browser; delegates get separate read-only questions or non-overlapping file ownership.
- Keep discoveries, hypotheses and design decisions in the Obsidian vault. Distinguish observed UI, reproduced behavior, vendor claims, inference, proposed design and unknowns.
- Future local app must support different user-authorized providers/models. Do not equate paid chat/agent subscriptions with generic API entitlement. Never read/copy credential stores to construct integrations.

## Research guardrails
- Scope browser work to the authorized Riddled origin and clearly named disposable artifacts. No welcome/personal-note edits, purchases, upgrades, quota exhaustion, public shares, microphone consent or personal-file uploads without explicit user direction.
- First pass intentionally elicited three AI responses and then stopped. See the Experiment Log before spending further non-refilling free allowance.
- REA WebSocket discovery/passive inspection worked; its scenario connect path in this release requires HTTP discovery and rejected the WS input before any actions. Do not claim passive snapshots executed browser actions. See the evidence-limitations note.
- Never persist raw credential headers, cookies, tokens, private browser URLs, live CDP endpoints, personal profile data or unrelated browser content. Retain canonical REA records with their limitations; derived summaries are labeled separately.
- Provider/model metadata is not proof of actual entitlement or tested capability. Local-only tasks must not silently fall back to hosted inference.

## Files and validation
- `vault/20 Research` contains authoritative current findings; `docs/research/riddled/findings.md` is an earlier snapshot with links to the maintained vault.
- `vault/30 Architecture` is proposed design; runtime shape, first provider routes and storage choices still need user confirmation.
- Run `node scripts/validate-vault.mjs` after vault changes. It checks JSON, local wikilinks, REA file/record identity, selected secret markers and synthetic-export hash—not model quality, all secret formats or canonical REA cryptographic authentication.
- Do not commit credentials, runtime databases or Obsidian per-machine workspace state. Do not merge/deploy or create app infrastructure as a side effect of research.
