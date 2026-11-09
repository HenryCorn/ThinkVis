# ThinkVis

Research and design for an independent, local-first personal learning notebook with selectable AI providers/models.

## Open the Obsidian vault
In Obsidian, choose **Open folder as vault** and select:

```text
C:\repo\ThinkVis\vault
```

Start at [`vault/00 Home.md`](vault/00%20Home.md). Core plugins only; no community plugins or API keys are needed to read the vault.

## Contents
- `vault/20 Research/` — tested feature map, experiment log, REA limitations, test matrix, open questions.
- `vault/30 Architecture/` — proposed local app, provider/model broker, capability matrix, data/anchor design.
- `vault/40 Build/` — roadmap and decision log.
- `vault/90 Attachments/` — REA evidence, sanitized UI snapshots, value-free network summary, synthetic Markdown export.
- `vault/99 Templates/` — experiment template.
- `docs/research/riddled/` — earlier first-pass findings, retained for context.

Two Herdr agents researched architecture and test coverage; the primary agent alone controlled the live Riddled browser. Findings distinguish observed behavior, vendor claims, inferences and proposed design.

**Status:** research vault and design documents, not a working learning application. No provider credentials have been copied or configured for an app. Runtime shape and first provider routes still need a user choice.

## Validate

```sh
node scripts/validate-vault.mjs
```

Checks vault JSON, local wikilinks and attachment targets, duplicate note names, REA file/record identity, derived-data secret markers and sandbox-export integrity. It does not authenticate REA's canonical digest algorithm or validate vendor claims, account entitlements or model quality.
