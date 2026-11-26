# Mission control

One page for every project the agents work on: what is running right now, where each ticket stands, and for any ticket the whole story from idea to merge — who built it, which skills and helper agents were used, what was run, what it cost, why it stopped.

It is also where you create tickets. Nothing has to live in GitHub issues.

```sh
node mission-control/server.mjs
```

Then open http://localhost:4400.

## What you see

| Part | Shows |
|---|---|
| Working now | For each project with a run in progress: the ticket, the step it is at, how long it has run, the agent's last action, how many helper agents are at work |
| Tickets | Every ticket of every project on a line of eight stations: Queued, Building, Checks, Gates, Browser, Verdict, Ready, Merged. Blocked tickets show why |
| A ticket | What happened, step by step with times. Who did what: builder and verifier per attempt, with model, duration, cost, the skills and playbooks they loaded, tools used, files written, commands run, the helper agents they started and what those did. The builder's report, the verdict in full, the files changed, the ticket text |
| New ticket | A form: title, goal, done-check, proof wanted, known |
| Top line | Agent runs and cost today and over seven days, across all projects |

The page refreshes every five seconds.

## Where it gets this

It keeps no database. It reads what already exists:

| Shown | Read from |
|---|---|
| Projects | `~/.achentic/<app>/repo`, written by the orchestrator on its first run for a project |
| Ticket status | The ticket files in the project, `state.json`, the verdict files |
| Steps and times | `~/.achentic/<app>/orchestrator.log` |
| Cost, attempts | `~/.achentic/<app>/runs.jsonl` |
| Reports | `~/.achentic/<app>/logs/<ticket>-<role>-<n>.json` |
| Skills, tools, helper agents, commands | Claude Code's own record of each run, under `~/.claude/projects/` |
| Running now | The lock, the checked-out branch, the newest run record |

So it must run as the same user as the orchestrator. On the Mac mini that is the agent user.

## Creating tickets

The form does not touch the project's repository. It writes the idea to `~/.achentic/<app>/inbox/`. At the start of its next run the orchestrator gives it the next number, commits it as `tickets/ready/NNN-<title>.md` and starts on it. Until then the page shows it as "Waiting for the orchestrator".

That keeps the web page away from git, and means a ticket can be filed while a build is in progress.

GitHub issue intake ([intake/](../intake/README.md)) still exists and stays off unless `ACHENTIC_GITHUB_REPO` is set. Use one or both.

## The one button that changes something

"Put it back in the queue" on a blocked ticket. It does what `orchestrator.mjs retry` does: the old branch is kept as `stale/…` and the ticket is queued again. Refused while the orchestrator is working on that project.

There is no merge, push, deploy or "run now" button.

## Reaching it from anywhere, safely

Whoever can open this page can read your tickets and agent reports, and can queue work that spends your quota and becomes an agent's task. So:

1. It listens on `127.0.0.1` only. Leave it that way.
2. Publish it through your Cloudflare Tunnel with **Cloudflare Access** in front, allowing only your own login. That is the real lock.
3. Set an access word as a second lock: add `ACHENTIC_MC_TOKEN=<something long>` to `~/.achentic/env`. The page then asks for it once per browser. You choose it and type it into the file yourself.

Built in: requests that change something must come from the page itself (same origin, JSON), ticket names are checked, text is never inserted as HTML, and the page cannot be framed by another site.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `ACHENTIC_MC_PORT` | `4400` | Port |
| `ACHENTIC_MC_HOST` | `127.0.0.1` | Address to listen on. Change only if you know why |
| `ACHENTIC_MC_TOKEN` | unset | Access word. Unset means anyone who reaches the page is in |
| `ACHENTIC_HOME` | `~/.achentic` | Where the orchestrator keeps its state |

## Keep it running on the Mac mini

```sh
sudo sh setup/agent-user/install-daemon.sh agent mission-control /Users/agent/work/Achentic
```

It prints the command that starts it. The job restarts the server if it stops.

## Tests

```sh
node --test mission-control/test/mission-control.test.mjs
```

Five tests against a made-up project and run record: stations and tallies; a ticket's timeline, skills, tools, helper agents and verdict; a new ticket landing in the inbox without touching the repository; requests from another site, with the wrong content type or odd paths refused; the access word.

## What was checked, and what was not

- The tests above.
- Run against the real history of the sandbox project (five tickets, including the one where pstack ran three competing versions): the ticket page showed `pstack:poteto-mode`, the feature playbook, the arena skill, the four helper agents with their models and tool counts, and the verdict. Looked at on a desktop and a phone-sized screen.
- An inbox idea becoming a numbered, committed ticket is covered by an orchestrator test.

Not checked: the "Working now" panel during a real run (no agent was started; the Claude login on the test machine was a work account at the time). The page behind Cloudflare Access. The daemon install.

## Limits

- It watches; it does not steer. You cannot talk to an agent mid-run.
- Step by step, not word by word. The last action updates every five seconds; an agent's report appears when that agent finishes.
- The skills and helper-agent details come from Claude Code's own run records, a format that is not a promised interface. If an update changes it, those sections go empty and the rest keeps working.
- One machine. It shows the projects on the Mac it runs on.
