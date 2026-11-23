# Achentic

A personal agentic development cycle: describe an idea, agents build it, scripts and a second agent check it, you press merge.

**pstack is the engine.** Matt Pocock's skills are used at five named points and nowhere else. Deterministic gates run on GitHub Actions. AI work runs on a Mac mini on a Claude Max subscription.

**Status, 2026-11-23:** the core loop has been run by hand, headless, on a small example app and it works. A TypeScript-strict template with six tested gates exists, and an agent has rebuilt the example on it with every gate green. An orchestrator script now runs the loop for one ticket end to end; it has done so once, started by hand. It is not scheduled yet, and no real app has been through it.

## Start here

1. [docs/00-crash-course.md](docs/00-crash-course.md) — 20 minutes: vocabulary, who does what, why each piece was chosen, what is proven, what 24/7 needs.
2. [Agentic dev cycle.pptx](Agentic%20dev%20cycle.pptx) — 12 slides, same story in pictures.
3. [docs/06-which-tool-when.md](docs/06-which-tool-when.md) — pstack or Pocock: the fixed rule.
4. [docs/07-code-standards.md](docs/07-code-standards.md) — every standard and the script that enforces it.

## Contents

| Path | What it is |
|---|---|
| [docs/00-crash-course.md](docs/00-crash-course.md) | The map. Read first |
| [docs/01-workflow.md](docs/01-workflow.md) | The cycle: 11 phases, 3 gates, ticket format |
| [docs/02-clean-code-rules.md](docs/02-clean-code-rules.md) | How Lauren Tan keeps code slop-free |
| [docs/03-setup-runbook.md](docs/03-setup-runbook.md) | Install commands, 5-stage rollout, orchestrator sketch |
| [docs/04-budget-and-infra.md](docs/04-budget-and-infra.md) | Quota, models, API budget, Mac mini + Cloudflare, guardrails |
| [docs/05-unverified.md](docs/05-unverified.md) | Open questions and the log of every test run |
| [docs/06-which-tool-when.md](docs/06-which-tool-when.md) | pstack vs Pocock, decided |
| [docs/07-code-standards.md](docs/07-code-standards.md) | Standards, enforcers, CI |
| [orchestrator/](orchestrator) | The script that runs the loop: one ticket per run, retries, verdict, launchd installer, tests |
| [template/](template) | Starting point for a new app: TypeScript strict, six gates, CI workflow, agent rules |
| [examples/tiny-notes-ts/](examples/tiny-notes-ts) | The same app rebuilt in strict TypeScript on the template by one pstack run, with its verdict |
| [examples/tiny-notes/](examples/tiny-notes) | The app the loop was tested on, with its tickets, verify skill, generated spec and the two non-author verdicts |
| [reports/](reports) | Full research report with sources |
| [research_notes/](research_notes) | Raw research notes |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | CI for this repo: template gates, example gates, browser verification |

## The loop

1. **Idea** → an issue.
2. **Sharpen** (only if the idea is vague) → Pocock interview → spec → tickets. You answer the questions.
3. **Build** → `claude -p "/pstack:poteto-mode …"` on one ticket.
4. **Gate** → `npm run gates` on GitHub Actions. A script decides, not an AI.
5. **Verdict** → a different agent drives the running app with the verify skill and posts PASS / PASS+NOTES / FAIL.
6. **Merge** → you read the verdict and merge.

## Standards, enforced by gates

TypeScript strict · no `any` · no comments · no unused code · no duplication · tests pass. Each gate was proven to fail on a seeded bad change. Details in [docs/07-code-standards.md](docs/07-code-standards.md).

## Proven so far

- Both plugins install and run headless on a personal Max login.
- Pocock's interview → spec → tickets chain.
- pstack's Feature, Bug fix and Refactoring playbooks.
- An agent driving a real browser with zero dependencies.
- A non-author verdict that found two crashes the author missed, then a fix and a clean re-verdict.
- Template gates: six out of six fail on the bad change they exist to catch.
- An agent building under those gates: strict types, no `any`, no comments, and a complexity gate that forced a real restructure instead of a config edit.
- The orchestrator: seven pipeline tests with a fake agent, and one real ticket taken from queue to PASS verdict with no hand steps (5 min 20 s builder, 2 min verifier, ≈ $3.80 equivalent).

## Not yet

- A real app with a database, auth and dependencies.
- Anything unattended: the orchestrator on a schedule, preview, deploy.
- The orchestrator's retry path on a real agent (first real ticket passed first time).
- Quota cost per ticket against the weekly limit.
- A sandboxed agent user and automatic process cleanup.
- Sensors that catch bugs in production.
- Branch protection on app repos (a GitHub setting, not code).

## Things learned the hard way

- Headless runs need `--add-dir` for the plugin cache or pstack cannot read its own playbooks.
- Agents cannot write into `.claude/` headless. Keep helper scripts in normal repo paths; install skill text yourself.
- The Claude CLI and the GitHub CLI each have their own login. Check both point at the personal account before scheduling anything.
- An author agent's "nothing outstanding" was wrong once. The verdict gate is not optional.
- A raw line-count gate gets gamed by deleting blank lines. Use a formatter.
- pstack advises standards; it enforces none. Scripts do.
- A new repo needs `claude plugin install … --scope project` run inside it; copying settings is not enough.
