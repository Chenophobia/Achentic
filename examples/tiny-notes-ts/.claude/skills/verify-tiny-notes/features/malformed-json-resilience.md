# Resilience to malformed requests

## Sub-features
- A `POST /api/notes` with a body that isn't valid JSON gets `400`, not a
  dropped connection.
- The server keeps serving other requests afterward — one bad request
  doesn't take the process down.

## How to get to it (user POV)
There's no UI path to send malformed JSON (the form always sends real
`JSON.stringify`d bodies) — this is a server guarantee for any client making
a direct HTTP request, and the regression this guards (`tickets/002-server-dies.md`)
was found by curl, not the browser.

## Driving it with headless Chrome (CDP)
Not applicable — this feature has no DOM to click. `drive.mjs resilience`
talks HTTP directly, no Chrome instance involved:

```
node tools/verify/drive.mjs resilience
```

The script:
1. Starts a server on a free port.
2. `POST`s a literal `{nope` body with `content-type: application/json` and
   asserts `400`.
3. Immediately `GET`s `/api/notes` and asserts `200` — the actual regression
   this guards against was the server going completely unresponsive after
   the bad request, so this step is the point of the test, not a formality.
4. `POST`s one more, valid note and asserts `201`, confirming the server
   isn't just alive but still fully functional.

## Gotchas
- Don't swap in a test-only endpoint or a unit-level call into `createApp()`
  — the original bug was specifically in the raw socket/HTTP handling
  (`readBody` throwing before a response was sent), so the proof has to go
  over a real HTTP connection, which this does.
