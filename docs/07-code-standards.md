# Code standards and who enforces them

Short version: **pstack brings the method, not the enforcement.** It ships no hooks, no lint rules and no TypeScript configuration. It has principles the agent reads and cleanup passes the agent runs. Anything that must always hold is enforced by a script in CI, so it holds even when an agent forgets.

## What pstack does by itself

| Practice | Mechanism | Strength |
|---|---|---|
| Simple code, no speculative guards, redesign instead of bolt-on | 24 one-principle skills the agent reads during a playbook | Advisory |
| No comments | `/no-comments` pass with the `comment-sicko` subagent | Advisory; runs when the playbook reaches it |
| Evidence before theory for bugs | Bug fix playbook step order | Advisory |
| Pin behaviour before refactoring, subtract first | Refactoring playbook step order | Advisory |
| Prove it on the running app | `verify-<app>` skill | Advisory unless CI also runs it |
| Judge is not the author | Shipping playbook | Advisory unless the orchestrator enforces it |
| Turn repeated mistakes into checks | `/correct` | Produces enforcement, when run |

It says nothing specific about TypeScript strictness. "Enforce with types" is a principle; the compiler flags are yours to set.

Observed in the test runs: agents followed the playbook order and wrote small diffs with no comments in app code. One fix still shipped a line its own author called unnecessary, one author reported "nothing outstanding" with a crash still present, and helper scripts were written with comments. Advisory means advisory.

## The enforcement table

Every rule has one enforcer. If a rule has none, it is a wish.

| Rule | Enforcer | Where | Proven to fail on a bad change |
|---|---|---|---|
| Strict types, no implicit any, unchecked index access, unused locals | `tsc --noEmit` with `template/tsconfig.json` | Gates, CI | Yes |
| No explicit `any`, no non-null `!`, bounded complexity, formatting | Biome, `template/biome.json` | Gates, CI | Yes |
| No comments (links, tool directives, SPDX header excepted) | `template/scripts/no-comments.sh` | Gates, CI | Yes |
| No unused files, exports, dependencies | knip | Gates, CI | Yes |
| No copy-pasted blocks | jscpd | Gates, CI | Yes |
| Tests pass | `node --test` | Gates, CI | Yes |
| Feature works for a user | `verify-<app>` drive script | CI (example app); orchestrator | Yes, on the example app |
| Change judged by a non-author | Orchestrator runs a fresh Opus process | `orchestrator/` | Yes, with a fake agent; one real verdict |
| Agent cannot weaken a gate, locally | Orchestrator blocks any change to gate files, `.github/`, `.claude/`, `CLAUDE.md` or `package.json` scripts | `orchestrator/` | Yes, with a fake agent |
| Agent cannot weaken a gate, on GitHub | Branch protection + required check; agent token without workflow permission; PRs touching gate files go to a human | GitHub settings (yours to set) | Not yet |
| pstack for code, Pocock for five named uses | Orchestrator prompts; `CLAUDE.md` | See [06-which-tool-when.md](06-which-tool-when.md) | Held in one build with both plugins enabled |

## CI

GitHub Actions, GitHub-hosted runners. Deterministic gates only: no AI in CI, so it costs no quota and cannot be argued with.

- This repo: `.github/workflows/ci.yml` runs the template's gates and the example app's gates plus its browser verification on every push and pull request.
- Each app repo: `template/.github/workflows/ci.yml`, one job, `npm run gates`. Add the verify step once the app has its skill.

The AI steps (build, verdict) stay on the Mac mini under the orchestrator, on the subscription.

Still yours to do in GitHub settings for each app repo: protect the default branch, require the `gates` check, disallow direct pushes.

## Adding a rule

1. See the same mistake twice.
2. Write the check. Prove it fails on that mistake.
3. Add it to `scripts/gates.sh` and a row to the table above.
4. Only then mention it in `CLAUDE.md`, in one line.

## Known gaps

- `examples/tiny-notes` is plain JavaScript, written before the template existed, with its own simpler gates. `examples/tiny-notes-ts` is the same app rebuilt on the template by one headless pstack run (2026-11-23): all six gates green, verdict PASS. One small app is the whole evidence so far.
- Type assertions (`as X`) have no gate. Three appeared in that build; the verifier judged each sound.
- The no-comments gate does not see files that contain only types.
- A raw line budget was gamed once by deleting blank lines; the template uses a formatter instead, which removes that trick.
