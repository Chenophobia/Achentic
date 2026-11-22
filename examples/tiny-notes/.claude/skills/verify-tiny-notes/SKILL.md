---
name: verify-tiny-notes
description: Verify tiny-notes (the zero-dependency Node notes web app in this repo) actually works — launch a real server and headless Chrome, drive the UI like a user, and capture screenshot/log evidence. Use before claiming a change to server.js, store.js, or public/index.html is done, or when asked to prove a feature works end to end.
---

# Verify tiny-notes

tiny-notes is a single zero-dependency Node app: `server.js` (HTTP + JSON API),
`store.js` (in-memory note store), `public/index.html` (the whole UI: add a
note, delete a note, toggle dark mode). It has no database and no migrations —
every launch starts from an empty note list.

The repo is zero-dependency on purpose (`scripts/gates.sh` enforces a line
budget and a no-comments rule on the three source files). This skill stays
zero-dependency too: helpers use only Node 22 built-ins (`node:child_process`,
`node:net`, `fetch`, the global `WebSocket`) to drive headless Chrome over the
raw DevTools protocol. Never run `npm install` for this skill.

Helper scripts live at `tools/verify/` in the repo root (not under this skill
folder) and are invoked with `node tools/verify/<script>.mjs ...` from the
repo root. Each one starts whatever it needs (a tiny-notes server, a headless
Chrome instance), drives it, writes evidence under `.verify-evidence/`, and
stops only what it started.

## Launch

For manual exploration (not required by the drive helpers below, which launch
their own instance):

```
PORT=4317 node server.js
```

Ready signal: the process prints `tiny-notes on http://localhost:4317` to
stdout, and `GET /api/notes` returns `200` with a JSON array (immediately —
there are no migrations or seed data to wait on). `Ctrl-C` to stop.

Never use port 3000 for a verification instance — it's the documented default
a human may have a dev server running on (`npm start`). The drive helpers
below pick a free port automatically and never choose 3000.

Two instances can run side by side with no conflict: give each its own `PORT`.
There is no shared data dir or lock file to collide on.

## Doctor

Read-only check — "is this instance worth driving?" Does not start or stop
anything:

```
node tools/verify/doctor.mjs <port>
```

Checks `GET /api/notes` returns 200 with a JSON array and `GET /` serves the
`Tiny Notes` page. Exits 0 and prints "healthy tiny-notes instance" if both
hold, exits 1 otherwise (including when nothing is listening on that port).
Run this first if a drive fails in a confusing way, against whatever port the
failed run logged.

## Drive

```
node tools/verify/drive.mjs <add-delete|dark-mode|resilience|all>
```

Each run:
1. Picks two free ports (app port, Chrome DevTools port; never 3000).
2. Starts `node server.js` with `PORT=<app port>` and waits for it to answer.
3. For `add-delete` and `dark-mode`: starts headless Chrome
   (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   --headless=new --remote-debugging-port=<cdp port>
   --user-data-dir=<fresh tmp dir>`), opens a tab via the DevTools protocol
   HTTP endpoint (`PUT /json/new?<url>`), and drives it over the tab's
   `webSocketDebuggerUrl` using `tools/verify/lib/cdp.mjs` (a ~100-line raw
   CDP client over the Node 22 global `WebSocket` — no Puppeteer, no
   dependency).
4. Drives the real user-facing DOM: sets `#text`'s value and calls
   `#new-note`'s `requestSubmit()` (the same path a user's keystroke + click
   takes — not a direct `fetch` to `/api/notes`), clicks the real `Delete`
   button inside the note's `<li>`, clicks the real `#theme-toggle` button.
   `resilience` is HTTP-only (no UI surface for a malformed request) and
   talks to the server directly.
5. Writes evidence (see below), then tears down only the server process and
   Chrome process (and its `user-data-dir`) it started this run.

`all` runs all three in sequence, each with its own fresh server/Chrome pair.

## Evidence

Everything lands in `.verify-evidence/` (repo root), one text log and 0-4
screenshots per feature, named `<feature>-<step>.png` / `<feature>.log`:

- `add-delete.log`, `add-delete-01-loaded.png`, `-02-added.png`, `-03-deleted.png`
- `dark-mode.log`, `dark-mode-01-initial.png`, `-02-toggled.png`, `-03-after-reload.png`
- `resilience.log` (no screenshots — HTTP-only feature)

The log for each feature is timestamped per step and states PASS or the
specific assertion that failed. A drive proves more than "the screenshot
looks right": after each UI action it also confirms the resulting state via
`GET /api/notes` (add/delete) or `localStorage.getItem("theme")` plus a page
reload (dark mode) — the same side effects a user or a second browser tab
would observe, not an internal setter.

`.verify-evidence/` is gitignored. It is proof for the human/agent driving
the skill right now, not something to commit.

## Cleanup

Each `drive.mjs` run tears down its own server and Chrome process (and
Chrome's temporary `--user-data-dir`) in a `finally` block, including on
failure. Nothing to run by hand. If a run is killed before its `finally`
fires (e.g. the shell itself is killed), the orphaned processes are whatever
PID `drive.mjs` printed in that run's log — `kill <pid>`, don't pattern-kill
`node` or `Google Chrome` by name, since a human's own dev server or regular
browser session may be running too.

Cleanup never removes `.verify-evidence/` — only a human clearing proof on
purpose should delete that directory.

## Helpers

- `node tools/verify/doctor.mjs <port>` — read-only health check, see Doctor.
- `node tools/verify/drive.mjs <add-delete|dark-mode|resilience|all>` — launch, drive, capture evidence, clean up. See Drive.
- `tools/verify/lib/cdp.mjs`, `tools/verify/lib/harness.mjs` — shared library code imported by `drive.mjs` and `doctor.mjs` (port picking, process spawn/teardown, a minimal CDP client). Not invoked directly.

## Feature map

See `features/README.md` for the maintained list of user-facing features and
how to drive each one. When `server.js`, `store.js`, or `public/index.html`
changes, keep that map honest — `/maintain-verification-skill` covers the
loop for updating it as the app evolves.
