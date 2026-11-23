# Health endpoint

## Goal
A monitor can ask the running app whether it is up.

## Done-check (must be able to pass or fail)
- `GET /api/health` returns status 200 with JSON `{"status":"ok"}`.
- Any other method on that path returns 404, like other unknown routes.
- Everything that worked before still works.

## Proof wanted
- `npm run gates` output, green.
- The verify drive script checks the health endpoint as part of an existing or new flow. `node tools/verify/drive.mjs all` green.

## Known
- No authentication. No extra fields in the response.

## Constraints
- Do not edit gate or CI configuration.
- Commit locally on the branch `agent/003-health-endpoint`. Do not push.
