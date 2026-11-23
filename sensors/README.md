# Sensors

Scripts that watch a deployed app and turn a real failure into a ticket for the [orchestrator](../orchestrator/README.md). No AI runs here; quota is spent only once a ticket exists.

| Sensor | Question | On failure |
|---|---|---|
| [Uptime check](uptime-kuma/README.md) (Uptime Kuma) | Is it up? Are the orchestrator and live check still running? | Alert only |
| Scheduled live check (below) | Does it work for a user? | Ticket after two failures |
| [Error collection](glitchtip/README.md) (GlitchTip) | Is it throwing errors? | Ticket per new error |

## Scheduled live check

Every hour, clicks through the deployed app like a user. If it is broken twice in a row, files one ticket.

```sh
node sensors/verify-live.mjs --repo <app-repo> --url https://app.example.com
```

What one run does:

1. Takes the orchestrator's lock for that app. If the orchestrator is working, the check waits for the next hour.
2. Asks the address for a response. No answer, or a gateway error (502, 503, 504, 52x), is an outage: one alert, no ticket. Outages are operations, not code.
3. Runs the app's live check with `VERIFY_BASE_URL` set to the address.
4. Pass: resets the count. If the app was failing or down before, sends "passing again".
5. First failure: recorded as a suspect, nothing filed.
6. Second failure in a row: writes `tickets/ready/NNN-live-<flow>.md`, commits it on the base branch, alerts, and keeps the screenshots and logs under `$ACHENTIC_HOME/<app>/sensor-evidence/`.
7. The same failure again while its ticket is open: counted, nothing filed.

### What the app must provide

`node tools/verify/drive.mjs live`, which:

- reads the address from `VERIFY_BASE_URL` and starts no server of its own;
- runs only flows that are safe on a deployed app: they clean up what they create and send no malformed requests;
- prints `[flow] FAILED: reason` for a failing flow and exits non-zero.

`examples/tiny-notes-ts/tools/verify/drive.mjs` does this. Its live flows are add-then-delete a note and the dark mode toggle; it refuses to run the other flows against a deployed address.

### Limits built in

| Limit | Default | Variable |
|---|---|---|
| Failures in a row before a ticket | 2 | `ACHENTIC_SENSOR_CONFIRMATIONS` |
| Tickets filed per day | 2 | `ACHENTIC_SENSOR_DAILY_CAP` |
| Time allowed for the check | 5 minutes | `ACHENTIC_SENSOR_MINUTES` |
| Check command | `node tools/verify/drive.mjs live` | `ACHENTIC_LIVE_CHECK` |

`ACHENTIC_HOME`, `ACHENTIC_BASE` and `ACHENTIC_NTFY_URL` mean the same as for the orchestrator. `ACHENTIC_SENSOR_HEARTBEAT_URL`, if set, is pinged with the result after every run.

Two failures count as the same when the flow and the message match after numbers are removed.

### Schedule it

```sh
sh sensors/install-launchd.sh <app-repo> https://app.example.com
```

Writes an hourly LaunchAgent and prints the command to start it.

### Tests

```sh
node --test sensors/test/verify-live.test.mjs
```

Seven tests with a fake check and a throwaway git repository: healthy, suspect then ticket then duplicate, reset on pass, daily cap, new ticket after the old one was judged, outage, busy repository and held lock.

### Know before relying on it

- The ticket contains output from the live app. If strangers can put text into your app, that text can reach the builder's prompt. The ticket marks it as data and the builder cannot push or deploy, but treat sensor tickets from a public app as untrusted and read them before the orchestrator runs.
- It checks what the live flows check and nothing else. An app that is up, passes both flows and is still wrong elsewhere goes unnoticed.
- It runs on the same machine as the apps. If the Mac mini or its network is down, the sensor is down too.
- The live check writes to the real app (a note is added and deleted). Keep live flows to actions that are harmless for real users.
- A ticket says the deployed app is broken, not that the repository's code is. If the deployed app runs an older commit, the builder may find nothing to fix and should say so.
