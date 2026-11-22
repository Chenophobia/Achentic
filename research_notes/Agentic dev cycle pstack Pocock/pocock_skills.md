# Matt Pocock's agent skills and AI-assisted development workflow (state as of 2026-11-21)

Method note: the `mattpocock/skills` repo was downloaded on 2026-11-21 (main branch, last push 2026-11-19, plugin version 1.3.2) and the SKILL.md files were read directly. Quotes below are verbatim from those files. aihero.dev articles, Sandcastle docs, and two secondary talk/podcast summaries were fetched over the web. Anything not read first-hand is flagged.

Shorthand for links: `R/` = `https://github.com/mattpocock/skills/blob/main/`.

## 1. Full list of skills in mattpocock/skills: what each does, when to use, key instructions, install command

### Takeaway
The repo has been restructured heavily during 2026 and most of the names in the brief no longer exist: `write-a-prd`/`to-prd` is now `to-spec`, `prd-to-issues`/`to-issues`/`to-plan` are now `to-tickets`, `triage-issue` is `triage`, and `ubiquitous-language`, `design-an-interface`, `request-refactor-plan` and `qa` were deleted and absorbed. The current shipped set is 27 "promoted" skills (20 engineering, 7 productivity) in the Claude Code plugin, plus 4 frozen `misc` skills and 8 beta `in-progress` skills that are only installable one at a time through skills.sh.

### Cited Findings

**Repo facts**
- Repo description: "Skills for Real Engineers. Straight from my .agents directory." MIT licence, created 2026-02-03, last push 2026-11-19. The GitHub API reported 328,972 stars and 27,641 forks on 2026-11-21 — [GitHub API](https://api.github.com/repos/mattpocock/skills)
- Releases: v1.0.0 2026-06-17, v1.1.0 2026-07-08, v1.2.0 2026-08-05, v1.2.3 2026-08-06, v1.3.0 and v1.3.1 2026-10-04, v1.3.2 2026-10-29 — [GitHub releases API](https://api.github.com/repos/mattpocock/skills/releases)
- Buckets: `engineering/` (daily code work), `productivity/` (non-code), `misc/` ("kept around but rarely used, not promoted"), `in-progress/` ("beta: public on purpose, feedback wanted, not shipped in the plugin"), `deprecated/` (currently empty: "a retired skill is deleted") — [CLAUDE.md](https://github.com/mattpocock/skills/blob/main/CLAUDE.md), [deprecated README](https://github.com/mattpocock/skills/blob/main/skills/deprecated/README.md)
- Two invocation classes. User-invoked skills carry `disable-model-invocation: true` and are "reachable only when you type them"; "their job is to orchestrate". Model-invoked skills "hold the reusable discipline". "A user-invoked skill may invoke model-invoked skills, but never another user-invoked one." — [README](https://github.com/mattpocock/skills/blob/main/README.md), [.agents/invocation.md](https://github.com/mattpocock/skills/blob/main/.agents/invocation.md)
- The plugin manifest lists exactly 27 skills at version 1.3.2 — [.claude-plugin/plugin.json](https://github.com/mattpocock/skills/blob/main/.claude-plugin/plugin.json)

**Install commands (apply to every promoted skill)**
- Claude Code, whole set, self-updating: `claude plugin install mattpocock-skills@claude-plugins-official` — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- Any single skill as an editable copy (the only route for `misc/` and `in-progress/` skills): `npx skills@latest add mattpocock/skills --skill=<name>`; update with `npx skills@latest update <name>` — [.agents/install-block.md](https://github.com/mattpocock/skills/blob/main/.agents/install-block.md), [in-progress README](https://github.com/mattpocock/skills/blob/main/skills/in-progress/README.md)
- Then run `/setup-matt-pocock-skills` once per repo — [README](https://github.com/mattpocock/skills/blob/main/README.md)

**Engineering, user-invoked (11)**

| Skill | What it does / when | Key instruction (verbatim) | Source |
| --- | --- | --- | --- |
| `setup-matt-pocock-skills` | Precondition. Once per repo: configures issue tracker (GitHub default, GitLab, local markdown, or custom), triage label strings, and where `GLOSSARY.md`/ADRs live. Writes `docs/agents/` and an `## Agent skills` block in CLAUDE.md/AGENTS.md. | "This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/setup-matt-pocock-skills/SKILL.md) |
| `ask-matt` | Router over all user-reachable skills; holds the canonical workflow map. Use when unsure which skill fits. | "You don't remember every skill, so ask." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md) |
| `grill-with-docs` | Start of the main flow inside a repo. Interview plus glossary/ADR writing. | Entire body: "Call the Skill tool twice, for \"grilling\" and \"domain-modeling\"." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md) |
| `to-spec` | Turns the current conversation into a spec (formerly PRD) and publishes it to the tracker with the `ready-for-agent` label. | "Do NOT interview the user; just synthesize what you already know." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md) |
| `to-tickets` | Splits a spec/plan/conversation into tracer-bullet tickets with blocking edges. | "Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md) |
| `implement` | Builds one ticket or a small piece of work in the current session. | "Call the Skill tool with \"tdd\" where possible, at pre-agreed seams. Run typechecking regularly, single test files regularly, and the full test suite once at the end. Once done, call the Skill tool with \"code-review\" to review the work. Commit your work to the current branch." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement/SKILL.md) |
| `implement-spec` | Lands a whole spec in one run: parallel implementer subagents in worktrees, a merger subagent, one integration branch, one final `code-review`. | "The tickets are not a list of steps. They are a **task graph** with blocking relationships between them." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement-spec/SKILL.md) |
| `triage` | On-ramp for issues and external PRs you did not write. State machine: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `bug`/`enhancement`. Writes agent briefs. | Every tracker comment "**must** start with this disclaimer: > *This was generated by AI during triage.*" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/triage/SKILL.md) |
| `improve-codebase-architecture` | Upkeep. Scans for "deepening opportunities", writes an HTML report to the OS temp dir, then grills on the chosen candidate. Never edits code. | "Do NOT propose interfaces yet. After the file is written, ask the user: \"Which of these would you like to explore?\"" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md) |
| `wayfinder` | For work too big for one session (greenfield, huge feature). Charts a "map" issue labelled `wayfinder:map` with child "decision tickets" and resolves them one at a time. | "Wayfinder is **planning** by default... produce decisions, not deliverables." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md) |
| `retro` | After a session: proposes changes to the agent's environment (navigation pointers, automated checks, coding standards, AGENTS.md size, tool economy), most severe first. | "Default to building the check over writing the rule." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md) |

**Engineering, model-invoked (9)**

| Skill | What it does / when | Key instruction (verbatim) | Source |
| --- | --- | --- | --- |
| `tdd` | Red-green loop reference; used by `implement` and `implement-spec`, or alone for test-first work. | "**Test only at pre-agreed seams.**" and "**Refactoring is not part of the loop.** It belongs to the review stage" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) |
| `code-review` | Two-axis review of `git diff <fixed-point>...HEAD` by two parallel fresh-context subagents: Standards (repo standards plus a 12-item Fowler smell baseline) and Spec. | "Do **not** merge or rerank findings, because the two axes are deliberately separate" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md) |
| `diagnosing-bugs` | On-ramp for hard bugs and perf regressions. Six gated phases starting with building a feedback loop. | "**This is the skill.** Everything else is mechanical." (about Phase 1, the feedback loop) | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md) |
| `codebase-design` | Deep-module vocabulary (module, interface, depth, seam, adapter, leverage, locality) plus DEEPENING.md and DESIGN-IT-TWICE.md. | "Use these terms exactly: don't substitute \"component,\" \"service,\" \"API,\" or \"boundary.\"" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md) |
| `domain-modeling` | Active glossary and ADR discipline; maintains `GLOSSARY.md` and `docs/adr/`. | "When a term is resolved, update `GLOSSARY.md` right there." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md) |
| `prototype` | Throwaway code to answer one design question: a single HTML file for logic/state, or several UI variants on one route. | "A prototype is **throwaway code that answers a question**. The question decides the shape." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/prototype/SKILL.md) |
| `research` | Background agent reads primary sources and saves a cited Markdown file in the repo. | "Follow every claim back to the source that owns it." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/research/SKILL.md) |
| `pr` | PR body template: Summary (smallest visual), Evidence (before/after), Merge Danger (one-way/two-way door, blast radius). Credits Dex Horthy's `show-me`. | "Pick the smallest view that makes the key point clear." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md) |
| `wizard` | Generates an interactive bash script for steps only a human can do (credentials, dashboards, cutovers). | (README description) "walks a human through steps only they can perform" | [README](https://github.com/mattpocock/skills/blob/main/README.md) |

**Productivity (5 user-invoked, 2 model-invoked)**

| Skill | Invocation | What it does | Key instruction | Source |
| --- | --- | --- | --- | --- |
| `grill-me` | user | Stateless interview, for when there is no repo. | Entire body: "Call the Skill tool with \"grilling\"." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md) |
| `grilling` | model | The interview primitive behind `grill-me`, `grill-with-docs`, `triage`, `wayfinder`, `improve-codebase-architecture`. | "Ask the whole frontier in one round: number each question and give your recommended answer." and "Finding _facts_ is your job, never the user's." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) |
| `handoff` | user | Writes a handoff doc to the OS temp dir for another agent/harness/directory/colleague. | "Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead." | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md) |
| `teach` | user | Multi-session teaching with the current directory as stateful workspace. | n/a (not read in full) | [productivity README](https://github.com/mattpocock/skills/blob/main/skills/productivity/README.md) |
| `to-questionnaire` | user | Writes a Markdown questionnaire for the one person who can answer a blocking question. | n/a (not read in full) | [productivity README](https://github.com/mattpocock/skills/blob/main/skills/productivity/README.md) |
| `wait-what` | user | Re-pitches the agent's last message in plain English using `GLOSSARY.md` terms. | n/a | [productivity README](https://github.com/mattpocock/skills/blob/main/skills/productivity/README.md) |
| `writing-for-agents` | model | Reference for writing skills and AGENTS.md/CLAUDE.md ("context pointers", "context load" vs "cognitive load"). | "Every word of an always-loaded pointer costs on every turn" | [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md) |

**Misc (4; not in the plugin; "frozen and unmaintained. Every issue is closed.")** — [misc README](https://github.com/mattpocock/skills/blob/main/skills/misc/README.md), [SCOPE.md](https://github.com/mattpocock/skills/blob/main/SCOPE.md)
- `git-guardrails-claude-code`: installs a Claude Code `PreToolUse` hook on `Bash` that blocks `git push` (all variants), `git reset --hard`, `git clean -f/-fd`, `git branch -D`, `git checkout .`/`git restore .`. Project scope (`.claude/settings.json`) or global. "When blocked, Claude sees a message telling it that it does not have authority to access these commands." — [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/misc/git-guardrails-claude-code/SKILL.md)
- `setup-pre-commit`: Husky pre-commit with lint-staged (Prettier), then `npm run typecheck` and `npm run test` — [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/misc/setup-pre-commit/SKILL.md)
- `migrate-to-shoehorn` and `scaffold-exercises`: TypeScript-test and course-authoring helpers, not workflow skills — [misc README](https://github.com/mattpocock/skills/blob/main/skills/misc/README.md)

**In-progress (beta; not in the plugin; "can change or disappear without warning")** — [in-progress README](https://github.com/mattpocock/skills/blob/main/skills/in-progress/README.md)
- `software-factory`: vocabulary for designing an unattended agent system (task, trigger, run, runner, orchestrator, ticket tracker). See section 3.
- `setup-ts-deep-modules`: wires dependency-cruiser so each TS package's root files are the only public entry points. See section 4.
- `claude-handoff`: handoff that immediately launches `claude --bg --name "<name>" -- "$(cat <summary file>)"` — [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/claude-handoff/SKILL.md)
- `chief-of-staff`: long-running coordinator session that does all work in background subagents and keeps memory in a markdown wiki — [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/chief-of-staff/SKILL.md)
- `loop-me`, `writing-beats`, `writing-fragments`, `writing-shape`: workflow-spec grilling and article-writing skills.

**Renames and removals (from the CHANGELOG)** — [CHANGELOG.md](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md)
- 1.0.0 (2026-06-17): added `ask-matt`, `codebase-design`, `domain-modeling`; removed `caveman` and `zoom-out`; `diagnose` renamed `diagnosing-bugs`; `write-a-skill` replaced by `writing-great-skills`; taxonomy renamed from "Commands / Skills" to "User-invoked / Model-invoked".
- 1.1.0 (2026-07-08): "**`to-prd` is renamed to `to-spec`**"; "**`to-plan` and `to-issues` are merged into one `to-tickets` skill, and `to-issues` is deleted.**"; in-progress `review` promoted as `code-review`; `decision-mapping` renamed `wayfinder`.
- 1.2.0 (2026-08-05): shipped as a Claude Code plugin; six skills removed, including "**`ubiquitous-language`** → **`/domain-modeling`**", "**`design-an-interface`** → **`/codebase-design`**" (the design-it-twice technique lives on as `DESIGN-IT-TWICE.md`), "**`qa`** → **`/triage`** and **`/to-tickets`**", "**`request-refactor-plan`** → **`/to-spec`** and **`/improve-codebase-architecture`**"; `writing-great-skills` renamed `writing-for-agents`; `wait-what` added.
- 1.3.0 (2026-10-04): `resolving-merge-conflicts` removed with no replacement; `CONTEXT.md`/`CONTEXT-MAP.md` renamed to `GLOSSARY.md`/`GLOSSARY-MAP.md` ("the skills only look for `GLOSSARY.md`/`GLOSSARY-MAP.md` going forward").
- New skill proposals are closed: "if you can compose the behaviour from existing skills, it doesn't get a new skill." — [.out-of-scope/new-skills.md](https://github.com/mattpocock/skills/blob/main/.out-of-scope/new-skills.md)

### Inferences
- A sensible minimal install for a Claude Code dev cycle is the plugin as a whole (the skills cross-call each other by name, so partial installs break: 1.0.0 notes that skills "now depend on the new `codebase-design` / `domain-modeling` skills, so you must install them too"). Add `git-guardrails-claude-code` and optionally `setup-pre-commit` separately via skills.sh if wanted.
- The names in the research brief (`write-a-prd`, `prd-to-issues`, `prd-to-plan`, `triage-issue`) correspond to the early-2026 repo. Older blog posts and videos that use them describe the same flow with the current `to-spec` / `to-tickets` / `triage` skills.

### Gaps
- The `write-a-prd` → `to-prd`, `prd-to-issues` → `to-issues`, `prd-to-plan` → `to-plan`, and `triage-issue` → `triage` renames happened before the CHANGELOG starts (pre-1.0.0), so that lineage is inferred from names, not verified.
- The CHANGELOG names only four of the "six skills" removed in 1.2.0 in the text I read; the other two were not identified.
- `chief-of-staff` exists in `skills/in-progress/` and in changesets but is missing from the in-progress README list; its status is unclear.
- `teach`, `to-questionnaire`, `wait-what`, `wizard` and the three `writing-*` skills were not read in full.
- The star count (about 329k) is as returned by the GitHub API; I did not cross-check it.

## 2. End-to-end workflow he teaches, and its artifacts

### Takeaway
The canonical flow (encoded in `ask-matt`) is: `/grill-with-docs` → optional `/prototype` detour → `/to-spec` → `/to-tickets` → `/implement` per ticket (or `/implement-spec` for the whole graph), each build driving `/tdd` and ending in `/code-review`, with `/pr` shaping the PR and `/retro` closing the loop. Grilling, spec and tickets are meant to share one unbroken context window; each ticket is then implemented in a fresh one.

### Cited Findings

**Order of use** — all from [ask-matt SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md) unless noted
1. Precondition: `/setup-matt-pocock-skills` once per repo.
2. `/grill-with-docs` "sharpens the idea by interview. Start here whenever you are **working in a working directory**". README: "Use them _every_ time you want to make a change." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
3. Branch: if a question "needs a runnable answer", detour through `/handoff` → `/prototype` → `/handoff` back.
4. Branch: multi-session build? Yes → `/to-spec`, then `/to-tickets`. No → `/implement` "right here, in the same context window".
5. Work the tickets either with "**`/implement`** per ticket, **`/clear`ing context between each one**" or "**`/implement-spec`** for the whole spec in one run".
6. "Either way, the code gets built by driving **`/tdd`** (one red-green slice at a time) and closes out with **`/code-review`**".
7. `/pr` shapes the pull request body (model-invoked).
8. "**`/retro`** closes the loop... suggests changes to the agent's **environment**, not the code".
- On-ramps that merge into the main flow: `/triage` for "Bugs and requests piling up" ("Triage is only for issues **you didn't create**"; tickets from `/to-tickets` "are already agent-ready, so **don't triage them**"), `/diagnosing-bugs` for "Something's broken", and `/wayfinder` for "A huge, foggy effort", which "hands off, it doesn't build: merge onto the main flow at **`/to-spec`**".
- Upkeep, outside the feature flow: `/improve-codebase-architecture` "runs whenever you have a spare moment"; "picking one _generates an idea_ you can take into the main flow at `/grill-with-docs`".

**Artifacts**
- `GLOSSARY.md` at repo root (or `GLOSSARY-MAP.md` plus per-context glossaries in a monorepo) and ADRs in `docs/adr/NNNN-*.md`, created lazily — [domain-modeling SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md)
- `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md` and an `## Agent skills` block in CLAUDE.md/AGENTS.md, written by setup — [setup SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/setup-matt-pocock-skills/SKILL.md), [CHANGELOG.md](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md)
- Spec: an issue on the tracker labelled `ready-for-agent`, with sections Problem Statement, Solution, User Stories ("A LONG, numbered list"), Implementation Decisions, Testing Decisions, Out of Scope, Further Notes. "Do NOT include specific file paths or code snippets. They may end up being outdated very quickly." — [to-spec SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md)
- Before writing the spec, `to-spec` sketches test seams: "The fewer seams across the codebase, the better - the ideal number is one." — [to-spec SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md)
- Tickets: one issue per ticket, published blockers-first, as sub-issues of the spec, using native blocking links where the tracker has them; sections Parent, What to build, Acceptance criteria, Blocked by. Each is "sized to fit in a single fresh context window" and "demoable or verifiable on its own". "Do NOT close or modify any parent issue." — [to-tickets SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)
- Local-tracker alternative: `.scratch/<feature-slug>/spec.md` and `.scratch/<feature-slug>/issues/<NN>-<slug>.md` with a `Status:` line; "never a single combined tickets file" — [issue-tracker-local.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md)
- Wide refactors are the stated exception to vertical slicing; they are sequenced as "expand–contract" — [to-tickets SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)
- Triage output: an "agent brief" comment that is "the authoritative specification that an AFK agent will work from"; "**Don't** reference file paths: they go stale"; "Describe **what** the system should do, not **how** to implement it." Rejected enhancements are recorded in `.out-of-scope/*.md` — [AGENT-BRIEF.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/triage/AGENT-BRIEF.md), [triage SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/triage/SKILL.md)
- Prototypes are kept "as a **primary source** on a `prototype/<name>` branch out of main, pointed at from the implementation issue" — [ask-matt SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md)
- `improve-codebase-architecture` report: `<tmpdir>/architecture-review-<timestamp>.html` (Tailwind and Mermaid via CDN), deliberately outside the repo — [SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)
- `implement-spec` output: one integration branch, per-ticket worktrees and branches, optional draft PR "marked as closing the spec and tickets" — [implement-spec SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement-spec/SKILL.md)
- Review inputs: `CODING_STANDARDS.md` / `CONTRIBUTING.md` are always handed to the Standards reviewer; `CODING_STANDARDS.md` "is read during review, not implementation" — [code-review SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md), [retro SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md)

**QA and human review**
- There is no QA skill any more: `qa` was retired into `/triage` and `/to-tickets` in 1.2.0 — [CHANGELOG.md](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md)
- In his AI Engineer Europe 2026 walkthrough (per the event page's summary, not the transcript) the steps were Grill Me → PRD → issues with explicit blockers → tracer-bullet vertical slices → implementation loop → TDD → automated review in a fresh context → human QA; passing tests and type checks "did not catch a missing database table in his demo" — [ai.engineer talk page](https://ai.engineer/talks/-QFHIoCo-Ko-ai-coding-workflow)

### Inferences
- The older "PRD in a GitHub issue, then issues, then Ralph, then manual QA" pipeline and the current skill flow are the same shape with new names: PRD = spec, issues = tickets, Ralph loop = `/implement` per ticket or `/implement-spec` (in-harness) or Sandcastle (out-of-harness).
- Manual QA sits after `/code-review` and is a human step with no dedicated skill; bugs found there re-enter through `/triage` or `/diagnosing-bugs`. The phrase "the grilling, the implementation, the QA" in PHASE-BOUNDARIES.md confirms QA is still a recognised phase.

### Gaps
- The published docs pages (`https://aihero.dev/skills-<skill-name>`) were not fetched; the repo's `docs/` copies were sampled instead.
- The AI Engineer talk content comes from a page summary; the transcript did not load, and the talk date is not shown on the page.

## 3. Ralph loop / AFK agents: how it works, scripts, issue consumption, HITL vs AFK, sandboxing, cost

### Takeaway
Ralph is a bash loop that re-runs a fresh agent against a task source (PRD file or issue tracker) one task per iteration until it prints `<promise>COMPLETE</promise>` or hits an iteration cap. Pocock's January 2026 articles teach it with `docker sandbox run claude`; through 2026 this evolved into Sandcastle (a TypeScript orchestration library with loop, reviewer and parallel-planner templates) and into the in-harness `/implement-spec` skill, with the beta `software-factory` skill covering fully remote setups. The word "Ralph" does not appear in the skills repo itself.

### Cited Findings

**Original Ralph articles (aihero.dev, page metadata updated 2026-01-08)**
- Steps: install Claude Code; install Docker Desktop 4.50+; create a plan in plan mode saved to `PRD.md` and `touch progress.txt`; write `ralph-once.sh` (HITL, one iteration, `--permission-mode acceptEdits`, prompt references `@PRD.md` and `@progress.txt`); then `afk-ralph.sh` which loops `docker sandbox run claude --permission-mode acceptEdits -p "<prompt>"` for `$1` iterations, e.g. `./afk-ralph.sh 20` — [Getting started with Ralph](https://aihero.dev/getting-started-with-ralph)
- Prompt constraints: "ONLY WORK ON A SINGLE TASK." and "If the PRD is complete, output <promise>COMPLETE</promise>." The loop greps output for that marker and exits early — [Getting started with Ralph](https://aihero.dev/getting-started-with-ralph)
- 11 tips: Ralph Is A Loop; Start With HITL, Then Go AFK; Define The Scope; Track Ralph's Progress; Use Feedback Loops; Take Small Steps; Prioritize Risky Tasks; Explicitly Define Software Quality; Use Docker Sandboxes; Pay To Play; Make It Your Own. Key idea: "the agent chooses the task, not you." — [11 tips for AI coding with Ralph Wiggum](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)
- Task sources: a `prd.json` whose items have a `passes` flag the agent flips, or GitHub Issues, Linear or Beads. `progress.txt` is read at the start of each iteration and appended to, committed with the code, and deleted after the sprint — [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)
- HITL = run once, watch, intervene (learning, prompt refinement). AFK = capped loop for bulk, lower-risk work. Caps he uses: 5-10 iterations for small tasks, 30-50 for larger ones; loops typically take 30-45 minutes — [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)
- Docker sandbox: mounts the current directory, cannot reach home directory, SSH keys or system files; trade-off is that global AGENTS.md and user skills are not loaded. Optional for HITL, described as essential insurance for overnight AFK — [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)
- Feedback loops listed: TypeScript types, unit tests, Playwright MCP, ESLint, pre-commit hooks — [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)
- Cost: he was on Anthropic's 5x Max plan at about £90/month and mostly used HITL; "In AI coding, you have to pay to play."; local open-source models were judged not good enough at the time — [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

**Sandcastle (current tooling)**
- "A TypeScript library for orchestrating AI coding agents in isolated sandboxes"; "Great for parallelizing multiple AFK agents, creating review pipelines". About 9.2k stars, last push 2026-11-18. Package `@ai-hero/sandcastle` — [Sandcastle README](https://github.com/mattpocock/sandcastle/blob/main/README.md), [GitHub API](https://api.github.com/repos/mattpocock/sandcastle)
- Sandbox providers: native OS sandboxes (`bwrap()` on Linux/WSL2, `seatbelt()` on macOS 14+) are now "recommended for local development"; also Docker, Podman, and cloud providers Daytona, E2B, Fly.io Sprites, Modal, Vercel — [getting-started.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/getting-started.md)
- Setup: `npm install --save-dev @ai-hero/sandcastle`, `npx @ai-hero/sandcastle init`, put `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) or `ANTHROPIC_API_KEY` in `.sandcastle/.env`, run `npx tsx .sandcastle/main.mts` — [getting-started.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/getting-started.md)
- Init templates: `blank`, `simple-loop` ("Picks issues one by one and closes them"), `sequential-reviewer`, `parallel-planner` ("Plans parallelizable issues, executes on separate branches, then merges"), `parallel-planner-with-review`. Issue tracker choices: GitHub Issues, Beads, Custom — [init.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/init.md)
- `maxIterations` defaults to 1; the loop stops early on `<promise>COMPLETE</promise>`, "a convention you document in your prompt" — [iterations.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/iterations.md)
- How issues are consumed (simple-loop prompt): a shell expression injects the pre-filtered open-issue list ("the sole source of truth for what work exists"); "You are RALPH — an autonomous coding agent working through issues one at a time."; priority order bug fixes → tracer bullets → polish → refactors; "Pick the highest-priority open issue that is not blocked by another open issue."; workflow Explore → Plan → Execute ("RGR (Red → Green → Repeat → Refactor)") → Verify (`npm run typecheck`, `npm run test`) → one commit prefixed `RALPH:` → close the issue; "Work on **one issue per iteration**."; if blocked, comment and move on — [simple-loop/prompt.md](https://github.com/mattpocock/sandcastle/blob/main/src/templates/simple-loop/prompt.md)
- The prompt docs example lists issues with `gh issue list --state open --label Sandcastle ...` — [prompts.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/prompts.md)
- Parallel planner: a planner agent builds a dependency graph of open issues and emits a `<plan>` JSON of unblocked issues with deterministic branch names `sandcastle/issue-{id}` — [parallel-planner/plan-prompt.md](https://github.com/mattpocock/sandcastle/blob/main/src/templates/parallel-planner/plan-prompt.md)
- Reviewer template reviews `git diff {{TARGET_BRANCH}}...{{BRANCH}}` against `.sandcastle/CODING_STANDARDS.md` and commits refinements directly — [sequential-reviewer/review-prompt.md](https://github.com/mattpocock/sandcastle/blob/main/src/templates/sequential-reviewer/review-prompt.md)

**AFK inside the skills**
- The `ready-for-agent` triage role means "fully specified, ready for an AFK agent"; `ready-for-human` "needs human implementation" — [triage SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/triage/SKILL.md)
- `/implement-spec` is the in-harness equivalent of the parallel loop: fresh implementer subagent per ticket in its own worktree, merger subagent, new implementers as the frontier moves, one final `code-review`, fixes in "a single fresh **implementer subagent**" — [implement-spec SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement-spec/SKILL.md)
- Phase-boundary rule: "**Can the task be done AFK?** Is it scoped tightly enough to run with you away from the keyboard, no steering? Then send it to a **subagent**"; "Automated review is the standard case" — [PHASE-BOUNDARIES.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/PHASE-BOUNDARIES.md)
- `software-factory` (beta): "Every trigger is an accelerator. Accelerators without brakes make a slop cannon." Three brakes: automated checks, automated review, human review. "Add one automated trigger at a time, throttled at first... with human review on every PR... cap every loop of runs at a few tries before a human." "A run never waits for a human: it ends, and the human's later change to the ticket tracker or git host triggers a new run." — [software-factory SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/software-factory/SKILL.md)
- Example factory tasks: explore, implementer (draft PR), automated review, rework (capped), decompose, ratchet, architecture (nightly), retro (one merged PR in ten) — [EXAMPLE-TASKS.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/software-factory/EXAMPLE-TASKS.md)

**Cost and usage notes**
- "a non-trivial ticket exceeding 100k tokens is normal rather than a sign something broke. The fix is upstream. Right-size the tickets" — [docs/engineering/implement.md](https://github.com/mattpocock/skills/blob/main/docs/engineering/implement.md)
- A team that sliced 26 tickets by layer "got roughly twenty agent runs per closed ticket, about three quarters of them rework" — [docs/engineering/to-tickets.md](https://github.com/mattpocock/skills/blob/main/docs/engineering/to-tickets.md)
- `/implement-spec` needs "A harness that runs subagents in the background and gives each one a git worktree"; otherwise "it is only a slower `implement`" — [docs/engineering/implement-spec.md](https://github.com/mattpocock/skills/blob/main/docs/engineering/implement-spec.md)

### Inferences
- The decision between HITL and AFK is made per ticket at triage/ticketing time through the `ready-for-agent` versus `ready-for-human` label; grilling, spec approval, ticket approval, seam confirmation in `/tdd`, and QA are the human-in-the-loop points.
- `/tdd` asks the user to confirm seams before any test is written, which conflicts with unattended runs unless seams were already agreed in the spec; `to-spec` agreeing seams up front and `implement` saying "at pre-agreed seams" appears designed to resolve that.
- For a Claude Code-only setup, `/implement-spec` covers the parallel AFK case without extra tooling; Sandcastle is the choice when OS-level isolation, non-Claude agents, or scripted pipelines are wanted.

### Gaps
- The full text of `ralph-once.sh` / `afk-ralph.sh` was not captured verbatim (the fetch returned paraphrases), so copy them from the article, not from these notes.
- I found no first-party statement of current (late 2026) spend or plan tier; the £90/month figure is from January 2026.
- Whether he still personally runs bash Ralph loops, or has moved entirely to Sandcastle / `implement-spec` / cloud runners, is not stated in a primary source I read. The Pragmatic Engineer episode page (2026-09-17) quotes him as "moving away from my local dev setup" towards cloud agents and mentions "day shift"/"night shift" and the Ralph loop only in timestamps — [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock)
- A search result mentioned a post titled "Why the Anthropic Ralph plugin sucks (use a bash loop instead)"; I did not open it.
- YouTube and X content was not accessed directly.

## 4. Codebase architecture for agents: deep modules, vertical slices, feedback loops, guardrails, and how the skills fight entropy

### Takeaway
His position is that agents accelerate entropy, so design discipline has to be built into every stage: a shared domain glossary, deep modules with small interfaces at few seams, tests only at those seams, tracer-bullet slices, and standards enforced by the reviewer and by deterministic checks instead of by the implementer's prompt. `improve-codebase-architecture` is a periodic survey that only produces candidates; the human picks one and it re-enters the normal flow.

### Cited Findings
- README names four failure modes and fixes: misalignment → grilling; verbosity → shared language (`GLOSSARY.md`); non-working code → feedback loops ("static types, browser access, and automated tests") and red-green TDD; ball of mud → design care — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- "Because agents can radically speed up coding, they also accelerate software entropy. Codebases get more complex at an unprecedented rate." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- On `improve-codebase-architecture`: "I recommend running it on your codebase once every few days. It is a survey, not a rescue: on a genuinely old codebase it will find real candidates, but it won't untangle the mud for you." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- The skill's aim "is testability and AI-navigability". It scopes by recent commit history ("put extra weight on the parts of the codebase that have recently changed"), explores with a fresh subagent, and applies "the **deletion test**": "would deleting it concentrate complexity, or just move it?" — [improve-codebase-architecture SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)
- "It never changes the code." Suggested uses: routine upkeep every few days; before a big build ("Point it at the spec and ask \"how can we make this change easy?\" This is the most effective prompt for it."); brownfield audit; finding seams before legacy test work — [docs/engineering/improve-codebase-architecture.md](https://github.com/mattpocock/skills/blob/main/docs/engineering/improve-codebase-architecture.md)
- Deep module definition: "a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface." Principles: "The interface is the test surface."; "One adapter means a hypothetical seam. Two adapters means a real one."; depth is redefined as leverage, rejecting Ousterhout's lines ratio because it "rewards padding the implementation" — [codebase-design SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md)
- Deepening guidance by dependency type (in-process, local-substitutable such as PGLite, remote-but-owned via ports and adapters, true external via mock) and "replace, don't layer": "Old unit tests on shallow modules become waste once tests at the deepened module's interface exist; delete them." — [DEEPENING.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DEEPENING.md)
- TDD anti-patterns: implementation-coupled, tautological, and "**Horizontal slicing**: writing all tests first, then all implementation." — [tdd SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md)
- Vertical slices at the ticket level; "Make the change easy, then make the easy change." (prefactoring tickets go first) — [to-tickets SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)
- Standards belong to the reviewer: "the review agent should be responsible for imposing coding standards, not the implementation agent", because the implementer "has the most **context pressure**" — [retro SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md)
- Mechanical rules become checks: a mechanical violation "gets a deterministic check, full stop: a custom rule in the repo's own linter, a new pre-commit hook, or a new CI job"; "A repo with no **guardrail** (no pre-commit hook and no CI job running its lint/typecheck/test command) is itself a finding" — [retro SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md)
- CLAUDE.md/AGENTS.md "should be used incredibly sparingly, usually only for **navigation pointers** to other files." — [retro SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md)
- "Pit of success" list: "API's and functions which are extremely constrained and limited", "Lint rules which force correctness", "CODING_STANDARDS.md files which let code reviewers enforce best practices"; plus a "no workarounds" rule — [chief-of-staff SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/chief-of-staff/SKILL.md)
- Structural enforcement for TypeScript (beta): dependency-cruiser rules so that code outside a package "may import only that package's entry points (its root files)", tests go through entry points, and no cycles — [setup-ts-deep-modules SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/setup-ts-deep-modules/SKILL.md)
- Code review's smell baseline is twelve Fowler smells (Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest), each "a labelled heuristic... never a hard violation"; "A documented repo standard always wins" — [code-review SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md)
- Debugging rests on the same idea: build "a **tight** pass/fail signal for the bug" first; ten ways to construct one are listed, from failing test to `git bisect run` to a HITL bash script — [diagnosing-bugs SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md)
- Secondary: he argues "bad codebases make bad agents" and that humans should own module interfaces while delegating well-tested internals — [ai.engineer talk page](https://ai.engineer/talks/-QFHIoCo-Ko-ai-coding-workflow). Secondary: agents are "more than capable of tactical programming" (Ousterhout's strategic/tactical split), and a codebase should suit a newcomer with no memory (Memento analogy) — [Pragmatic Engineer, 2026-09-17](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock)

### Inferences
- Slop prevention is layered: glossary (naming), seams agreed at spec time (testability), TDD at seams (behaviour), fresh-context two-axis review (standards and scope creep, including "Speculative Generality"), deterministic checks (mechanical rules), periodic deepening survey (structure), and `/retro` (environment). No single skill is the anti-slop mechanism.
- "Refactoring is not part of the loop" in `tdd` moves the classic refactor step to `code-review`, which is a deliberate departure from textbook red-green-refactor even though the README still uses that phrase.

### Gaps
- Pocock told the Pragmatic Engineer he has "mixed feelings" about TDD for agents (per the episode page), which sits in tension with the README calling red-green "critical". I could not read the full transcript to resolve how he reconciles them.
- No measured evidence (benchmarks, before/after metrics) for the deep-module claims was found in the sources read.

## 5. Installation, Claude Code compatibility, and 2026 changes

### Takeaway
Since August 2026 the recommended Claude Code install is the official-marketplace plugin (`claude plugin install mattpocock-skills@claude-plugins-official`), which self-updates and ships only the 27 promoted skills. `npx skills@latest add mattpocock/skills` still works and gives editable copies. The two routes are mutually exclusive.

### Cited Findings
- "A plugin updates itself. skills.sh copies editable files into your project, and you update them by hand. Pick one per agent, because installing both gives you every skill twice." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- Claude Code: `claude plugin install mattpocock-skills@claude-plugins-official`, "Updates itself by default." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- Other agents: Codex (`codex plugin marketplace add mattpocock/skills` then `codex plugin add mattpocock-skills@mattpocock`), Copilot CLI and VS Code, Gemini CLI (two `gemini skills install ... --path` commands), and everything else via `npx skills@latest add mattpocock/skills -a <agent>` (cursor, opencode, devin, windsurf, amp, pi) — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- skills.sh notes: "include `setup-matt-pocock-skills`"; "To update, run `npx skills@latest update`, and re-run `add` to pick up new skills." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- Plugin history: shipped as "the headline v1.2 deliverable"; accepted into Claude Code's official marketplace (update dated 2026-08-05, verified on Claude Code 2.1.222); the official listing pins a commit sha, "so a release reaches installed users when that pin moves, not the moment we tag" — [ADR 0002](https://github.com/mattpocock/skills/blob/main/.agents/adr/0002-ship-as-a-claude-code-plugin.md)
- Name collisions with Claude Code built-ins (`/code-review`, `/prototype`, `/research`) will not be fixed by renaming; use namespaced invocation such as `/mattpocock-skills:code-review`, or rename your own copy if installed via skills.sh — [.out-of-scope/harness-name-collisions.md](https://github.com/mattpocock/skills/blob/main/.out-of-scope/harness-name-collisions.md)
- Skills do not guard against subagents recursively invoking skills: "The harness should be responsible for stopping infinite subagent loops, not skills." — [.out-of-scope/subagent-recursion.md](https://github.com/mattpocock/skills/blob/main/.out-of-scope/subagent-recursion.md)
- Skill dependencies are written as "Call the Skill tool with \"grilling\"" because "Naming the tool is what gets it fired"; every subagent-dispatching skill says to start with "a fresh context window" because some harnesses (Codex) fork the parent by default — [.agents/invocation.md](https://github.com/mattpocock/skills/blob/main/.agents/invocation.md), [CLAUDE.md](https://github.com/mattpocock/skills/blob/main/CLAUDE.md)
- Hard versus soft dependency on setup: `to-tickets`, `to-spec`, `triage` need the tracker config; `tdd`, `improve-codebase-architecture` and diagnosing degrade gracefully without it — [ADR 0001](https://github.com/mattpocock/skills/blob/main/.agents/adr/0001-explicit-setup-pointer-only-for-hard-dependencies.md)
- Positioning: "Approaches like GSD, BMAD, and Spec-Kit try to help by owning the process... These skills are designed to be small, easy to adapt, and composable. They work with any model." — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- Several 1.3.x fixes ask users to "Re-run `/setup-matt-pocock-skills` to refresh `docs/agents/`"; setup now offers to `git mv` a legacy `CONTEXT.md` to `GLOSSARY.md` — [CHANGELOG.md](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md)
- For local development of the skills themselves, `scripts/link-skills.sh` symlinks every non-deprecated, non-misc skill into `~/.claude/skills` and `~/.agents/skills` — [CLAUDE.md](https://github.com/mattpocock/skills/blob/main/CLAUDE.md)

### Inferences
- In a Claude Code install that already has other skill packs with overlapping jobs (for example a brainstorming, TDD or code-review plugin, or Claude Code's own `/code-review`), Pocock's model-invoked skills (`tdd`, `code-review`, `grilling`, `research`, `prototype`, `diagnosing-bugs`) will compete for auto-invocation. The supported workaround is namespaced invocation or an edited skills.sh copy; choosing one pack per job avoids ambiguity.
- Because the official listing pins a sha, plugin users can lag `main` by days; skills.sh users get `main` immediately but must update by hand.

### Gaps
- I did not run the install commands; they are quoted from the repo, which itself says the Copilot `extraKnownMarketplaces` entry "follows the documented schema, but nobody has run it yet".
- The sha currently pinned by `claude-plugins-official` (and so which version plugin users actually receive today) was not checked.

## 6. Models, context management ("smart zone"/"dumb zone"), and token economy

### Takeaway
The skills treat context as the scarce resource: keep sessions inside a "smart zone" (stated as about 150k tokens in the current repo, about 100k in his talk), keep grilling → spec → tickets in one window, start each ticket fresh, push exploration and review into fresh-context subagents, and communicate by pointers to artifacts instead of copied text. The skills are stated to be model-agnostic; first-party model recommendations are thin.

### Cited Findings
- "Keep steps 1–3 in **one unbroken context window** (don't compact or clear until after `/to-tickets`) so the grilling, spec, and tickets all build on the same thinking. Each `/implement` then starts fresh, working from the ticket." — [ask-matt SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md)
- "The limit on this is the **smart zone**: the window (~150k tokens on state-of-the-art models) within which the model still reasons sharply. If a session approaches it before `/to-tickets`, don't push on degraded; `/compact` at the nearest phase boundary and carry on" — [ask-matt SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md)
- Phase-boundary decision tree, first yes wins: (1) Continue, (2) `/clear` if context is irrelevant, (3) `/handoff` only for a new harness, new directory, colleague, or mid-phase side task, (4) subagent if the task can be done AFK, (5) otherwise `/compact`. "`/compact` is the **default, not the first reach**." "Compacting mid-phase makes the agent lose the thread." — [PHASE-BOUNDARIES.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/PHASE-BOUNDARIES.md)
- "Every move except **Continue** turns a **primary source** into a **secondary source**"; "Grilling → implementation is the standard yes: the implementation wants the reasoning verbatim, not a summary of it." — [PHASE-BOUNDARIES.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/PHASE-BOUNDARIES.md)
- Pass `/compact` an instruction, e.g. `/compact we're going to QA this area` — [PHASE-BOUNDARIES.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/PHASE-BOUNDARIES.md)
- Subagent economy: "Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits." Exploration notes are saved "in a directory outside the repo, accessible by all future subagents" — [implement-spec SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement-spec/SKILL.md)
- Review subagent reports are capped: "Under 400 words." — [code-review SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md)
- Glossary as token saver: "The agent also **spends fewer tokens on thinking**, because it has access to a more concise language" — [README](https://github.com/mattpocock/skills/blob/main/README.md)
- Always-loaded text is taxed every turn: "**Context load** is the cost of always-loaded material on the agent's window"; soft-dependency skills are kept "token-light" — [writing-for-agents SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md), [ADR 0001](https://github.com/mattpocock/skills/blob/main/.agents/adr/0001-explicit-setup-pointer-only-for-hard-dependencies.md)
- `retro` audits "**Tool economy**: did the agent make expensive tool calls that could be streamlined? Is there any custom tooling (CLI's, MCP's) that is particularly token-inefficient?" and "**No-ops**" in steering files — [retro SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md)
- Long-running sessions: "All work should be done in subagents. Protect your context window."; knowledge that lives only in context "is lost at compaction", so keep a wiki — [chief-of-staff SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/chief-of-staff/SKILL.md)
- Models, first-party: "They work with any model." Sandcastle's doc examples all use `claudeCode("claude-opus-4-8")` — [README](https://github.com/mattpocock/skills/blob/main/README.md), [Sandcastle core-concepts.md](https://github.com/mattpocock/sandcastle/blob/main/docs/guide/core-concepts.md)
- Models, secondary (talk-page summary): "Sonnet for implementation and Opus for review"; working threshold "about 100,000 tokens", described as a personal rule of thumb; prefers small system prompts and clean resets over compacted histories; "Resetting allows the reviewer to operate inside its own smart zone." — [ai.engineer talk page](https://ai.engineer/talks/-QFHIoCo-Ko-ai-coding-workflow)
- Secondary: splitting context keeps agents in the "smart zone" — [Pragmatic Engineer, 2026-09-17](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock)

### Inferences
- The smart-zone number is not fixed: the talk summary says about 100k, the current `ask-matt` says about 150k "on state-of-the-art models". Treat it as a moving rule of thumb that he has raised as models improved, not a measured constant.
- The talk's preference for clean resets over compaction and the repo's "`/compact` is the default" are compatible only in the repo's narrower sense: compact is the fallback after continue, clear, handoff and subagent have been ruled out, and only at a phase boundary.
- The "Sonnet implements, Opus reviews" split conflicts with Sandcastle docs using an Opus model id in every example. The docs examples may just be placeholders; neither is a firm current recommendation.

### Gaps
- The AI Hero dictionary entry for "smart zone" (`https://www.aihero.dev/ai-coding-dictionary/smart-zone`, linked from `ask-matt`) returned HTTP 404 on two URL variants on 2026-11-21, so its definition and any "dumb zone" threshold were not verified first-hand. A search snippet claimed it says the dumb zone often starts around 125K-150K tokens; unverified.
- No first-party late-2026 statement on which model or effort level he uses per phase, nor on monthly cost, was found.
- The term "dumb zone" does not appear in the skills repo; it comes from his talks and the dictionary.
