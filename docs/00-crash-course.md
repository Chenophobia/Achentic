# Crash course

Twenty minutes. Read top to bottom once; after that the other docs make sense.

## 1. The idea in one paragraph

You describe what you want. One agent turns that into small tickets. Another agent builds one ticket at a time. Plain scripts (tests, lint) decide whether the code is acceptable. A third agent, which did not write the code, runs the real app and tries to break it. You read its verdict and press merge. Everything except "describe" and "merge" is automated.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| Claude Code | The agent program. Runs in the app, or in a terminal as `claude` |
| Headless | `claude -p "prompt"`: runs without a chat window, prints a result, exits. This is what a scheduler calls |
| Skill | A markdown file of instructions an agent loads for a kind of task. Invoked as `/name` |
| Plugin | A bundle of skills. We use two: **pstack** and **mattpocock-skills** |
| Playbook | pstack's step list for one kind of work: Feature, Bug fix, Refactoring |
| Ticket | One small, complete piece of work, written as goal + pass/fail done-check + proof wanted |
| Gates | A script whose exit code says pass or fail. No AI involved. `scripts/gates.sh` |
| Verify skill | A project-specific skill plus helper scripts that start the app, drive it in a real browser, and save screenshots |
| Verdict | `PASS`, `PASS+NOTES` or `FAIL` from an agent that did not write the change |
| Worktree | A second checkout of the same repo, so two jobs do not trip over each other |
| Quota | Your Max plan's rolling 5-hour and weekly limits. Every headless run draws from it |

## 3. Who does what

| Role | Who | Tool |
|---|---|---|
| Decide what to build | You | An issue, a sentence |
| Sharpen it into tickets | Agent + your answers | Pocock: `/grill-with-docs` → `/to-spec` → `/to-tickets` |
| Build one ticket | Agent | pstack: `/pstack:poteto-mode` picks the playbook |
| Decide if code is acceptable | Script, run by GitHub Actions | `scripts/gates.sh` |
| Prove it works on the running app | Agent, not the author | `verify-<app>` skill, then a verdict |
| Accept the change | You | Merge |

## 4. How the stack was chosen

Each choice traces to a constraint you gave or something the research found. Full reasoning and sources are in the [research report](../reports/Agentic%20dev%20cycle%20pstack%20Pocock.md).

| Choice | Why |
|---|---|
| pstack as the engine | You named Lauren Tan's method as the main driver. It is the piece that keeps code clean: evidence-only review, bug repro before theory, subtract-first refactors, non-author verdicts |
| Pocock's skills for the front end | pstack deliberately has no interview and no ticket queue. An "only prompt ideas" workflow needs both |
| Tickets kept, even though pstack rejects specs | You need a durable queue you can see from a phone. Each ticket is written the pstack way (goal + done-check), so the two fit |
| pstack for all code work; Pocock at five named points only | You asked for pstack as the main engine. Fixed rule in [06-which-tool-when.md](06-which-tool-when.md) |
| GitHub Actions runs the gates | You asked for CI there. Deterministic only, so it costs no quota |
| TypeScript strict, no comments, no dead code, no duplication as gates | pstack advises these but enforces none; scripts do. See [07-code-standards.md](07-code-standards.md) |
| Deterministic gates as the real merge check | Both authors rank scripts above prompts. pstack ships no dead-code or duplication sweep, so gates fill that hole |
| Non-author verdict | pstack's rule: "an author checks what it meant to build." Today it found two crashes the author missed |
| One agent at a time | Max $100 quota is one shared pool; parallel runs drain it proportionally. Also pstack's single-owner rule |
| Sonnet builds, Opus judges | Building is the high-volume work; judging benefits from a different, stronger model |
| $20 API for small capped jobs | A second tank with a hard dollar limit that still works when the subscription is locked out |
| Mac mini + launchd + Docker Compose + one Cloudflare tunnel | What you already run. No new paid services |
| Separate macOS user and sandbox for the agent | The same machine hosts production and tunnel credentials |

## 5. What has actually been tested

All on a 170-line throwaway app, [examples/tiny-notes](../examples/tiny-notes), launched by hand. Details: [05-unverified.md](05-unverified.md).

| Works | Evidence |
|---|---|
| Both plugins install and load headless | Installed; 11 headless runs |
| Idea → grill → spec → 5 tickets | `examples/tiny-notes/.scratch/tags/` |
| Feature, Bug fix, Refactoring playbooks | Tickets in `examples/tiny-notes/tickets/`; run log in [05-unverified.md](05-unverified.md) |
| Agent drives a real browser | `tools/verify/`, screenshots in `.verify-evidence/` |
| Non-author verdict finds real bugs | `examples/tiny-notes/docs/verdicts/` |
| Verdict → ticket → fix → re-verdict | Ticket 005 |

| Not tested or not built | |
|---|---|
| A real app (database, auth, dependencies) | Unknown how it scales |
| Running unattended | Every run was started by hand |
| Quota per ticket | Never measured against the weekly limit |
| Phone intake, preview, deploy, rollback | Not built |
| Sandbox user, process cleanup | Not built; early runs left orphan servers |

## 6. Running 24/7 and catching bugs: what that takes

"Runs 24/7" and "catches bugs whenever" are two different systems. Only part of the first exists.

**A. Building around the clock (designed, not built)**

1. A poller on the Mac mini, started by launchd every 15–30 minutes, that picks one ready ticket and runs the build.
2. A wrapper that caps runs per day, logs cost, and kills leftover processes.
3. A CI runner that runs gates, the verify skill and the verdict on every branch.
4. You merge from your phone.

**B. Catching bugs in what is already live (not designed yet)**

Today's loop only catches bugs in a change before it merges. Catching failures in production needs sensors that turn a failure into a ticket:

| Sensor | Catches | Feeds the loop by |
|---|---|---|
| Uptime check hitting each app every minute | App down, tunnel down | Opening a ticket, pinging your phone |
| Scheduled verify-skill run against production (read-only features) | A feature that silently stopped working | Opening a ticket with screenshots |
| Error log watcher (app logs, container restarts) | Crashes, exceptions | A cheap API-budget job that groups errors and opens one ticket per new kind |
| Nightly dependency audit | Known vulnerabilities | Opening a ticket |
| Twice-weekly architecture survey | Slow rot | Filing refactor candidates for you to pick |

Each sensor only opens a ticket. The same build → gates → verdict → merge path handles it from there. That keeps one pipeline, and keeps you as the merge gate.

Rule from both authors: add one automated trigger at a time, with a brake on each. Triggers without brakes are how you get a "slop cannon".

## 7. What to read, in order

| # | File | Time | Why |
|---|---|---|---|
| 1 | This file | 20 min | The map |
| 2 | [Deck](../Agentic%20dev%20cycle.pptx) | 10 min | Same story in pictures |
| 3 | [01-workflow.md](01-workflow.md) | 10 min | The eleven phases and three gates |
| 4 | [02-clean-code-rules.md](02-clean-code-rules.md) | 10 min | How Lauren keeps code clean; the heart of it |
| 5 | [06-which-tool-when.md](06-which-tool-when.md) | 5 min | pstack or Pocock: the fixed rule |
| 5b | [07-code-standards.md](07-code-standards.md) | 5 min | Every standard and the script that enforces it |
| 5c | [05-unverified.md](05-unverified.md), from "Install test" down | 15 min | What happened when it was actually run |
| 6 | [04-budget-and-infra.md](04-budget-and-infra.md) | 10 min | Quota, models, Mac mini layout, guardrails |
| 7 | [03-setup-runbook.md](03-setup-runbook.md) | 10 min | Commands and rollout stages, when you start building |
| 8 | [Research report](../reports/Agentic%20dev%20cycle%20pstack%20Pocock.md) | 30 min | Sources and the reasoning behind every choice |

Then look at the example app: read `examples/tiny-notes/tickets/005-single-request-crashes.md`, the fix in `server.js`, and `docs/verdicts/verdict-005.md`. That is one full turn of the loop in three files.

Primary sources, if you want the authors in their own words:

- pstack guide: `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.46/docs/guide/` (ten short chapters, already on this Mac)
- Pocock: the README at `github.com/mattpocock/skills` and `/mattpocock-skills:ask-matt` inside Claude Code

## 8. Try it yourself in five minutes

In a terminal:

```bash
cd examples/tiny-notes
```

```bash
npm run gates
```

```bash
node tools/verify/drive.mjs all
```

```bash
open .verify-evidence
```

The first shows the deterministic gate. The second starts the app, drives it in headless Chrome and saves screenshots. The third opens the evidence.
