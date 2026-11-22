# The cycle

Lauren Tan's pstack is the engine and the quality bar. Matt Pocock's skills are the front door (interview, tickets) and the periodic architecture survey. Deterministic checks, run by GitHub Actions, are the real merge gate.

Which tool when is not a per-task judgment: see [06-which-tool-when.md](06-which-tool-when.md). Standards and their enforcers: [07-code-standards.md](07-code-standards.md).

## Organizing rules (from pstack)

1. No unattended loop before the verification skill exists and the task has been done once by hand.
2. One owner per change. Parallel agents only for independent work (audits, competing experiments).
3. Author and judge are always different agents.
4. Deploys always pause for the human.
5. Repeated mistakes become architecture, types or lint — not more prompt text.

## Phases

| # | Phase | What runs | Gate | You | Billed to |
|---|---|---|---|---|---|
| 0 | Bootstrap (once per app) | `/setup-matt-pocock-skills`, `/pstack:setup-pstack` (small/medium), copy `template/` (TypeScript strict, gates, CI), `/create-verification-skill`, branch rules | Gates must fail on a seeded bad change | Do it interactively | Subscription |
| 1 | Idea intake | GitHub mobile: new issue labelled `needs-triage`. Or Remote Control into a Mac session | — | Type the idea | Free |
| 2 | Sharpen | `/grill-with-docs` (or `/grill-me` for new app) → optional `/prototype` → `/to-spec` → `/to-tickets`, all in one context | LLM interview | Answer one round; approve done-checks | Subscription |
| 3 | Queue | Tickets as issues with blockers, labelled `ready-for-agent` or `ready-for-human` | Label state | Relabel from phone | Free |
| 4 | Build | Poller picks one unblocked ticket → worktree → `claude -p "/pstack:poteto-mode …"` (Feature or Bug fix playbook) | Self-verified with `verify-<app>` | — | Subscription |
| 5 | Clean | Deslop pass (`/simplify` or pstack fallback wording), `/no-comments` (comment-sicko subagent), `/unslop` on PR body | Fresh context for comments | — | Subscription |
| 6 | **Deterministic gates** | Typecheck, lint/format, knip (unused), jscpd (duplication), tests, build, dep audit. Required GitHub Actions check (and optional pre-push hook) | **Authoritative** | — | Free |
| 7 | Preview | Per-PR compose project at `pr-123-app.example.com` behind Cloudflare Access | Health check | Open on phone if curious | Free |
| 8 | **Independent verdict** | Fresh agent, different model from author, drives preview with `verify-<app>`; posts `PASS` / `PASS+NOTES` / `FAIL` + screenshots | **LLM, non-author** | — | Subscription (verdict), API (cheap diff review) |
| 9 | **Merge + deploy** | You merge. Push to `main` → compose deploy → smoke test → auto-rollback to previous image tag | **Human**, then deterministic | Read evidence, press merge | Free |
| 10 | Maintain | Daily `/maintain-verification-skill`; twice-weekly `/improve-codebase-architecture`; `/retro` or `/correct` after batches; Refactoring playbook for picked candidates | Mixed | Pick refactors; approve new lints | Subscription; triage on API |

## Where you stay in the loop

Two touchpoints, both phone-sized:

- **Sharpen** — answer one numbered round of questions (each comes with a recommended answer).
- **Merge** — read a ≤40-line PR (`Why / What changed / Scope / Tradeoffs / Blast Radius / Verification`) plus screenshots. Merge = deploy approval.

Also always human: lint exceptions, skill edits, any PR touching gate config or workflow files, refactor candidate choice, anything irreversible (data deletion, force-push).

Removing these two touchpoints is what Pocock calls a "slop cannon".

## Ticket format (pstack prompt contract inside a Pocock ticket)

```markdown
## Goal
<one sentence: what the user can do after this>

## Done-check (must be able to pass or fail)
<observable behaviour on the running app>

## Proof wanted
<screenshot of X / output of Y / test Z green>

## Known
<facts, links, prior decisions — no file paths, no code snippets>

## Constraints
<real ones only>
```

Leave out the *how* and any theory of the cause. Each ticket is a vertical slice through every layer, small enough for one fresh context window.

Small change? Skip spec. Write the issue straight in this format and label `ready-for-agent`.

## Per-task playbooks (what the build agent actually does)

**Feature** — trace subsystem → `/architect` two shapes in types/signatures → throughput checkpoint → delegate to one subagent → verify on real surface → small ordered commits → `/interrogate` if design contested → PR.

**Bug fix** — reproduce on real surface → eliminate hypotheses with runtime evidence → smallest fix → original repro passes → failing-repro commit lands before fix commit. No guards that "might help".

**Refactor** — pin behaviour with characterization test → delete dead code and one-caller wrappers → then new shape → no shims, no parallel old/new paths → if diff does not lower reader load, revert.

## Where the two methods disagree, and who wins

pstack wins everywhere code is touched. The full, decisive split is in [06-which-tool-when.md](06-which-tool-when.md).

| Topic | pstack | Pocock | This design |
|---|---|---|---|
| Spec/plan | "The best spec is code" | Spec → tickets | Keep tickets (need a durable phone-visible queue), written as pstack contracts |
| TDD | Only when cheap; prefer running real app | Red-green every build | pstack |
| Review | Only findings a rerun proves | Smell heuristics, 2 reviewers | pstack verdict gates; Pocock review advisory |

## Name collisions

Pocock's `tdd`, `code-review`, `prototype`, `research` collide with pstack and Claude Code built-ins. Always namespace in unattended prompts: `/mattpocock-skills:code-review`, `/pstack:poteto-mode`.
