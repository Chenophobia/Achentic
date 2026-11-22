# pstack or Pocock: the rule

**pstack is the engine. If the task touches code, it is pstack. Pocock is used at exactly five points, each typed by name.**

No judgment call per task. If a situation is not in the Pocock table below, it is pstack.

## Pocock: five uses, nothing else

| # | When | Command | Output | Who starts it |
|---|---|---|---|---|
| 1 | Once per new repo | `/mattpocock-skills:setup-matt-pocock-skills` | Tracker config, `CLAUDE.md` block | You |
| 2 | An idea is too vague to write as one ticket | `/mattpocock-skills:grill-with-docs` → `/mattpocock-skills:to-spec` → `/mattpocock-skills:to-tickets`, one session | Glossary, ADRs, spec, tickets with blockers | You (you answer the questions) |
| 3 | A raw issue arrives (yours or from a sensor) | `/mattpocock-skills:triage` | Label: `ready-for-agent`, `ready-for-human`, `needs-info`, `wontfix` | Orchestrator |
| 4 | Twice a week | `/mattpocock-skills:improve-codebase-architecture` | A report of refactor candidates. Never edits | Orchestrator |
| 5 | Once per machine | `git-guardrails-claude-code` hook | Blocks `git push`, `reset --hard`, `clean -f`, `branch -D` in interactive sessions | You |

## pstack: everything else

| Situation | pstack | Not this |
|---|---|---|
| Build a ticket | `/pstack:poteto-mode` → Feature playbook | ~~`mattpocock-skills:implement`, `implement-spec`~~ |
| Fix a bug | `/pstack:poteto-mode` → Bug fix playbook | ~~`mattpocock-skills:diagnosing-bugs`~~ |
| Refactor | `/pstack:poteto-mode` → Refactoring playbook | — |
| Tests | pstack's rule: a failing test first when cheap, otherwise prove on the running app | ~~`mattpocock-skills:tdd`~~ |
| Review a change | Non-author live verdict; `/interrogate` when the design is contested | ~~`mattpocock-skills:code-review`~~ |
| Try a design | pstack Prototype playbook, `/architect` | ~~`mattpocock-skills:prototype`~~ |
| Look something up | pstack Investigation playbook, `/how`, `/why` | ~~`mattpocock-skills:research`~~ |
| Clean a diff | `/simplify`, `/no-comments`, `/unslop` | — |
| Prove it works | `/create-verification-skill` once, then `verify-<app>` every time | — |
| A mistake keeps repeating | `/correct` → new type, lint or CI check | ~~`mattpocock-skills:retro`~~ (same idea; one tool is enough) |
| Write the PR text | pstack Opening-a-PR playbook | ~~`mattpocock-skills:pr`~~ |

## Small change shortcut

If you can state the goal and a pass/fail check in two sentences, skip Pocock entirely: write the ticket by hand from `tickets/TEMPLATE.md` and give it to pstack. Pocock's interview is for ideas that need questions answered, not for every change.

## Why this split

- You chose pstack as the main engine.
- Where both have a tool for the same job, they disagree on method (test-first always vs when cheap; smell-list review vs proven-by-run review). Mixing them gives inconsistent code. One engine, one method.
- Pocock has what pstack deliberately lacks: an interview, a durable ticket queue, a periodic architecture survey. Those five uses are that gap and nothing more.

## How the rule is enforced

A rule in a document is the weakest kind; nothing fails when an agent ignores it. In order of strength:

1. **Orchestrator prompts name the skill.** Every unattended build or verify run starts with `/pstack:poteto-mode`. The orchestrator never issues a Pocock build command. This is the real enforcement.
2. **`CLAUDE.md` in each app repo** states the split (see `template/CLAUDE.md`).
3. **Gates and the verdict do not care which skill wrote the code.** Whatever slips through still has to pass them.

Known weak spot: several Pocock skills (`tdd`, `code-review`, `diagnosing-bugs`, `prototype`, `research`) are model-invoked, so an agent can pick one up on its own in an interactive session. Not observed in the eleven headless test runs, all of which started with `/pstack:poteto-mode`. If it shows up, the stronger fix is to enable the Pocock plugin only in the sessions that run uses 1–4; how to scope a plugin per run is not yet tested.
