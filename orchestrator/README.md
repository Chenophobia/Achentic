# Orchestrator

A plain script, not an AI. Each run takes one ticket from the queue and walks it through the loop. It spends AI quota only on the two steps that need judgment: building and judging.

```
tickets/ready/NNN-slug.md
        │
        ▼
  builder (Sonnet, pstack) ──► checks ──► gates ──► browser verify ──► verifier (Opus, fresh process)
        ▲                        │          │             │                     │
        └──── same session, finding as a bug report ◄─────┴──── FAIL ◄──────────┤
                                                                                ▼
                                                          PASS: ticket closed on the branch, you merge
```

## Use

```sh
node orchestrator/orchestrator.mjs run --repo <app-repo>
node orchestrator/orchestrator.mjs status --repo <app-repo>
node orchestrator/orchestrator.mjs retry <ticket-id> --repo <app-repo>
```

The app repo is a clone that belongs to the orchestrator. It must be on the base branch with a clean tree, built from `template/`, with both plugins installed in it.

To queue work, commit a ticket to `tickets/ready/` on the base branch. The lowest number goes first.

## What one run does

1. Takes a lock. A lock whose process is dead is cleared.
2. Skips if the tree is dirty, the repo is off the base branch, or the daily cap is reached.
3. Creates `agent/<ticket-id>` from the base branch.
4. Runs the builder: `claude -p "/pstack:poteto-mode …"` on the ticket.
5. Checks the branch: there is a commit, the tree is clean, no protected file changed.
6. Runs the gates, then `tools/verify/drive.mjs all` if the app has it.
7. Runs the verifier in a new process with a different model. It cannot edit; if the repository changed while it ran, the verdict is void.
8. On PASS or PASS+NOTES: moves the ticket to `tickets/done/`, saves the verdict to `docs/verdicts/`, commits both on the branch, marks the ticket `review`.
9. On a failed check, gate, verify or verdict: resumes the builder's session with the finding and tries again, three attempts in total.
10. Returns to the base branch, stashing anything left behind, and notifies.

It never pushes, merges or deploys.

## Blocked at once, no retry

- A change to `scripts/gates.sh`, `scripts/no-comments.sh`, `biome.json`, `tsconfig.json`, `knip.json`, `CLAUDE.md`, `.github/` or `.claude/`.
- A change to the `scripts` in `package.json`.
- A builder or verifier run that errors or times out (expired login, quota).
- A verifier that changed the repository or gave no verdict line.
- A branch for the ticket that already exists.

A blocked ticket stays out of the queue until `retry`, which keeps the old branch as `stale/<ticket-id>-<time>`.

## Settings

Environment variables, all optional.

| Variable | Default | Meaning |
|---|---|---|
| `ACHENTIC_HOME` | `~/.achentic` | State, logs and lock, one folder per app |
| `ACHENTIC_BASE` | `main` | Base branch |
| `ACHENTIC_GATES` | `sh scripts/gates.sh` | Gate command |
| `ACHENTIC_DAILY_CAP` | `3` | Tickets started per day |
| `ACHENTIC_MAX_ATTEMPTS` | `3` | Builder attempts per ticket |
| `ACHENTIC_BUILDER_MODEL` | `sonnet` | |
| `ACHENTIC_VERIFIER_MODEL` | `opus` | |
| `ACHENTIC_BUILD_MINUTES` | `30` | Builder timeout |
| `ACHENTIC_VERDICT_MINUTES` | `20` | Verifier timeout |
| `ACHENTIC_GATES_MINUTES` | `10` | Gates and verify timeout |
| `ACHENTIC_NTFY_URL` | unset | An ntfy topic URL. Unset means log only |
| `ACHENTIC_CLAUDE_BIN` | `claude` | Used by the tests to substitute a fake |

## State

In `$ACHENTIC_HOME/<app>/`:

- `state.json` — ticket status (`review` or `blocked`) and tickets started per day.
- `runs.jsonl` — one line per agent run: role, model, turns, duration, cost. This is the quota record.
- `orchestrator.log` — what happened, one line per step.
- `logs/` — raw output of every agent run.

## Schedule it on the Mac mini

```sh
sh orchestrator/install-launchd.sh <app-repo>
```

It writes a LaunchAgent that runs every 30 minutes and prints the command to start it. A LaunchAgent runs inside the logged-in session, which the Claude login needs, so the Mac mini must log that user in automatically.

Before starting it: `claude auth status` shows the personal Max account, and `node orchestrator/orchestrator.mjs run --repo <app-repo>` has completed one ticket by hand.

## Tests

```sh
node --test orchestrator/test/orchestrator.test.mjs
```

Seven tests drive the whole pipeline against a throwaway git repository with a fake agent: pass, gate failure and retry, three failed verdicts, protected file, edited scripts, dirty tree, meddling verifier, agent error, daily cap, held and stale lock.

## Not done

- It runs as your user, not a sandboxed agent user.
- Tickets come from files, not GitHub issues. It opens no pull request.
- No sensors yet: nothing turns a production error into a ticket.
- One app repo per LaunchAgent; runs for different apps are not coordinated against the weekly limit.
