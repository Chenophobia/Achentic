# Bug: single requests still take the server down

## Goal
No single request, whatever its path or body, can stop Tiny Notes from answering the next one.

## Symptoms
Two requests each end the server process. Found by an independent verifier; see `.verify-evidence/verdict-003.md` if present.

1. `GET //`
2. `POST /api/notes` with the JSON body `null`

After either one the client gets no HTTP response and every later request fails to connect. Ticket 002 fixed a third request of this kind (malformed JSON) and these two survived it.

## Done-check (must be able to pass or fail)
On the running app, for each of the two requests: the client receives an HTTP response with a 4xx status, and a following `GET /api/notes` answers 200.

## Proof wanted
- Each reproduction failing before the fix, committed before the fix.
- Each reproduction passing after it.
- `npm run gates` output, green.
- `node tools/verify/drive.mjs all` output, green, with the resilience feature covering these two requests.
- One sentence on why a fourth request of this kind cannot do the same thing, or an honest statement that it still could.

## Constraints
- Do not edit `scripts/gates.sh` or `scripts/size-budget`.
- Do not write under `.claude/`.
- Stop every process you start.
- Commit locally on a branch named `agent/005-single-request-crashes`. Do not push.
