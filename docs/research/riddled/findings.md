# Riddled exploration — initial snapshot

This file records the initial read-only inspection. Later hands-on results supersede its pending-test list. The maintained research is now in the Obsidian vault: [Research Index](../../../vault/20%20Research/Research%20Index.md), [Experiment Log](../../../vault/20%20Research/Experiment%20Log.md), and [Feature Map](../../../vault/20%20Research/Feature%20Map.md).

## Scope
Inspect the user's signed-in free account at https://www.riddled.ai/write to inform an independent personal learning notebook. Do not copy private backend code, bypass plan limits, publish notes, purchase upgrades, or inspect unrelated browser tabs. Do not retain credentials or storage values.

## Connection
Chrome DevTools MCP successfully attached to the user's regular Chrome after Google login. REA 6.8.0 also successfully connected over the local browser WebSocket endpoint. HTTP discovery did not work; use WebSocket discovery. Resolve the current endpoint locally rather than storing it here.

## Verified UI observations
- Welcome note is a multiline rich-text editor.
- Existing example contains an incorrect photosynthesis statement and a margin correction explaining chloroplasts versus mitochondria. This is a pre-existing example, not proof of a newly generated AI response.
- Per-note reading mode picker offers 'Thinks with you' and 'When you ask'. Labels describe proactive versus on-demand assistance. Switching modes and resulting behavior have not been tested.
- Per-note assistant picker lists the default assistant and 'New Riddler' / 'Manage' controls. Custom-assistant creation and free-tier eligibility are untested.
- A note-specific chat sidebar opens and reports reading the note and its threads.
- Chat offers suggested questions about misunderstandings, conclusions, and next steps, plus a multiline input and Send button. No question has been submitted yet.
- Other visible controls: Tell Riddled, Open notes, Share read-only link, Thread options, image enlargement, Upgrade, and an Alt-to-speak hint. These capabilities are not yet exercised.

## REA evidence
- Browser discovery: ev_79bfbf2cfa5943e10093ffe57d42ed3e2cc0edd2a17086c41cfa558bb8462443.
- Passive page inspection: ev_e15f6dca7ce8263a84a853c48167eb396106a41e9af936b0ba29873258a4479b, retained in initial-observation.json.
- Capture is scoped to https://www.riddled.ai, with one-second attach-window observation. It does not establish prior network activity or backend implementation. Script source, storage values, cookies, raw network payloads, and console text were not requested.

## Proposed independent implementation (design choices, not recovered internals)
A rich-text study notebook with note-scoped chat, text-anchored feedback threads, proactive/on-demand feedback modes, and configurable tutoring personas. Persist notes and conversations in our own database; use a chosen AI provider or local model behind our own server. Quiz, flashcard, and progress features have not been observed and should not be attributed to Riddled.

## Next exploration
1. Explore notes navigation and custom-assistant forms without saving changes.
2. Create a clearly named disposable test note; leave the welcome note unchanged.
3. Test a controlled factual misconception and note-scoped chat, tracking free-tier usage rather than repeatedly generating output.
4. Observe anchor behavior, thread resolution, persistence, and plan limits.
5. Agree on MVP requirements before implementing.

## Delegation preference
The user clarified **Herdr**. Its managed-pane environment and CLI were verified; the primary agent used it to start `model-architect` and `research-reviewer` in available existing ThinkVis shell panes. They researched provider portability and test coverage without browser access, credentials, or overlapping file ownership. Results live in the Obsidian vault.
