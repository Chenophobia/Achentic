# Report unexpected server errors to an error tracker

## Goal
When the server hits an error it did not expect, the error is sent to an error tracker, so a failure in the deployed app is seen without anyone watching.

## Done-check (must be able to pass or fail)
- With the environment variable `ERROR_DSN` set, an unexpected error while handling a request causes exactly one event to be posted to the tracker, carrying the error's type, message and stack frames.
- With `ERROR_DSN` unset, nothing is sent and behaviour is exactly as before.
- If the tracker is down, slow or answers with an error, the request that failed still gets its normal response in normal time, and the server keeps serving.
- Requests the server rejects on purpose (malformed JSON, missing text, too long, unknown route) are not reported.
- Everything that worked before still works.

## Proof wanted
- `npm run gates` output, green.
- Tests that start a local fake tracker and check: one event with the right shape on an unexpected error; nothing when the variable is unset; the request unaffected when the fake tracker is closed.

## Known
- No new dependencies. Use the platform's own `fetch`.
- The tracker speaks the Sentry protocol. A DSN looks like `http://<key>@<host>/<project id>`.
- Events go to `POST <scheme>://<host>/api/<project id>/store/` as JSON with the header `X-Sentry-Auth: Sentry sentry_version=7, sentry_key=<key>, sentry_client=tiny-notes/1.0`.
- Event body: `event_id` (32 hex characters), `timestamp` (ISO string), `platform` "node", `level` "error", and `exception.values` as a list of `{ type, value, stacktrace: { frames: [{ filename, function, lineno }] } }`, frames ordered oldest call first.
- Do not send request bodies, headers or note text. Only the error itself, the HTTP method and the path.
- There is no easy way today to make the server fail unexpectedly from outside. Tests may need a seam for that; keep it out of the production path's behaviour.

## Constraints
- Do not edit gate or CI configuration.
- Commit locally on the branch `agent/005-error-reporting`. Do not push.
