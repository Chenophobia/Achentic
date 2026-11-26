# Crash course

Fifteen minutes. What the system is, how the parts talk, what costs tokens, how to run it.

## 1. The idea

You write a ticket. A script hands it to an agent that builds it. Plain scripts check the code. A second agent, which did not write it, tries to break it. You read the verdict and merge. Sensors watch the live app and write tickets themselves when something breaks.

Six phases — Plan, Design, Build, Test, Deploy, Maintain — and how tickets are named: [08-phases.md](08-phases.md).

## 2. Words

| Word | Meaning |
|---|---|
| Headless | `claude -p "prompt"`: Claude Code with no chat window. Runs, prints a result, exits. This is how every agent here is called |
| pstack | Lauren Tan's plugin. The engine. `/pstack:poteto-mode` picks a playbook: Feature, Bug fix or Refactoring |
| Ticket | A markdown file: goal, a done-check that can pass or fail, proof wanted |
| Gates | `scripts/gates.sh`. Six checks, exit code decides. No AI |
| Browser drive | `tools/verify/drive.mjs`. Starts the app, clicks through it in headless Chrome, saves screenshots |
| Verdict | `PASS`, `PASS+NOTES` or `FAIL` from an agent that did not write the change |
| Orchestrator | The script that runs the loop. Not an AI |
| Sensor | A script that watches the live app |

## 3. The parts

| Part | Where | What it does | State |
|---|---|---|---|
| Template | `template/` | Start of every app: TypeScript strict, six gates, CI file, agent rules | Proven |
| Orchestrator | `orchestrator/` | Takes one ticket through build, checks, verdict | Proven on 3 real tickets |
| Sandbox mode | `ACHENTIC_SANDBOX=1` | Confines every command the agents run | Proven |
| Live check | `sensors/verify-live.mjs` | Hourly: is the live app working for a user? Files a ticket if not | Built, tested locally |
| Uptime check | `sensors/uptime-kuma/` | Every minute: is it up? Are the jobs still running? Alerts only | Built, setup is yours |
| Error collection | `sensors/glitchtip/`, `sensors/errors.mjs` | Hourly: any new error in the live app? Files a ticket per error | Built, ran end to end once |
| Mission control | `mission-control/` | One page for all projects: running now, every ticket's stations and history with agents, skills and helper agents; a form to file tickets | Built, tested, seen on real history |
| Intake + progress | `intake/`, `orchestrator/lib/notify.mjs` | A GitHub issue becomes a ticket; every step is posted to Discord | Built, tested against fakes |
| CI | `.github/workflows/ci.yml` | Runs the gates on GitHub on every push | Running |
| Agent user | `setup/agent-user/` | A separate macOS account that owns nothing valuable | Scripts written, not run |

## 4. What talks to what

```
 YOU ── GitHub issue (label "agent") from anywhere, or a ticket file
                               │ intake, every 30 min
                               ▼
                        app repo: tickets/ready/MA-1.md
                               │
                 every 30 min  ▼
                        ORCHESTRATOR (script, no AI)
                               │ creates branch agent/MA-1
                               ▼
                 ┌──► BUILDER   claude -p, Sonnet, pstack      ◄── uses tokens
                 │             │ commits on the branch
                 │             ▼
   finding goes  │      branch checks  (commit? clean? gate files untouched?)
   back, up to   │             ▼
   3 attempts    ├──── GATES    sh scripts/gates.sh            no tokens
                 │             ▼
                 ├──── BROWSER DRIVE  node tools/verify/drive.mjs all   no tokens
                 │             ▼
                 └──── VERIFIER claude -p, Opus, fresh process ◄── uses tokens
                               │ PASS: verdict file committed on the branch
                               ▼
 YOU ◄── Discord: every step ── branch agent/MA-1 is ready ── you merge, you push
                               │
                               ▼
                        GITHUB ACTIONS runs the gates again     no tokens


 LIVE APP ◄── every hour ── LIVE CHECK ── broken twice ──► tickets/ready/ (back to the top)
 LIVE APP ◄── every minute ─ UPTIME KUMA ── down ──► Discord alert only, never a ticket
 ORCHESTRATOR and LIVE CHECK ── ping after each run ──► UPTIME KUMA (silence = alert)
```

Three rules hold it together:

- The orchestrator talks to agents only by starting `claude -p` and reading what it prints. Agents never talk to each other.
- State lives in files: tickets in the repo, verdicts in `docs/verdicts/`, everything else in `~/.achentic/<app>/`.
- Nothing pushes, merges or deploys except you.

## 5. How an agent is called

One command per agent. The orchestrator builds it; you never type it.

```sh
claude -p "/pstack:poteto-mode Implement the ticket in tickets/ready/TN-4.md. …" \
  --model sonnet \
  --permission-mode acceptEdits \
  --allowedTools "Bash(node *)" "Bash(npm *)" "Bash(git *)" … \
  --settings ~/.achentic/<app>/agent-settings.json \
  --add-dir ~/.claude/plugins/cache/cursor-plugins/pstack \
  --output-format json
```

| Piece | Why |
|---|---|
| `-p "…"` | Headless. The prompt starts with `/pstack:poteto-mode`, which loads pstack and picks the playbook |
| `--model` | `sonnet` builds, `opus` judges |
| `--permission-mode` | Builder may edit files. Verifier may not |
| `--allowedTools` | The only shell commands allowed without asking. Nobody is there to ask |
| `--settings` | The sandbox rules (only in sandbox mode) |
| `--add-dir` | Lets pstack read its own playbooks |
| `--output-format json` | The orchestrator reads result, cost and session id from it |

| | Builder | Verifier |
|---|---|---|
| Model | Sonnet | Opus |
| Process | One session; a retry resumes it with `--resume` | Always new, knows nothing of the builder's reasoning |
| May edit | Yes, inside the repo | No. If the repo changed while it ran, the verdict is void |
| Ends with | A report | One line: `VERDICT: PASS`, `PASS+NOTES` or `FAIL` |

Pocock's skills are never called by the orchestrator. You type them yourself when an idea is too vague for a ticket: `/mattpocock-skills:grill-with-docs`, then `to-spec`, then `to-tickets`.

## 6. What uses tokens

| Uses your Claude Max quota | Per ticket, measured |
|---|---|
| Builder (Sonnet lead; pstack may add larger models) | $1.00 to $2.50 API-equivalent, 1 to 5 minutes. Once $13.60, 28 minutes |
| Verifier (Opus) | $1.20 to $1.70, 1 to 2 minutes |
| A retry | About $1 more |

| Uses no tokens |
|---|
| Orchestrator, branch checks, gates, browser drive |
| GitHub Actions (free for a public repository) |
| Issue intake, live check, Uptime Kuma, heartbeats, Discord posts |

- A simple ticket costs about **$3 to $4 API-equivalent**, a hard one up to $15. On the subscription you are not billed that; it comes out of the weekly limit. How much of the weekly limit is not measured yet.
- All runs so far, about 26: roughly $47 API-equivalent, $15 of it one ticket.
- The $20 API budget is used by nothing that is built. The run wrapper removes `ANTHROPIC_API_KEY` so a run cannot fall back to paid use.
- pstack runs at its defaults. On a ticket it finds hard it may build competing versions on larger models and pick one. That happened once: $15 and 28 minutes instead of $3 and 5.
- Brakes: 3 tickets a day, 3 attempts a ticket, one ticket at a time, 2 sensor tickets a day. A runaway guard stops a single agent run at $25 (builder) or $8 (verifier).
- If the weekly limit starts to bite: `/pstack:setup-pstack` with a small budget in the app repo.

## 7. Run it by hand

Once per app:

```sh
cp -R template/ ~/work/my-app && cd ~/work/my-app && git init -b main
claude plugin install pstack@cursor-plugins --scope project
claude plugin install mattpocock-skills@claude-plugins-official --scope project
npm ci && npm run gates
```

Then per ticket:

| Step | Command |
|---|---|
| Write a ticket | Mission control → New ticket. Or open a GitHub issue with the "Ticket for the agents" form, or copy `tickets/TEMPLATE.md` to `tickets/ready/MA-1.md` and commit on `main` |
| Run the loop once | `node orchestrator/orchestrator.mjs run --repo ~/work/my-app` |
| See where things stand | `node orchestrator/orchestrator.mjs status --repo ~/work/my-app` |
| Read the verdict | `docs/work/MA-1/4-test/verdict.md` on branch `agent/MA-1`, or the ticket in mission control |
| Accept | `git merge agent/MA-1`, then push |
| Try a blocked ticket again | `node orchestrator/orchestrator.mjs retry MA-1 --repo ~/work/my-app` |

Add `ACHENTIC_SANDBOX=1` in front of the run command to confine the agents.

Try it now on the example, no tokens needed:

```sh
cd examples/tiny-notes-ts && npm ci && npm run gates && node tools/verify/drive.mjs all && open .verify-evidence
```

## 8. Run it 24/7 on the Mac mini

Full steps: [setup/agent-user/README.md](../setup/agent-user/README.md), [sensors/README.md](../sensors/README.md), [sensors/uptime-kuma/README.md](../sensors/uptime-kuma/README.md).

| # | Step | Command |
|---|---|---|
| 1 | Create the agent user | `sudo sh setup/agent-user/create-user.sh agent` |
| 2 | As that user: install Node and Claude Code, clone Achentic and the app into `~/work` | `sudo -u agent -i` |
| 3 | As that user: make a long-lived login token, put it in `~/.achentic/env` yourself | `claude setup-token` |
| 4 | As that user: one ticket by hand | `sh setup/agent-user/run-as-agent.sh orchestrator ~/work/my-app` |
| 5 | Schedule the orchestrator, every 30 minutes | `sudo sh setup/agent-user/install-daemon.sh agent orchestrator /Users/agent/work/my-app` |
| 6 | Schedule the live check, every hour | `sudo sh setup/agent-user/install-daemon.sh agent sensor /Users/agent/work/my-app https://my-app.example.com` |
| 7 | Start the uptime check, then set it up in its web page | `docker compose -f sensors/uptime-kuma/compose.yml up -d` |
| 8 | Issues in, progress out: create a Discord webhook, add `ACHENTIC_DISCORD_WEBHOOK_URL` and `ACHENTIC_GITHUB_REPO` to `~/.achentic/env` | [intake/README.md](../intake/README.md) |
| 9 | On GitHub: protect `main`, require the `gates` check | |

Steps 5 and 6 each print the command that starts the job. Nothing starts by itself.

Not using a separate user yet? `sh orchestrator/install-launchd.sh <app>` and `sh sensors/install-launchd.sh <app> <url>` schedule the same jobs under your own account.

## 9. What keeps it safe

| Guard | Stops |
|---|---|
| Sandbox | Agent commands writing outside the repo, reading `~/.ssh` or the keychain, reaching the internet (only npm and localhost allowed), pushing to GitHub |
| Separate user | Everything else, including agent-written tests the gates run: that user has no keys and no admin rights |
| Protected files | A change to gate scripts, `.github/`, `.claude/`, `CLAUDE.md` or `package.json` scripts blocks the ticket at once |
| Verifier cannot edit | A verdict from a verifier that touched the repo is thrown away |
| No push rights | The agent user has no GitHub credentials. You fetch its branches and push |
| Caps | Tickets per day, attempts per ticket, one run at a time |

One cost: Chrome cannot start inside the sandbox. The orchestrator runs the browser drive outside it and saves the output for the agents to read.

## 10. What catches bugs

| When | What | How |
|---|---|---|
| Before merge | Six gates | Types, lint, no comments, dead code, duplication, tests |
| Before merge | Browser drive | Real clicks in a real browser |
| Before merge | Verifier | Tries inputs the author did not |
| After merge | GitHub Actions | Same gates, clean machine |
| Live | Uptime check | Down or unreachable: alert |
| Live | Live check | Up but broken: ticket, back into the loop |
| Live | Error collection (GlitchTip) | New error: ticket. Ran end to end once against a real GlitchTip |

## 11. Proven and not

| Proven | |
|---|---|
| Agent builds strict TypeScript under the gates without touching them | Ticket 001 |
| Orchestrator, queue to mergeable branch, no hand steps | Tickets 002, 003, 004 |
| Retry: a failure goes back to the same session and gets fixed | Ticket 003 |
| Sandbox blocks escapes, loop still works inside it | Ticket 004 |
| Verifier finds bugs the author missed | Two crashes in the first example |
| Live check: healthy, broken, stopped | Local copies of the app |

| Not yet | |
|---|---|
| Anything scheduled | Installers written, none loaded |
| The agent user | Needs `sudo` on the Mac mini |
| A real app: database, login, dependencies | Only a 100-line notes app so far |
| Share of the weekly limit per ticket | Unmeasured |
| Uptime Kuma monitors, a real Discord channel, a real issue through intake | Need your accounts |
| A real verifier FAIL sent back through the orchestrator | Only with a fake agent |

Every run and its numbers: [05-unverified.md](05-unverified.md).

## 12. Why these choices

| Choice | Reason |
|---|---|
| pstack runs all code work | You chose it as the engine. Pocock's skills only for turning a vague idea into tickets, triage, and architecture reports. Rule: [06-which-tool-when.md](06-which-tool-when.md) |
| Scripts enforce the standards | pstack advises, it does not enforce. Each rule has a gate proven to fail on a bad change: [07-code-standards.md](07-code-standards.md) |
| The manager is a script | An AI manager spends tokens to decide what a loop can decide. Tokens go only to building and judging |
| Sonnet builds, Opus judges | Building is the volume. Judging gains from a different, stronger model |
| One ticket at a time | One shared weekly quota |
| GitHub Actions for gates only | Free and cannot be argued with. AI steps stay at home on the subscription |
| Outages alert, bugs become tickets | An agent editing code cannot fix a dead tunnel |

## 13. Read next

| File | For |
|---|---|
| [Deck](../Agentic%20dev%20cycle.pptx) | This page in pictures |
| [orchestrator/README.md](../orchestrator/README.md) | Every setting and what blocks a ticket |
| [setup/agent-user/README.md](../setup/agent-user/README.md) | Sandbox measurements and Mac mini steps |
| [02-clean-code-rules.md](02-clean-code-rules.md) | How pstack keeps code clean |
| [05-unverified.md](05-unverified.md) | The log of every test run |
| [Research report](../reports/Agentic%20dev%20cycle%20pstack%20Pocock.md) | Sources |
