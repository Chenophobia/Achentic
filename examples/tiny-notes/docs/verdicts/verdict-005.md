# Verdict — 005-single-request-crashes (non-author live verification)

**Verdict: PASS+NOTES**

Branch `agent/005-single-request-crashes` (HEAD `a85665a`) vs `main`. Verified by an
independent verifier who did not write the change. No version-controlled file was
edited, committed, or reverted; all code experiments ran on copies under scratch.

## Goal (from ticket 005)
No single request, whatever its path or body, can stop Tiny Notes from answering the
next one. Done-check: for `GET //` and `POST /api/notes` body `null`, the client gets a
4xx and a following `GET /api/notes` answers 200.

## What the branch changes
- Wraps the whole request handler in a `try { ... } catch { if (!res.headersSent) json(res, 400, …) }`.
- Adds a catch-all `json(res, 404, …)` inside the try.
- Destructures `const { text } = body ?? {}` instead of `const { text } = body`.
- Adds 2 unit tests and extends `tools/verify/drive.mjs` resilience with both repros.

## Bar: met

### 1. Both repros crash main, are fixed on branch (real runs)
Scratch copies of `main` and branch sources driven by `scratchpad/probe.mjs`:

| request | main (pre-fix) | branch |
|---|---|---|
| `GET //` | `TypeError: Invalid URL` → **process exits (code 1)**, follow-up fails to connect | **400**, process alive, follow-up `GET /api/notes` → **200** |
| `POST /api/notes` body `null` | `TypeError: Cannot destructure property 'text' of 'body' as it is null` → **process exits (code 1)** | **400**, process alive, follow-up → **200** |

Both are **pre-existing bugs on main**, fixed by this branch.

### 2. Repo gates + harness green on branch
- `npm run gates` → 6/6 tests pass, `gates: ok (173/220 lines)`.
- `node tools/verify/drive.mjs all` → `add-delete`, `dark-mode`, `resilience` all PASSED.
  Resilience log shows `GET // -> 400`, follow-up `200`, `POST null -> 400`, follow-up `200`.

### 3. Extended adversarial fuzz — no new way to crash or hang (beyond author's tests)
`scratchpad/fuzz.mjs` fired 50+ single requests at a live branch server; after each,
asserted the process stayed up and a follow-up `GET /api/notes` returned 200:
- Malformed/odd paths: `//`, `///`, `/%`, `/%zz`, `/%E0%A4%A`, `/api/notes//`, `/\0`,
  400-digit id, `/api/notes/-1`, `/?q=%`, `/api/notes?x=%ff`, tab/space paths — all handled.
- Methods: HEAD, OPTIONS, PUT, PATCH, TRACE, DELETE on `/` and junk ids — all handled.
- Bodies: `null`, `true`, `false`, `123`, `"hi"`, `[]`, `{}`, `{"text":123}`, `{"text":null}`,
  whitespace, array text, `__proto__` payload, truncated JSON, 100 KB text — all 400/201, never a crash.
- Raw malformed HTTP over a socket (bypasses fetch normalization): bad request line, bad
  version, space in target, NUL in target, 100 KB header, bad/negative Content-Length,
  CONNECT — Node answers `400 Bad Request` or resets; server stays up, follow-up 200 every time.

Result: **ALL PASS; server alive at end.** No single request found that ends the process or
leaves the next client unserved.

> One socket case (`Content-Length: 1000` with 2 bytes sent) shows "no response" — correct
> behavior: the server is waiting for the body the client promised but never sent. The server
> stays up and other clients get 200. Not a defect.

## Notes (do not block shipping)

**Note 1 — residual client-hang if `index.html` is unreadable (pre-existing root cause, branch improves it).**
`GET /` calls `res.writeHead(200)` *before* `await readFile(indexPath)`. If that read throws,
the outer catch sees `res.headersSent === true` and cannot respond, so that one request hangs.
Proven on scratch copies with `index.html` removed (`scratchpad/getroot.mjs`):
- main: GET / → **process crashes** (code 1), follow-up fails.
- branch: GET / → that client **hangs (no response)**, but **process survives** and follow-up `GET /api/notes` → **200**.

This is **not reachable by any request path or body** — it needs a missing/unreadable index file,
a deployment condition, not client input. So it is outside ticket 005's "single request" threat
model, and the branch is strictly better than main here (serves others instead of dying). A tidier
future fix would read the file before `writeHead` so a read error is catchable. Root cause
(writeHead-before-await) pre-exists on main; **not introduced by this branch.**

**Note 2 — `body ?? {}` is redundant for the status-code done-check, but keep it.**
Removed `?? {}` in a scratch branch copy: all 6 tests still pass and the null-body repro still
returns 400 (the outer catch handles the destructure throw), server stays alive. So the guard is
not strictly required to pass the done-check. It is still worth keeping: it returns the precise
`{"error":"text is required"}` via normal control flow instead of an exception-driven generic
`bad request`. Informational, **not a defect, no change requested.**

## Why a "fourth request of this kind" cannot repeat the crash
The handler body is fully wrapped in try/catch, so any throw raised synchronously or via `await`
inside it now becomes a 4xx response instead of an uncaught exception that exits the process. The
only residual is an error thrown *after* response headers are already sent, which exists solely on
the `GET /` readFile path and is not reachable through any request path or body (Note 1).

## Process hygiene
Every server/Chrome/probe process started during verification was stopped. Post-run checks:
no `server.js`, no `probe/fuzz/getroot/drive` processes, no `remote-debugging-port` Chrome, nothing
listening on test ports 4401–4431. Repo working tree clean, HEAD unchanged at `a85665a`.

---
Evidence scripts (scratch, disposable): `probe.mjs`, `fuzz.mjs`, `getroot.mjs` under the session
scratchpad; main/branch source copies under `scratchpad/main-copy` and `scratchpad/branch-copy`.
