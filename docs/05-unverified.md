# Open questions and test log

First a table of what the research could not confirm, then a dated log of every test run since. In the log, `sandbox/tiny-notes` is the local working copy with full branch history; its final state is published as [examples/tiny-notes](../examples/tiny-notes), with the two verdict files under `docs/verdicts/`.

Research read sources; it ran nothing. Each row is a place to test first.

| # | Claim or assumption | Status | How to settle |
|---|---|---|---|
| 1 | pstack "as described" | Exists, read from source at `cursor/plugins/pstack` v0.15.46. Not under Lauren Tan's own account. No personal blog series found | — |
| 2 | pstack runs well in Claude Code | Harness doc read, never executed. Doc says `Skill` tool refuses most pstack skills. Cross-vendor review panels lost. `/pstack:poteto-mode` inside `claude -p` untested | Stage 1: run it by hand. Stage 3: one headless run |
| 3 | `/deslop` on Claude Code | Ships in `cursor-team-kit`; no Claude Code build confirmed | Use `/simplify` or the guide's fallback wording |
| 4 | Lauren Tan's X articles and talk | Read only via mirrors and summaries; quotes from them are secondhand | Read originals if you care |
| 5 | Her PR-count figures, current employer | Inconsistent across sources; left out of reasoning | Ignore |
| 6 | Pocock install commands | Quoted from repo, not run. Many old skill names are gone (`to-prd` → `to-spec`, `to-issues` → `to-tickets`) | Run install; check `/help` |
| 7 | Max plan throughput | No published limits; no measurement of quota per issue-to-PR run | Measure in stage 1 with `/usage` |
| 8 | Subscription-funded headless runs | Permitted now; metering change paused "for now". `--bare` slated to become `-p` default | Keep auth a one-line switch; recheck monthly |
| 9 | Bundled $100 API credits | Two official pages disagree on whether `claude -p` is covered | Claim, run one `--bare` job, check Console balance |
| 10 | Headless auth on macOS | July 2026 OAuth-refresh failure report seen only via mirror. `srt` under launchd for a non-GUI user unverified | Stage 3 test; monthly health check |
| 11 | GitHub controls | Branch protection on free private repos, fine-grained token scopes, required checks not checked against GitHub docs | Read GitHub docs when doing stage 2 |
| 12 | Infra specifics | Per-PR previews via wildcard tunnel + compose, Access on wildcards, SSL depth, knip/jscpd/Biome/lefthook capabilities rest on snippets or inference. Backups and secrets not researched | Prototype in stage 2 |

## Install test — 2026-11-21

Done, Claude Code 2.1.212:

- `claude plugin marketplace add cursor/plugins` → marketplace `cursor-plugins` added (user settings).
- `claude plugin install pstack@cursor-plugins --scope project` → v0.15.46, enabled. 58 `SKILL.md` files, 2 agents, Claude Code harness doc present. No `deslop` skill inside (row 3 confirmed).
- `claude plugin install mattpocock-skills@claude-plugins-official --scope project` → v1.3.1 (research saw 1.3.2 upstream), enabled. Row 6 install command confirmed.
- Both are **project scope**: active only in this folder (`.claude/settings.json`). Reinstall per app repo, or switch to `--scope user` to have them everywhere.

Not done — rows 2 and 10 still open:

- Headless run `claude -p "/pstack:poteto-mode …"` failed before any model call: `Failed to authenticate: OAuth session expired and could not be refreshed`. `claude auth status --text` reports the CLI login as expired.
- That expired CLI login belongs to a **work organization**, not a personal account. Before any headless run, log in with the personal Max account (`claude auth login`), or headless jobs will bill the wrong account.
- `--max-turns` and `--permission-prompts` do not appear in `claude --help` on 2.1.212. `--bare`, `--max-budget-usd`, `--permission-mode`, `--output-format`, `--model`, `--effort` do. Treat the first two as unconfirmed in the poller sketch.

## Headless test — 2026-11-21, after logging the CLI in with the personal Max account

Read-only routing test: `claude -p "/pstack:poteto-mode …route 'add a dark mode toggle'…" --model sonnet --output-format json`.

| Run | Result |
|---|---|
| Plain | Skill loaded and picked the Feature playbook, but two `Read` calls were denied: the harness doc and `playbooks/feature.md` sit in `~/.claude/plugins/cache/…`, outside the working directory. Steps could not be listed |
| With `--add-dir "$HOME/.claude/plugins/cache/cursor-plugins/pstack"` | Clean. Adapter doc, `feature.md`, architect skill and opening-a-pr playbook all loaded; all 8 Feature steps returned; no denials; 6 turns, 23 s |

What this settles and what it does not:

- Row 2, partly: `/pstack:poteto-mode` **does** resolve and route inside `claude -p` on a subscription login, provided the plugin cache folder is readable. A real build (subagent delegation, verification, commits) is still untested.
- Row 10, partly: headless auth works right after a fresh login. Long-run refresh under launchd is still untested.
- Overhead: the trivial run reported about 290k input tokens (mostly cache reads) and an API-equivalent cost of $0.40; the first run wrote ~98k tokens to cache in 3 turns. Globally installed plugins and hooks (superpowers, caveman, etc.) load into every headless run. A dedicated agent user with only pstack and Pocock installed should start much lighter — worth measuring before stage 3.

## Real build test — 2026-11-21, `sandbox/tiny-notes`

Throwaway repo: zero-dependency Node notes app, 3 tests, `scripts/gates.sh` (syntax, no-comments, size budget, tests). Ticket `tickets/001-dark-mode.md` written as a pstack contract. One headless run:

```bash
claude -p "/pstack:poteto-mode Implement the ticket in tickets/001-dark-mode.md. …" \
  --model sonnet --permission-mode acceptEdits \
  --allowedTools "Bash(node *)" "Bash(npm *)" "Bash(git *)" "Bash(curl *)" … \
  --add-dir "$HOME/.claude/plugins/cache/cursor-plugins/pstack" --output-format json
```

| Check | Result |
|---|---|
| Run | Exit 0, 15 turns, 50 s, API-equivalent $1.79 (1.17M cache-read tokens) |
| Output | One commit on `agent/001-dark-mode`, one file, +29/−1. No comments added, no new files, gate files untouched, nothing pushed |
| Gates, rerun by me | Green, 162/220 lines |
| Done-check, driven by me in a browser | Pass. No stored choice → follows OS (dark). Toggle → light, survives reload. Toggle → dark, survives reload |
| Agent's own verification | Weaker than the ticket asked: source inspection plus curl of the served page. It said so plainly under "Not verified" |
| Permission denials | 4: three compound "start server & curl & kill" commands and one `git commit` using a heredoc. Allow-patterns match simple commands only |

What this settles:

- Row 2: a real pstack Feature run works headless on the subscription, and the diff came out small and clean.
- The run's self-report was honest about what it had not checked.

What it shows is still missing:

- **No browser in the headless run**, so the agent could not run the done-check itself. This is exactly the gap pstack's `verify-<app>` skill is meant to close; build that before trusting unattended runs.
- **Allow-list friction.** Compound shell commands get denied. Either give the agent a `scripts/serve-check.sh` style helper it can call as one allowed command, or use auto mode inside a sandbox.
- No sign of subagent delegation or the cleanup passes in a 15-turn run; for a change this small pstack's ladder says most machinery is skipped. Not yet tested on a change big enough to trigger them.
- One minor product nit left in the diff: the theme is applied by a module script, so a stored dark choice can flash light for a frame on load.

## Front end and remaining playbooks — 2026-11-21, `sandbox/tiny-notes`

All headless (`claude -p`, Sonnet, `acceptEdits`, narrow Bash allow-list, `--add-dir` for the plugin cache).

### Pocock front end (worktree `sandbox/tiny-notes-front`, branch `front/tags`, uncommitted)

Six calls: `/setup-matt-pocock-skills`, then one session carried with `--resume <session_id>`: `/grill-with-docs <idea>` → answers → `/to-spec` → `/to-tickets` → approval.

| Step | Result |
|---|---|
| Setup | Wrote `CLAUDE.md`, `docs/agents/issue-tracker.md` (local markdown under `.scratch/`), `docs/agents/domain.md`. Preset answers in the prompt were enough |
| Grill | Explored the code, asked 8 questions with recommended answers, then waited |
| Answers | "Accept every recommendation" → `GLOSSARY.md` (3 terms) + one ADR |
| Spec | Asked a seam question first; the next command skipped it and the 52-line spec was published anyway |
| Tickets | Proposed 5 vertical slices with blockers, waited for approval, then published `.scratch/tags/issues/01`–`05`, all `ready-for-agent` |
| Cost | ~5 min wall time, API-equivalent $3.15, zero permission denials |

Settles: the Pocock chain works headless and resumable, and the local-markdown tracker works with no GitHub remote. Caveat: I stood in for the human and accepted every default; the interview is where a real owner adds value. It also needs at least three human turns (answers, seam, ticket approval), not one.

### pstack Bug fix (`agent/002-server-dies`, merged to sandbox `main`)

Bug was real: a malformed JSON POST killed the server process (reproduced by me before the run).

| Check | Result |
|---|---|
| Run | 2 commits in playbook order: failing repro, then an 8-line fix. No denials reported as blocking |
| Gates, rerun by me | Green, 4 tests |
| Done-check, on a running server by me | Pass: bad POST → 400, next GET → 200 |
| Independent probe | **A JSON body of `null` still crashes the server.** The agent reported "nothing outstanding" |

Lesson: the fix guarded one call site instead of the cause (an async handler with no error boundary). The author's own check passed; a non-author check found the sibling crash in one extra request. This is the strongest evidence so far for the non-author verdict gate.

### pstack Refactoring (`agent/003-routing-refactor`, **not merged**)

| Check | Result |
|---|---|
| Run | 31 turns, 174 s, API-equivalent $1.19, no denials. 2 commits in playbook order: pin tests first, then the restructure |
| Shape | If-chain → 4-row route table plus named handlers. `server.js` 60 lines before and after |
| Gates, rerun by me | Green, 6 tests, 169/220 lines |
| Behaviour, by me | 13-request probe against `main` and the branch: byte-identical output |
| Side effect | Agent removed blank lines between functions to stay inside the line budget, and said so |

Lesson: a raw line-count gate invites cosmetic squeezing. Count with a formatter applied, or budget by statements/exports instead.

### Scoreboard

| Piece | Status |
|---|---|
| Plugins install, load headless | Proven |
| Pocock setup → grill → spec → tickets | Proven headless, human answers simulated |
| pstack Feature, Bug fix, Refactoring playbooks | Each proven once on a 170-line app |
| Agents self-verifying in a browser | Not possible yet; needs `verify-<app>` |
| `/interrogate`, `/no-comments`, `/correct`, subagent delegation, cleanup passes | Not exercised |
| Poller, sandbox user, CI, preview, non-author verdict agent, deploy | Not built |
| Quota cost | Five runs today ≈ $8.5 API-equivalent; share of weekly Max limit not measured |

## Verification skill and non-author verdict — 2026-11-21, `sandbox/tiny-notes`

### `/pstack:create-verification-skill` (branch `agent/004-verify-skill`, merged to sandbox `main`)

| Attempt | Result |
|---|---|
| 1 | Stopped, wrote nothing: `Write` under `.claude/skills/` denied even with `--permission-mode acceptEdits` |
| 2, resumed with `--allowedTools "Write(.claude/skills/**)" "Edit(.claude/skills/**)"` | Still denied. Agent stopped and reported it both times instead of working around the guard |
| 3, resumed with a new layout | Done in 32 turns, 229 s. Helpers in `tools/verify/` (4 files, 503 lines, zero dependencies: raw DevTools protocol over Node 22's global `WebSocket`, headless Chrome). Skill text and 5-feature map staged in `tools/verify/skill/` |

Checked by me: `node tools/verify/drive.mjs all` → 3/3 features pass, 9 evidence files in `.verify-evidence/`, screenshot shows the real page with a note added, no Chrome left running. I read the skill text and copied it into `.claude/skills/verify-tiny-notes/`.

Rule for the runbook: **agents cannot write into `.claude/` headless.** Keep helper scripts in normal repo paths; a human installs or updates the skill text. That matches pstack's own rule that skill edits stay with the human. It also means pstack's daily `/maintain-verification-skill` cannot run fully unattended as designed — it can propose changes to a staging folder at most.

### Non-author verdict (fresh process, Opus; author was Sonnet) on `agent/003-routing-refactor`

| Check | Result |
|---|---|
| Run | 26 turns, 242 s, API-equivalent $2.19, 2 harmless denials |
| Used the skill | Yes: `drive.mjs all`, 3/3 pass on the branch |
| Break attempts | Ran branch and `main` servers side by side, 25 edge cases beyond the author's tests: 0 differences |
| Verdict | `PASS+NOTES`, written to `.verify-evidence/verdict-003.md` |
| Findings | Two server crashes, both proven by rerun and both shown to exist on `main` too: `POST /api/notes` with body `null` (the one I found by hand earlier), and `GET //` (new to me) |
| Obeyed limits | No tracked file edited, committed or reverted |

This is the strongest result of the day: the non-author gate independently found the crash the bug-fix author missed, found a second one nobody had, and correctly separated "pre-existing" from "introduced by this branch" so the refactor was not blocked for bugs it did not cause.

### New problems seen

- **Orphan processes.** Two `node server.js` processes were left running by agent runs (one from the skill build, one from the verdict agent's scratch copy of `main`). I identified them by working directory and start time before stopping them. Unattended runs need a wrapper that records and reaps child processes.
- Allow-list friction again: compound `echo …; cat … | wc -l` commands denied.

### Scoreboard update

| Piece | Status |
|---|---|
| Agents driving a real browser headless | Proven, zero dependencies |
| Non-author verdict gate | Proven once, and it earned its place |
| Open bugs in sandbox | `null` body crash, `GET //` crash, theme flash on load — good material for the next tickets |
| Still not exercised | `/interrogate`, `/no-comments`, `/correct`, subagent delegation, the 5 tags tickets |
| Still not built (as of 2026-11-21; the poller now exists, see the orchestrator entry) | Poller, sandbox user, CI runner, preview, deploy, process reaping |
| Today's total | Nine headless runs ≈ $13 API-equivalent; share of weekly Max limit still unmeasured |

## Full loop: verdict finding → ticket → fix → re-verdict — 2026-11-21

Ticket `tickets/005-single-request-crashes.md` was written from the two crashes the first verdict found, symptoms only, with a broad goal ("no single request can stop the server").

| Step | Result |
|---|---|
| pstack Bug fix (Sonnet) | 53 turns, 330 s, API-equivalent $2.11. Two commits in order: failing repros, then the fix. Fixed the cause this time: one try/catch around the whole request handler. Extended `tools/verify/drive.mjs` so the resilience feature covers both requests. Left no processes behind |
| My check | Gates green (173/220). On a running server: `GET //`, `POST null`, `POST [1]`, malformed JSON all → 400; next GET → 200 |
| Non-author re-verdict (Opus) | 27 turns, 311 s, API-equivalent $2.01. `PASS+NOTES`, written to `.verify-evidence/verdict-005.md`. Reproduced both crashes on a scratch copy of `main`, confirmed fixed on the branch, then sent 50+ further requests including raw malformed HTTP: none crashed or hung the server. No tracked file touched, no process left |

Notes worth keeping:

- The agent wrote the fix first, stashed it, then wrote the failing tests. The commit order satisfies the playbook; the working order did not. It reported this itself.
- The verifier judged `body ?? {}` (which the author called "belt, not required") worth keeping because it yields a more precise error message. A reasonable call, and it shows the keep/remove decision needs a judge, not a rule.
- One residual the verifier proved: if `index.html` is unreadable, `GET /` leaves that one client hanging (headers already sent). Not reachable by any request; `main` crashes outright in the same situation.
- Not flagged by either agent, noticed by me: unexpected server-side failures now answer 400 rather than 500.

What the day shows end to end: ticket → build → gates → verify skill → non-author verdict → new ticket from the verdict's findings → fix → re-verdict. Every stage ran headless on the subscription. Still simulated by me: the human merge decision, the queue/poller, and process cleanup on the first few runs.

Branch state: `agent/005-single-request-crashes` and `agent/003-routing-refactor` both carry a `PASS+NOTES` verdict and are unmerged. They conflict in `server.js`.

Day total: eleven headless runs ≈ $17 API-equivalent. Share of the weekly Max limit still unmeasured.

## First build on the TypeScript template — 2026-11-23, `examples/tiny-notes-ts`

Ticket: rebuild Tiny Notes in strict TypeScript on `template/`, behaviour identical to the JavaScript app, gate configuration off limits.

| Step | Result |
|---|---|
| First attempt | `Unknown command: /pstack:poteto-mode`, zero turns. A copied `.claude/settings.json` does not activate plugins in a new repo; `claude plugin install … --scope project` must be run inside it |
| Build (Sonnet) | 64 turns, 384 s, API-equivalent $2.83. One commit: `src/store.ts`, `src/server.ts`, `src/main.ts`, 6 tests. No gate or CI file touched, no process left |
| Gate failures on the way, as the agent reported | Import order and formatting (auto-fixed). Complexity gate rejected the request handler twice (32, then 21, limit 15); the agent split it into `serveIndex`, `createNote` and `route` and said the gate was right |
| My check | Six gates green. Verify drive 3/3. Sixteen responses identical to the JavaScript app, including `GET //` and a `null` body |
| Standards | No `any`, no comments, JSON body typed `unknown` and narrowed, every function typed. Three `as` assertions in `src/` |
| Non-author verdict (Opus) | 25 turns, 172 s, API-equivalent $1.81. `PASS`. 28 further requests against both apps, 0 differences. Judged each `as` and `unknown` sound, with a run behind each. Cleaned up one stray process left by its own comparison harness |

Settles: an agent builds to the TypeScript standards when the gates require them, and resolves a gate failure by changing code, not configuration. Does not settle: anything beyond a 100-line server.

New gap: nothing limits `as` assertions.

Running total: fourteen headless runs ≈ $21 API-equivalent. Share of the weekly Max limit still unmeasured.

## Orchestrator — 2026-11-23, `orchestrator/`

A Node script, no dependencies. One ticket per run: builder → branch checks → gates → browser verify → non-author verdict, up to three attempts, then `review` or `blocked`.

| Step | Result |
|---|---|
| Pipeline tests, fake agent, throwaway git repo | 7 of 7. Pass; gate failure resumed in the same session with the output; three FAIL verdicts then blocked; gate file touched; `package.json` scripts edited; dirty tree; verifier that edits; agent error; missing verdict line; daily cap; held and stale lock |
| Real ticket 002 (280-character limit with live counter), `sandbox/tiny-notes-ts`, one command, no hand steps | `review`, verdict `PASS`, first attempt. 7 min 20 s wall |
| Builder (Sonnet) | 5 min 18 s wall, API-equivalent $2.49. One commit: server check, page counter, 2 tests, a new `length-limit` flow in the verify drive |
| Verifier (Opus), no edit permission | 1 min 54 s, API-equivalent $1.31. Ran gates and drive, then five requests the author had not made (trailing spaces, emoji at the boundary, whitespace only). All correct |
| After the run | Repo back on `main`, clean. Ticket moved to `tickets/done/` and verdict saved on the branch. No process left |
| My check | Gates and the 4-flow drive rerun by hand on the branch: green |

Settles: the loop runs from a queued ticket to a mergeable branch without a human in between. Does not settle: the retry path with a real agent (only the fake one has failed so far), scheduled running, a second ticket in a row, quota share.

The builder's own `num_turns` and `duration_ms` (8 turns, 46 s) did not match the wall time; `runs.jsonl` now records wall time as well.

Running total: sixteen headless runs ≈ $25 API-equivalent.

## Orchestrator retry path with a real agent — 2026-11-23

Ticket 003 (health endpoint), same sandbox. The failure was forced: the orchestrator ran with an extra gate the builder was not told about (`CHANGELOG.md` must have a line for the ticket), so the builder's own gates passed and the orchestrator's did not.

| Step | Result |
|---|---|
| Attempt 1, builder (Sonnet) | 1 min 44 s, $1.03. Endpoint, test, drive check, one commit. Branch checks ok |
| Orchestrator gates | Failed on the changelog rule. Output sent to the same session with `--resume` |
| Attempt 2, same session | 1 min 14 s, $1.04. Added `CHANGELOG.md` with the entry, second commit. Checks, gates, browser verify ok |
| Verifier (Opus) | 1 min 7 s, $1.17. `PASS` |
| End state | `review` after 2 attempts, 4 min 15 s wall. Repo back on `main`, clean, no process left |

Settles: a resumed real session understands the orchestrator's finding and fixes it. Does not settle: a retry caused by a verifier FAIL on a real agent, or a failure the agent cannot fix (the three-attempt stop has only run against the fake agent).

Running total: nineteen headless runs ≈ $28 API-equivalent.

Merge of both branches, 2026-11-23, by hand: code merged without conflict. One conflict in ticket files: git read the `tickets/ready` → `tickets/done` move on one branch as a folder rename and tried to move the other, still-open ticket with it. Merged result: six gates green, 10 tests, drive 4 of 4. Exported to `examples/tiny-notes-ts`.

Fixed the same day: the orchestrator no longer moves ticket files. It commits only the verdict file on the branch, and a ticket counts as done when its verdict file is on the base branch. A new pipeline test reproduces the conflict on the old code and passes on the new (8 tests). Tickets 002 and 003 in the example sit in `tickets/done/` because they ran before this change.

Also untested: the GitHub-issues poller sketch and gate script in [03-setup-runbook.md](03-setup-runbook.md). The CLI flags in them (`--permission-mode auto`, `--permission-prompts none`, `--max-turns`, `--bare`, `--max-budget-usd`) come from the docs as reported by researchers; confirm against `claude --help` on your install.

The reconciliation of pstack with Pocock's skills is this project's own judgment. Neither author mentions the other.
