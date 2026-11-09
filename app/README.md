# ThinkVis app (Phase 1 notebook, Phase 2 provider broker)

Local Markdown notebook with note-scoped chat through a provider broker. No npm dependencies. Requires Node 24+. The app makes no network calls unless you configure a connection and press Send.

```
cd app
npm start        # prints http://127.0.0.1:4317/?token=...  Open that link once.
npm test         # 48 tests
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
Copy  to  and edit it. The file holds names only, never keys.
- **Anthropic / Google (API):** set the key in an environment variable named in  (must start with ), then restart. You need real API access for the model you name; a chat subscription does not provide it. Model ids are yours to choose, none are hard-coded.
- **GitHub Copilot via Pi (experimental, off by default):** needs your own Pi install signed in to that model, and . It runs Pi with no tools, MCP, extensions, skills, sessions or context files, in a throwaway folder with a minimal environment. This route is **not verified against a live account**.
- **Mock:** deterministic offline provider for tests.

Behavior: the note text plus your message is sent only when you press Send (the UI shows exactly what will be sent). Providers get no tools. There is no automatic fallback to another provider. Retries happen only for rate limits and outages, re-checking the note, connection and hourly cap before each attempt. Every reply is stored with its provider, model and billing label, and switching connections keeps the thread. Chat never edits the note.

## Not done yet
Rich Markdown preview, undo beyond the browser textarea, backup/restore (manual export only, per D020), proactive feedback, personas, streaming (replies arrive whole).
