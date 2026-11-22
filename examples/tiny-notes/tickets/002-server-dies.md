# Bug: the server stops answering after a bad request

## Goal
One bad request must never take Tiny Notes down for everyone else.

## Symptom
After sending a POST to `/api/notes` whose body is not valid JSON (for example `{nope`), the client gets no HTTP response, and every later request to the server fails to connect.

## Done-check (must be able to pass or fail)
On the running app: the bad POST receives an HTTP 400 response, and a following `GET /api/notes` still answers 200.

## Proof wanted
- The failing reproduction, captured before the fix.
- The same reproduction passing after the fix.
- `npm run gates` output, green.

## Constraints
- Do not edit `scripts/gates.sh` or `scripts/size-budget`.
- Commit locally on a branch named `agent/002-server-dies`. Do not push.
