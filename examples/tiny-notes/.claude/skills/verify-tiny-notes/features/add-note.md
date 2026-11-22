# Add a note

## Sub-features
- Text is trimmed before storing (`" buy milk "` stores as `"buy milk"`).
- Empty or whitespace-only text is rejected (`400`, note not added).
- Each note gets an incrementing `id` and a `createdAt` timestamp.

## How to get to it (user POV)
On the single page (`GET /`), type into the text input next to the header,
then click **Add** (or press Enter — it's a `<form>`).

## Driving it with headless Chrome (CDP)
`node tools/verify/drive.mjs add-delete` (shared with Delete a note — one
flow adds, verifies, then deletes).

The script:
1. Loads `/`, screenshots the empty list.
2. Sets `#text`'s value to a unique string and calls `#new-note`'s
   `requestSubmit()` — the same code path the real submit listener runs,
   not a direct `fetch("/api/notes")`.
3. Polls the DOM until an `<li><span>` with that text appears (the app's own
   `render()` re-fetches and redraws the list after the POST resolves).
4. Screenshots the populated list.
5. Confirms via `GET /api/notes` that the note is actually stored, with the
   expected `id` and trimmed `text` — the side effect, not just the pixels.

## Gotchas
- `render()` is async; a screenshot taken immediately after the click can
  catch the list mid-fetch. The script polls the DOM for the new `<li>`
  before screenshotting — don't remove that wait.
- The store is in-memory and per-process: each `drive.mjs` run starts its
  own server, so notes never leak between runs or collide with a human's
  `npm start` session.
