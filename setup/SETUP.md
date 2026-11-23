# Set up a Mac

Written for Claude Code to follow when someone opens this repository and says "set this machine up". A person can follow it too. Each step says who does it: **Claude** runs the command, **You** means the person has to, because it needs a password, a browser login or `sudo`.

Two levels. Stop after level 1 on a laptop. Go on to level 2 on the machine that should run unattended.

## Level 1: this Mac can run the loop by hand

| # | Who | Step |
|---|---|---|
| 1 | Claude | `sh setup/doctor.sh`. Fix each `MISSING` line with the command it prints, then run it again until it says `Ready` |
| 2 | You | If the doctor asks for a Claude login: `claude auth login`, with the personal account |
| 3 | Claude | `sh setup/new-project.sh <name>` for the first project. It ends with the next commands |
| 4 | Claude + You | Write the first ticket together from `tickets/TEMPLATE.md`, save it as `tickets/ready/001-<what>.md`, commit |
| 5 | Claude | `ACHENTIC_SANDBOX=1 node orchestrator/orchestrator.mjs run --repo ~/work/<name>` and wait. A simple ticket takes about five minutes |
| 6 | Claude | `sh setup/status.sh`, then show the verdict file from the branch `agent/001-<what>` |
| 7 | You | Read the verdict. `git merge agent/001-<what>` if you accept it |

Level 1 is done when one ticket has gone from file to verdict on this Mac.

## Level 2: this Mac runs it unattended

Do these in order. Each has its own guide; this table is the order and the check.

| # | Who | Step | Guide | Done when |
|---|---|---|---|---|
| 1 | You | Create the agent user: `sudo sh setup/agent-user/create-user.sh agent` | [agent-user/README.md](agent-user/README.md) | It prints the new home folder |
| 2 | You | Close your own home folder to other users if the script says it is open | same | `chmod 700` done |
| 3 | You | `sudo -u agent -i`, then install Node and Claude Code for that user, clone this repository and the app into `~/work` | same | `sh setup/doctor.sh` says `Ready` as that user, apart from the login |
| 4 | You | As that user: `claude setup-token`, paste the token into `~/.achentic/env` as `CLAUDE_CODE_OAUTH_TOKEN=…` | same | The file has the line; nobody else can read it |
| 5 | You | As that user: one ticket by hand, `sh setup/agent-user/run-as-agent.sh orchestrator ~/work/<app>` | same | It ends in `review` or `blocked`, not an error |
| 6 | You | Schedule the orchestrator: `sudo sh setup/agent-user/install-daemon.sh agent orchestrator /Users/agent/work/<app>`, then the start command it prints | same | `sh setup/status.sh` shows it loaded |
| 7 | You | Deploy the app so it has an address (see "Hosting" below) | — | The address answers |
| 8 | You | Schedule the live check: `… install-daemon.sh agent sensor /Users/agent/work/<app> <address>` | [../sensors/README.md](../sensors/README.md) | Loaded; first run logs `ok` |
| 9 | You | Start Uptime Kuma, create its admin, add monitors and the two push monitors | [../sensors/uptime-kuma/README.md](../sensors/uptime-kuma/README.md) | Monitors green |
| 10 | You | Start GlitchTip, register, create the project and token, set `ERROR_DSN` for the app, schedule `errors` | [../sensors/glitchtip/README.md](../sensors/glitchtip/README.md) | A test error shows up as an issue |
| 11 | You | Create a Discord webhook; add `ACHENTIC_DISCORD_WEBHOOK_URL=…` and `ACHENTIC_GITHUB_REPO=<owner>/<name>` to the agent's `~/.achentic/env` | [../intake/README.md](../intake/README.md) | An issue you open with the label `agent` shows up in Discord as "queued", then step by step |
| 12 | You | On GitHub: protect `main`, require the `gates` check | — | A direct push to `main` is refused |

Claude's part in level 2: explain each step, check the "done when" with `sh setup/status.sh` and the logs, and read errors. It does not run the `sudo` steps or handle the token.

## Hosting

Nothing in this repository deploys an app. The intended layout on the Mac mini:

- Each app runs as its own Docker Compose project, started by you from a checkout of `main`.
- One Cloudflare Tunnel publishes the apps. Uptime Kuma and GlitchTip stay on `localhost` unless you put them behind Cloudflare Access.
- Deploying is: `git pull` on `main`, rebuild, restart. By you.
- The app gets `ERROR_DSN` in its environment so it reports to GlitchTip.

## A new project later

```sh
sh setup/new-project.sh <name>
```

On the unattended Mac, also clone it for the agent user and repeat level 2 steps 6, 8 and 10 for it.

## Where to look

| Question | Command or file |
|---|---|
| Everything at a glance | `sh setup/status.sh` |
| What is in the queue, what is waiting for me | `node orchestrator/orchestrator.mjs status --repo <app>` |
| What happened, step by step | `~/.achentic/<app>/orchestrator.log` |
| What an agent actually said | `~/.achentic/<app>/logs/<ticket>-builder-1.json`, `…-verifier-1.json` |
| What it cost | `~/.achentic/<app>/runs.jsonl` |
| Why a ticket is blocked | `status` shows the reason; then the builder or verifier file above |
| Output of the scheduled job, own user | `~/Library/Logs/achentic-<app>.log`, `~/Library/Logs/achentic-sensor-<app>.log` |
| Output of the scheduled job, agent user | `/Users/agent/.achentic/<job>-<app>.log` |
| Is a job loaded, when did it last run | `launchctl print system/com.achentic.orchestrator.<app>` |
| Run a job now | `sudo launchctl kickstart system/com.achentic.orchestrator.<app>` |
| Browser evidence of the last check | `<app>/.verify-evidence/` |
| Screenshots from a failed live check | `~/.achentic/<app>/sensor-evidence/<ticket>/` |
| Uptime Kuma, GlitchTip | `http://localhost:3001`, `http://localhost:8000`, `docker logs <container>` |

When the jobs run as the agent user, `~/.achentic` means `/Users/agent/.achentic`; read it with `sudo -u agent sh setup/status.sh`.

## When something is wrong

| Sign | Likely cause | Do |
|---|---|---|
| Ticket `blocked`: "Builder run failed" with a login message | Token expired or wrong account | As the agent user: `claude setup-token` again, update `~/.achentic/env`, then `retry` |
| Ticket `blocked`: `error_max_budget_usd` | One run went over the guard | Read the builder file. Raise `ACHENTIC_BUILD_MAX_USD` or split the ticket, then `retry` |
| Ticket `blocked`: "protected files" | The agent tried to change a gate | Read its report. If the gate is wrong, change it yourself; then `retry` |
| Ticket `blocked`: "Still failing after 3 attempts" | The ticket is too big or the done-check is unclear | Rewrite the ticket smaller, `retry` |
| `skipped: working tree is not clean` | Someone left changes in the agent's clone | Commit or stash them there |
| `skipped: daily cap` | Three tickets already started today | Wait, or raise `ACHENTIC_DAILY_CAP` |
| Nothing has run for hours | Job not loaded, or the Mac slept | `sh setup/status.sh`; `sudo pmset -a sleep 0` on the Mac mini |
| Uptime Kuma says a push monitor is down | The job stopped running or crashes before its end | The job's own log file, above |
| Live check `down` | The app or the tunnel is unreachable | That is hosting, not code: check the container and `cloudflared` |
