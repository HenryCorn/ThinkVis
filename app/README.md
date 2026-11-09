# ThinkVis app (notebook, provider broker, margin feedback)

Local Markdown notebook with note-scoped chat through a provider broker. No npm dependencies. Requires Node 24+. The app makes no network calls unless you configure a connection and press Send.

```
cd app
npm start        # prints http://127.0.0.1:4317/?token=...  Open that link once.
npm test         # 81 tests
```

Environment: `THINKVIS_DATA` (default `../app-data`, git-ignored), `THINKVIS_PORT` (default 4317).

## Data layout
- `app-data/notes/**/*.md` plain Markdown, never rewritten except by an explicit save.
- `app-data/thinkvis.sqlite` note ids, purpose, assistance mode, search index.
- `app-data/.trash/` deleted notes. `app-data/exports/<timestamp>/` Markdown exports.

## Behavior
- Edits made outside the app are detected on open and on save; a stale save is refused and the UI offers keep-mine or load-disk.
- A file renamed outside the app keeps its note id if its content is unchanged.
- Files that are not valid UTF-8 or exceed 5 MiB are skipped and never modified.
- Paths: relative only, no `..`, hidden names, reserved Windows names or symlinks/junctions.
- Server: binds 127.0.0.1, per-launch token exchanged for an HttpOnly SameSite=Strict cookie, Host and Origin checks, `X-ThinkVis` header on writes, strict CSP.

## Connections (Phase 2)
Copy `connections.example.json` to `app-data/connections.json` and edit it. The file holds names only, never keys.
- **Anthropic / Google (API):** set the key in an environment variable named in `keyEnv` (must start with `THINKVIS_`), then restart. You need real API access for the model you name; a chat subscription does not provide it. Model ids are yours to choose, none are hard-coded.
- **GitHub Copilot via Pi (experimental, off by default):** needs your own Pi install signed in to that model, and `THINKVIS_ENABLE_PI_BRIDGE=1`. It runs Pi with no tools, MCP, extensions, skills, sessions or context files, in a throwaway folder with a minimal environment. This route is **not verified against a live account**.
- **Mock:** deterministic offline provider for tests.

Behavior: the note text plus your message is sent only when you press Send (the UI shows exactly what will be sent). Providers get no tools. There is no automatic fallback to another provider. Retries happen only for rate limits and outages, re-checking the note, connection and hourly cap before each attempt. Every reply is stored with its provider, model and billing label, and switching connections keeps the thread. Chat never edits the note.

## Feedback and personas (Phase 3)
- **Get feedback** asks the chosen model for up to three corrections, questions or suggestions, each tied to an exact quote from your note. Quotes must appear once in the note; anything the model invents, repeats or cannot anchor is dropped and counted. Malformed model output stores nothing.
- Each item records the note revision, persona (with version), connection and model. The list shows two separate facts: **quote position** (found, moved, ambiguous, gone) and **freshness** (written for an earlier version). "Show in note" selects the quote.
- Resolve, dismiss, reopen, and reply in a thread. A resolved item is not reopened by a later duplicate.
- Personas are independent of the model: name, instructions, voice (plain, warm, blunt, playful) and how often they speak up (rarely, when it matters, often). Three built-ins plus your own; editing creates a new version and old feedback keeps the version that wrote it. "Speaks up" stretches or shortens the proactive cooldown (3x, 1x, 0.5x), which is our own mapping.
- **Make a note** turns a feedback thread into a new note under `From feedback/`; the source note is untouched. **Copy Markdown** copies the open note when you press it.
- **Proactive feedback** is off by default, needs a chosen connection, and only acts on notes set to Proactive. It waits for a quiet period, a per-note cooldown and a daily cap, requires the note to have changed, and rechecks everything before each outbound attempt. Switching a note to Quiet, or turning the switch off, cancels queued work and aborts an in-flight request. Text already sent cannot be recalled.
- Markdown export appends a Feedback section (resolved and dismissed included) to the exported copy only.

## Diagrams
Instead of generating pictures, a diagram is plain text the app parses and draws itself. Write or ask for a fenced block marked `mermaid`:

    flowchart LR
    A[Sunlight] --> B(Chloroplast)
    B -->|makes| C{Sugar?}
    C -.->|no| A

It is a strict subset of Mermaid flowcharts: `flowchart TD|LR`, nodes `[rect]`, `(rounded)`, `{decision}`, connections `-->`, `---`, `-.->`, `==>` with optional `|label|`, at most 40 nodes. Diagrams show under the editor as you type, and in chat and feedback replies. Anything outside the subset (subgraphs, styling, other diagram types) is reported with the reason and shown as source, never guessed at. Labels are only ever inserted as text. The tutor prompt tells models this subset.

## Not done yet
Rich Markdown preview, undo beyond the browser textarea, backup/restore (manual export only, per D020), streaming (replies arrive whole), highlighting quotes inside the editor, selected-text assistance, appearance settings, command palette, an allowance/usage screen, an image-attachment pipeline and PDF export. Several of these were only seen as buttons in Riddled and never tested there, so they are not claimed as parity.

**Decided against (by you, 2026-11-09):** voice/spoken notes, Word export, sharing, and AI image generation.
