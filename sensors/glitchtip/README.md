# Error collection (GlitchTip)

Answers: is the live app throwing errors nobody saw? The app sends each unexpected error to GlitchTip, which groups repeats into one issue. A sensor reads the open issues every hour and files one ticket per new issue for the [orchestrator](../../orchestrator/README.md).

```
app ── unexpected error ──► GlitchTip (groups, counts)
                               ▲
          errors sensor ───────┘ reads open issues every hour
               │ new issue
               ▼
        tickets/ready/NNN-error-<issue>.md ──► orchestrator ──► you merge
               ▲
               └─ ticket judged ──► sensor marks the issue resolved;
                                    if the error returns, a new ticket says so
```

No AI runs here. Tokens are spent only when the orchestrator picks the ticket up.

## 1. Start GlitchTip on the Mac mini

Needs Docker.

```sh
sh sensors/glitchtip/init.sh
docker compose --env-file sensors/glitchtip/.env -f sensors/glitchtip/compose.yml up -d
```

`init.sh` writes a random secret key to `sensors/glitchtip/.env`, which git ignores. Open http://localhost:8000. It listens on the Mac mini only; to reach it from elsewhere put it behind your Cloudflare Tunnel with Cloudflare Access.

This is the small setup from GlitchTip's own install guide: one web container and Postgres, no Valkey, log ingestion and uptime monitoring off (Uptime Kuma does uptime). Measured idle: about 250 MB of memory for both containers. Image pinned to 6.2, the version the install guide names; 7.0.0 exists and is two weeks old.

## 2. Set it up in its web page, once

1. Register the first account. Then stop new sign-ups: add `GLITCHTIP_REGISTRATION=False` to `sensors/glitchtip/.env` and run the `up -d` command again.
2. Create an organization and one project per app. Note the two slugs.
3. Copy the project's DSN. It goes into the app's environment as `ERROR_DSN`.
4. Profile → Auth Tokens → create a token with the scopes `event:read` and `event:write`. It goes into `~/.achentic/env` as `ACHENTIC_GLITCHTIP_TOKEN`. Keep it out of any repository.

If the apps run in Docker, the DSN host must be reachable from their containers, not `localhost`.

## 3. The app's side

The app posts errors itself, with `fetch`, to GlitchTip's Sentry-compatible endpoint. No SDK, so the template keeps zero runtime dependencies. `examples/tiny-notes-ts` shows it; it was added by the orchestrator from ticket 005.

Rules the example follows, and yours should:

- `ERROR_DSN` unset means nothing is sent.
- A tracker that is down never slows or fails a request.
- Only unexpected errors are sent. Rejections the app makes on purpose are not.
- No request bodies, headers or user text. The error, the method and the path.

## 4. Run the sensor

```sh
ACHENTIC_GLITCHTIP_TOKEN=… node sensors/errors.mjs \
  --repo <app-repo> --url http://localhost:8000 --org <org-slug> --project <project-slug>
```

What one run does:

1. Takes the orchestrator's lock for that app; skips if it is busy.
2. For every earlier ticket that now has a verdict file, marks its GlitchTip issue resolved.
3. Reads the project's unresolved issues.
4. For each one not yet ticketed, oldest first: reads the latest event, writes `tickets/ready/NNN-error-<issue>.md` with the error and its top stack frames, commits it, alerts.
5. Stops at the daily cap.

| Setting | Default | Variable |
|---|---|---|
| Events before an issue gets a ticket | 1 | `ACHENTIC_ERRORS_MIN_EVENTS` |
| Sensor tickets per day | 2 | `ACHENTIC_SENSOR_DAILY_CAP` |
| Pinged with the result after every run | unset | `ACHENTIC_ERRORS_HEARTBEAT_URL` |

Result words in the log: `ok`, `ticket`, `capped`, `deferred` (repository busy), `down` (GlitchTip not answering or refusing the token; one alert, no ticket), `locked`.

To schedule it, copy the LaunchAgent written by `sensors/install-launchd.sh`, change the label and the program arguments to the command above. A dedicated installer is not written yet.

## Know before relying on it

- The ticket contains text from the live app's errors. If strangers can cause errors with text of their choosing, that text can reach the builder's prompt. The ticket marks it as data and the builder cannot push or deploy; for a public app, read these tickets before the orchestrator runs.
- Raise `ACHENTIC_ERRORS_MIN_EVENTS` if one-off errors would otherwise eat the daily cap.
- A ticket says the deployed app raised the error. If it runs an older commit, the builder may find nothing to fix and should say so.
- Browser-side errors are not collected. Only what the server reports.

## What was checked

- The compose file starts: health endpoint answers within a minute, bound to 127.0.0.1 only.
- The sensor's requests match the API description served by that running GlitchTip (issue list, latest event, issue update, bearer token).
- Five sensor tests against a fake tracker: nothing to do, new error to ticket once, oldest first with cap and minimum events, resolve after verdict and re-file on return, tracker down and busy repository.

- End to end against a real GlitchTip 6.2 in a throwaway container (2026-11-23): the example app's reporter sent two unexpected errors, GlitchTip accepted them and grouped them into one issue, a deliberate rejection was not reported; the sensor filed one ticket with the error and its stack, filed nothing on the next run, marked the issue resolved once a verdict file existed, and filed a second ticket saying the error had come back when it recurred.

Not checked: the steps in the web page (registration, auth token screen), because the test account was made from inside the container without a password. Scheduling.
