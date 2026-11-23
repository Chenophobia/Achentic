All verified. No repo edits made. No stray processes.

## Independent verification — agent/005-error-reporting

**What ran**
- `sh scripts/gates.sh` → green. typecheck strict, lint/format, no-comments, knip, jscpd (0 clones), 16/16 tests pass.
- Own HTTP driver (`scratchpad/break.mjs`, outside repo) exercising paths author did not:
  - **Production env wiring** — `createApp(explodingStore)` with no explicit reporter, `process.env.ERROR_DSN` set. Confirms default param `createErrorReporter(process.env.ERROR_DSN)` fires.
  - Tracker answering **HTTP 500**.
  - **Malformed DSN** (`not-a-valid-dsn:::`), **empty key**, **empty project id**.
- Read orchestrator browser drive `.verify-evidence/orchestrator-drive.txt`.

**What found — done-check, all pass**
- **DSN set, unexpected error → exactly one event, right shape.** `POST /api/77/store/`, header `Sentry sentry_version=7, sentry_key=K3Y, sentry_client=tiny-notes/1.0`. event_id 32-hex, timestamp round-trips ISO, platform `node`, level `error`, `request {method:"GET",url:"/api/notes"}`, `exception.values[0]` type `Error` / value `boom`, 6 frames **oldest-first** (frame[0] = node internal, innermost = `Object.explode`). One event only — health check after did not add a second.
- **Never leaks.** Request made with `?secret=shh` + JSON body — neither query, body, nor `content-type` in payload. Only method + pathname (query stripped).
- **DSN unset → nothing sent.** Author's fetch-spy test confirms only app's own requests go out.
- **Tracker down / slow / 500 → request unaffected, server keeps serving.** Case-500 returned 400 in 6ms, health 200 after. Fire-and-forget fetch with `AbortSignal.timeout(3000)`, never awaited.
- **Purposeful rejections not reported.** Malformed JSON, blank text, >280 chars, unknown route, `GET //` → all return via explicit `json()`, never throw, tracker got 0. `//` now routed through `parseRequestUrl` → null → 400 (purposeful), confirmed.
- **No regression.** Orchestrator browser drive: add-delete, dark-mode, length-limit, resilience all PASSED.

**Code vs CLAUDE.md**
- No new deps — platform `fetch`, `node:crypto` randomUUID. `.ts` import extensions. No comments. No `any`, no `!` in src.
- **Escape hatches:** src adds none. Boundary guard `error instanceof Error`, else `String(error)` with empty frames — sound. Frame parse guards undefined filename with `continue`, `function ?? "?"`. Noop reporter `() => undefined` when DSN absent/invalid — sound. Test-only `as` casts parse known JSON — acceptable at test boundary.
- Seam kept out of prod behaviour: extra `report` param defaults to env-driven reporter; prod path unchanged when DSN unset.

**Could not check**
- Browser flows myself (sandbox blocks headless Chrome) — relied on orchestrator evidence, which passed.
- Real Sentry backend — fake tracker only (matches ticket's protocol spec).

VERDICT: PASS
