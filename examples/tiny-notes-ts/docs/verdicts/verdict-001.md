# Verdict — 001 Rebuild Tiny Notes on the TypeScript template

**Verdict: PASS**

Independent, non-author verification of branch `agent/001-rebuild-on-template` against `main`, ticket `tickets/001-rebuild-on-template.md`. Reference app at `../tiny-notes` read-only. No files under version control were edited, committed or reverted; all probing was done with copies and throwaway harnesses in scratchpad.

## Goal

Tiny Notes runs from this repo in strict TypeScript under the template's gates and behaves exactly as the reference app. Confirmed on all three done-check items below.

## Done-check results

1. **`npm run gates` exits 0.** All gates green: typecheck (strict), lint/format (8 files, no fixes), no-comments, knip (unused files/exports/deps), jscpd (0 clones), tests (6/6 pass). Final line `gates: ok`.
2. **`node tools/verify/drive.mjs all` passes all three features.** add-delete PASSED, dark-mode PASSED, resilience PASSED. Each run started its own server on a free port and its own headless Chrome, and tore both down; no stray process from the driver.
3. **Every route matches the reference app, including unknown paths and bad input.** Verified by a side-by-side harness running this app (`npm start`) and the reference app (`node server.js`) on separate ports and diffing status + content-type + body (createdAt normalized) across 28 requests the author did not test. **0 differences.**

## Side-by-side requests (28 cases, 0 diffs)

Same status, content-type and body on both apps for every case, including:

- `GET /api/notes/1`, `POST /api/notes/1`, trailing `/api/notes/`, `POST /`, `PUT /api/notes`, `DELETE /api/notes` → `404 {"error":"not found"}`.
- `DELETE /api/notes/abc` (non-numeric) → 404 not found; `DELETE /api/notes/999`, `/007`, `/99999999999999999999` → `404 {}`.
- Non-object JSON bodies (`[1,2]`, `123`, `"hi"`, `true`, `{"text":123}`, `{"text":null}`, `{"text":{}}`, `{"text":"   "}`) → `400 {"error":"text is required"}`.
- Whitespace trim `{"text":" hi "}` → `201 {"id":1,"text":"hi",...}`; extra fields `{"text":"x","id":99,"createdAt":"z"}` → server ignores them and assigns its own id/timestamp.
- No `content-type` header with a valid body still → 201; empty body no header → 400.
- `GET //` → `400 {"error":"bad request"}` (URL parse throws, caught); `GET /../etc` → 404; `HEAD /api/notes` → 404 empty; query strings on `/` and `/api/notes` ignored.

## Code review against CLAUDE.md

No comments, `.ts` import extensions, no enums/non-erasable syntax, no `any`, no non-null `!`. Every escape hatch in `src/` reviewed and found sound:

- `src/server.ts:10` `body: unknown` and `:15/:27` `unknown` — correct boundary typing for a value that is whatever `JSON.parse` returned; `JSON.stringify` accepts any input.
- `src/server.ts:17` `(chunk as Buffer).toString()` — `IncomingMessage` async-iterates `Buffer` chunks by default (no `setEncoding`). Sound; proven by every POST body parsing correctly in the runs above.
- `src/server.ts:35` `(body as Record<string, unknown>)` — reached only inside `typeof body === "object" && body !== null`, so the assertion narrows `unknown` to an indexable object. Sound; proven by array/number/string/null/nested bodies all producing the reference's `400`, never a crash.

No escape hatch hides a defect. `src/server.ts` factors the reference's inline handler into `route`/`serveIndex`/`createNote` with identical behavior; `src/store.ts` mirrors the reference store with `readonly` Note fields; `public/index.html` is byte-identical to the reference.

## Not verified

- Concurrency / load behavior was not exercised (single-client requests only); neither app claims it.
- Persistence across restarts is out of scope (both apps use an in-memory store by design).

## Process hygiene

All processes I started were stopped. `drive.mjs` cleaned up its own servers/Chrome. My comparison harness `SIGKILL`ed both servers; `npm start` left one grandchild `node src/main.ts` (npm does not forward signals to its child) — I killed it (PID 72625) and confirmed `pgrep -fl "src/main.ts"` returns nothing. This is a harness artifact of launching via `npm start`, not an app defect; `drive.mjs` spawns node directly and is unaffected.
