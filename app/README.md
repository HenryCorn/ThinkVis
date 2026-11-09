# ThinkVis app (Phase 1: notebook without AI)

Local-only Markdown notebook. No AI provider, no network calls, no npm dependencies. Requires Node 24+.

```
cd app
npm start        # prints http://127.0.0.1:4317/?token=...  Open that link once.
npm test         # 23 tests
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

## Not done yet
Rich Markdown preview, undo beyond the browser textarea, backup/restore (manual export only, per D020), any AI features.
