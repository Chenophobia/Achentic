# Uptime check (Uptime Kuma)

Answers one question every minute: is each app up? An outage alerts your phone. It never files a ticket: an app that is down is an operations problem, and an agent editing code will not fix a dead tunnel or a full disk.

It also watches the watchers. The orchestrator and the live check ping it after every run; if the pings stop, you hear about it.

## Start it on the Mac mini

Needs Docker (Docker Desktop or OrbStack).

```sh
docker compose -f sensors/uptime-kuma/compose.yml up -d
```

Then open http://localhost:3001. It listens on the Mac mini only. To reach it from your phone, put it behind your Cloudflare Tunnel with Cloudflare Access in front; do not publish it bare.

Data lives in the Docker volume `achentic-uptime_uptime-kuma-data`. The image is pinned to 2.5.12; change the tag in `compose.yml` to update.

## Set it up (in its web page, once)

These steps follow Uptime Kuma's own documentation. I started the container and reached the setup page; I did not click through the rest, because the admin account is yours to create.

1. Choose SQLite. Create the admin account.
2. Settings → Notifications → add one of type ntfy with your topic. Use the same topic as `ACHENTIC_NTFY_URL`. Tick "apply on all existing monitors" and default enabled.
3. One monitor per app. Type HTTP(s), the app's health address (for example `https://notes.example.com/api/health`), interval 60 seconds, retries 2. Use the public address so the tunnel is checked too.
4. Optional second monitor per app on the local address (`http://host.docker.internal:<port>/api/health`). Public down and local up means the tunnel; both down means the app.
5. Two monitors of type Push, one named "orchestrator" with heartbeat interval 2100 seconds (it runs every 1800), one named "live check" with 3900 seconds (it runs every 3600). Copy each push address.

## Connect the heartbeats

Give the copied push addresses to the two jobs. In the LaunchAgent files written by the installers, add under `EnvironmentVariables`:

| Job | Variable | Value |
|---|---|---|
| Orchestrator | `ACHENTIC_HEARTBEAT_URL` | Push address of "orchestrator", without the query string |
| Live check | `ACHENTIC_SENSOR_HEARTBEAT_URL` | Push address of "live check", without the query string |

Each run then ends with one request to that address carrying its result (`idle`, `review`, `blocked`, `ok`, `ticket`, …). A run that never happens, or a script that crashes before the end, sends nothing, and Uptime Kuma alerts when the interval passes. A failed ping never fails the run.

The push address contains a token. Keep it out of any repository.

## The blind spot

Uptime Kuma runs on the same machine as the apps. If the Mac mini loses power or the house loses internet, it goes down with them and sends nothing.

Cover that with one free check from outside, for example UptimeRobot's free plan, pointed at one public health address. It only ever sends "home is unreachable". That is an account you create; nothing here sets it up.

## What was checked

- `docker compose config` accepts the file.
- The pinned image starts on Apple silicon, reports healthy within 10 seconds, serves its setup page on 127.0.0.1:3001 only, uses about 140 MB of memory idle, and can reach a service on the host through `host.docker.internal`.
- The heartbeat code has a test: correct address and result sent, failure swallowed.

Not checked: monitors, notifications and push monitors inside Uptime Kuma, since they need the admin account.
