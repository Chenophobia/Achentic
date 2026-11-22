# Independent verification — agent/003-routing-refactor

**Verifier:** non-author, live runs against the real app.
**Compared:** branch `agent/003-routing-refactor` vs `main`.
**Ticket:** `tickets/003-routing-refactor.md` — make request routing readable at a glance; observable behaviour unchanged; gates line count must not go up.
**Date:** 2026-11-21.

## Verdict: PASS + NOTES

The refactor meets its done-check. Behaviour is unchanged across every case I
could compare, and the gates line count did not increase. Two server crashes
exist, but both reproduce identically on `main` — they are pre-existing and out
of scope for this branch, not regressions it introduced.

## What the change is

`server.js` replaces an in-line if/else chain inside the request handler with a
declarative `routes` table (`method`, `pattern`, `handler`) and a small loop
that matches method + path and dispatches. Named handlers (`serveIndex`,
`listNotes`, `createNote`, `deleteNote`) are lifted to module scope. `store.js`
and `public/index.html` are untouched (confirmed: diff hits only `server.js` and
`test/api.test.js`). Two behaviour-pinning tests were added (unknown path 404,
delete-missing 404).

## Done-check results

- **Observable behaviour unchanged — PASS.** Proven by live A/B below.
- **Gates line count does not go up — PASS.** `server.js + store.js +
  index.html`: main = 169 lines, branch = 169 lines (gates counts only these
  three; the added lines are in `server.js` but offset by removing the old
  if-chain). `npm run gates` → `gates: ok (169/220 lines)`, comment budget
  respected (refactor added no `//` comments), all 6 tests pass.
- **Readability — genuine.** A reader now sees the whole route map in one
  four-line table instead of tracing a ~30-line handler with interleaved
  early-returns. This is a real reduction in what the reader must hold in head.

## Live verification run on the branch

verify-tiny-notes `drive.mjs all` — all three features PASS driving the real
headless-Chrome UI and confirming via API / localStorage:

- `add-delete`: submitted a note through the real form, confirmed stored via
  `GET /api/notes`, clicked real Delete, confirmed gone. PASS.
- `dark-mode`: toggled `#theme-toggle`, confirmed `localStorage` persisted and
  survived a reload. PASS.
- `resilience`: malformed POST → 400, follow-up GET → 200, valid POST → 201.
  PASS.

## Adversarial A/B — branch server vs main server, same requests

Ran both servers side by side (main materialised from `git show main:*` into a
scratch dir, with the identical `store.js` / `index.html`) and sent a battery of
edge cases beyond what the author tested. Script:
`scratchpad/probe.mjs`. **Every comparable case returned byte-identical
status + content-type + body on both. 0 diffs.**

Cases proven identical (branch == main):

- Method/path mismatches: `GET /api/notes/5`, `PUT /api/notes`, `POST /`,
  `POST /api/notes/5`, `PATCH /api/notes/1`, `OPTIONS /api/notes`,
  `HEAD /` → all 404 `{"error":"not found"}` (HEAD: empty body).
- Delete edge cases: `DELETE /api/notes/abc`, `/api/notes/`,
  `/api/notes/99999999999999999999`, `/api/notes/01` → 404.
- Path shapes: `GET /api/notes/`, `/api/notes/5/extra`, `/API/NOTES` → 404;
  `GET /?foo=bar`, `/%2e`, `/..` → 200 index page.
- POST body shapes: empty `{}`, `{text:5}`, array, whitespace-only,
  empty raw body → 400 `text is required`; malformed JSON → 400
  `invalid JSON`; valid `{text:"hi"}` → 201 with note object.

## Proven findings (two crashes — both PRE-EXISTING)

Both were found by driving the real running server and both **reproduce
identically on `main`** (confirmed with `scratchpad/crash.mjs`, which captured
the same stack and `exitCode: 1` on each branch). They are NOT introduced by
this branch — the crashing line (`new URL(req.url, "http://localhost")`) and the
null-destructure are unchanged from main.

1. **`GET //` crashes the server process.**
   `new URL("//", "http://localhost")` throws `TypeError: Invalid URL`; the
   async handler has no catch, so the process exits 1. One unauthenticated
   request kills the server. Reproduces on main. Pre-existing.

2. **`POST /api/notes` with a JSON `null` body crashes the server process.**
   `readBody` returns `null` (valid JSON), then `const { text } = body`
   destructures `null` → `TypeError` outside the try/catch → process exits 1.
   Reproduces on main. Pre-existing.

Neither blocks this branch (the ticket scope is a behaviour-preserving routing
refactor, and behaviour is preserved including these failure modes). Flagging
them as separate hardening work: wrap the handler body in try/catch and return
400/404 instead of letting the process die.

## Evidence

- `.verify-evidence/add-delete.log`, `dark-mode.log`, `resilience.log` + screenshots (drive run).
- A/B + crash scripts in the session scratchpad: `probe.mjs`, `crash.mjs`, `main-app/`.
- `npm run gates` → `gates: ok (169/220 lines)`, 6/6 tests pass.

No files under version control were edited, committed, or reverted.
