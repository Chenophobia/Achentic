# Claude Code for unattended / autonomous dev agents on a personal Mac mini (state as of 2026-11-21)

Scope: solo developer, Claude Max ($100/mo, formerly "Max 5x") + ~$20/mo API budget, always-on Mac mini M4, personal projects.
All official-doc facts below were fetched on 2026-11-21 unless another date is given. Docs pages carry no publication date; where a doc cites a Claude Code version number (v2.1.xxx) it is included as a rough recency marker.

Naming note (changed during 2026): the official pricing page now lists **Pro $20 / Max $100 / Ultra $200**. "Max 5x" is now just "Max"; "Max 20x" appears to have become "Ultra". One secondary source dates the rename to 2026-10-30; I could not confirm the date on an Anthropic page. Older articles (and some search snippets of Anthropic's own help pages) still say "Max 5x / Max 20x".

---

## 1. Max ($100) plan: usage limits, what counts, practical throughput

### Takeaway
Max = 5x Pro usage, enforced as a rolling 5-hour session limit plus a weekly all-models limit plus a separate weekly Fable limit; Anthropic publishes no token/hour numbers any more, and everything (chat, Claude Code local, cloud sessions, scheduled tasks, `claude -p`, GitHub Action via OAuth token) draws from the same pool. A 24/7 agent on one Max seat is quota-bound, not hardware-bound: plan for the weekly cap to be the real ceiling.

### Cited Findings
- Pricing page (2026-11): Pro $20/mo ($17 annual), Max $100/mo with "5x Pro, both every 5 hours and every week", Ultra $200/mo with 10x Pro weekly and no 5-hour limit for verified accounts. Claude Code included in Pro/Max/Ultra. — [claude.com/pricing/max](https://claude.com/pricing/max)
- Max models: Opus, Sonnet, Haiku and Fable; Fable "counts for up to half your weekly limit". Pro gets Fable only via usage credits. — [claude.com/pricing/max](https://claude.com/pricing/max)
- Help center: Max includes "five times the Pro plan's usage every five hours and every week"; three limits: five-hour session limit (rolling), weekly limit across all models, and a separate weekly limit for Fable. Weekly reset is at a fixed per-account time (Settings > Usage). No message/hour estimates are given. Max is monthly-only. — [What is the Max plan (support 11049741)](https://support.claude.com/en/articles/11049741)
- Anthropic "may impose other restrictions at our discretion" and "We don't guarantee uninterrupted service." — [support 11049741](https://support.claude.com/en/articles/11049741)
- "Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude Code and the Agent SDK." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- Limit messages: "You've hit your session limit" / "You've hit your weekly limit" are shared across all models (switching model does not help); model-specific "You've hit your Opus limit" / "Sonnet limit" messages also exist, after which switching model family keeps you working. — [Costs doc](https://code.claude.com/docs/en/costs)
- Since v2.1.234 Claude Code can wait and auto-continue an interrupted task after the limit resets (`/rate-limit-options`; managed setting `autoContinueAtUsageLimit`). — [Costs doc](https://code.claude.com/docs/en/costs)
- What counts: cloud sessions "count toward your plan's usage limits alongside the rest of your Claude and Claude Code usage"; no separate VM charge. Cloud scheduled tasks "draw down subscription usage the same way interactive sessions do." Each background session "uses your subscription quota independently." Subagent requests "still draw on your usage." — [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web), [Routines](https://code.claude.com/docs/en/routines), [Agent view](https://code.claude.com/docs/en/agent-view), [Costs](https://code.claude.com/docs/en/costs)
- Hidden drains in long/idle sessions: full context re-sent each request; cache misses after idle longer than cache TTL; session-scoped scheduled tasks firing with full context; cross-session messages; `/goal` check-ins (max 3 idle check-ins per goal since v2.1.246); subagents/workflows; agent teammates; `/compact` itself is a large request. — [Costs doc](https://code.claude.com/docs/en/costs)
- Agent teams use ~7x more tokens than a standard session when teammates run in plan mode. — [Costs doc](https://code.claude.com/docs/en/costs)
- `/usage` shows plan usage bars plus attribution (skills, subagents, plugins, MCP servers), recommendations, and a per-loop row for heavy `/loop` tasks; local-machine only. — [Costs doc](https://code.claude.com/docs/en/costs)
- Rough dollar-equivalent benchmark (enterprise API billing, not Max): ~$13/developer/active day average, $150-250/month, <$30/active day for 90% of users. — [Costs doc](https://code.claude.com/docs/en/costs)
- Usage credits ("extra usage"): optional pay-as-you-go past plan limits, "billed at standard API rates", with monthly spend limit or "unlimited", auto-reload web-only. Credits bought on/after 2026-12-07 expire after 12 months. — [support 12429409](https://support.claude.com/en/articles/12429409)
- Historical (stale) throughput numbers: at the Aug 2025 introduction of weekly limits, the $100 plan was described as ~140-280 h Sonnet 4 and 15-35 h Opus 4 per week. — [TechCrunch 2025-07-28](https://techcrunch.com/2025/07/28/anthropic-unveils-new-rate-limits-to-curb-claude-code-power-users/)
- Anecdotal (unverified, secondary): users report Max 20x weekly allowance was only ~2x Max 5x weekly, not 4x. — [ITNEXT](https://itnext.io/if-you-thought-claude-max-20x-meant-20x-weekly-usage-you-were-wrong-042f70e0035e); consistent with today's official 5x vs 10x weekly multiples on [the pricing page](https://claude.com/pricing/max)
- A temporary +50% Claude Code weekly-limit promotion ran 2026-05-13 to 2026-08-31 (now expired), per search summary of Anthropic help pages. — [support 11049741](https://support.claude.com/en/articles/11049741) (not re-verified in the current page text)

### Inferences
- Because limits are relative ("5x Pro") and undisclosed, the only reliable throughput measure is the account's own `/usage` bars; build the agent loop to read/obey limit errors rather than plan around hour estimates.
- A true 24/7 loop on Opus 5.5 will almost certainly exhaust the weekly cap; the cost docs' $13/active-day average vs. a $100/month plan suggests Max comfortably covers one heavy interactive developer but not several always-on parallel agents.
- Fable is capped at roughly half the weekly allowance on Max, so use it sparingly (hard planning/root-cause only).
- If usage credits are enabled with "unlimited" spend, an unattended agent that hits the plan cap silently converts to API-rate billing. For unattended use keep usage credits off or set a low monthly spend limit.

### Gaps
- No official absolute numbers (tokens, messages, hours) for Max limits in 2026; no reliable recent community measurements found for Opus 5.5 / Sonnet 5.5 (search returned only 2025-era figures).
- Could not open the "Using Claude Code with your Pro or Max plan" article (old URL 404) or confirm the exact date of the Max 5x -> Max / Max 20x -> Ultra rename.
- Whether there are still separate per-model weekly caps for Opus/Sonnet on Max (docs mention model-specific limit messages; Max article only names a Fable-specific weekly limit).

---

## 2. Is subscription use for headless / automated runs permitted and supported?

### Takeaway
Yes for personal use with Anthropic's own binary: as of 2026-11, `claude -p`, the Agent SDK, `claude setup-token` (1-year OAuth token) and `claude-code-action` with `CLAUDE_CODE_OAUTH_TOKEN` are all documented, supported ways to run on a Pro/Max/Ultra subscription and they draw from subscription limits. The planned June 2026 move of programmatic use to a separate metered "Agent SDK credit" was paused and is not in effect. What is prohibited is building products that route other people's requests through subscription credentials, third-party apps offering Claude.ai login, and (per Consumer Terms) automated access outside explicitly permitted paths.

### Cited Findings
- Consumer Terms (effective 2025-10-08), section 3: prohibited "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise." Also no sharing of account credentials, no reselling. — [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)
- Claude Code docs: "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Ultra, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication... Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription" (including on hosted platforms). "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- 2026 policy timeline:
  - 2026-05-14 (announced): from 2026-06-15, Agent SDK / `claude -p` / Claude Code GitHub Actions / third-party Agent-SDK apps on subscriptions were to draw from a separate monthly Agent SDK credit billed at API prices ($20 Pro / $100 Max 5x / $200 Max 20x reported). — [The Register 2026-05-14](https://www.theregister.com/ai-ml/2026/05/14/anthropic-tosses-agents-into-the-api-billing-pool/5240748), [The Decoder](https://the-decoder.com/claude-subscriptions-get-separate-budgets-for-programmatic-use-billed-at-full-api-prices/)
  - 2026-06-15 (official): "We've paused the previously-announced changes to Claude Agent SDK usage. For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription limits." — [support 15036540](https://support.claude.com/en/articles/15036540); also reported by [The New Stack](https://thenewstack.io/anthropic-pauses-claude-agent-sdk-subscription-change-)
  - 2026-10-07 (official): "Claude Max, Ultra, and Team plans now include monthly API credits. They cover the Claude API, Claude Managed Agents, and the Claude Agent SDK and `claude -p` when you run them with an API key from your linked Claude Console organization. Nothing changes for your plan: when you're signed in with your Claude plan, the Claude Agent SDK and `claude -p` still draw from your subscription limits." — [support 15036540](https://support.claude.com/en/articles/15036540)
  - Third-party harness use of subscriptions (OpenClaw etc.) was restricted earlier in 2026 and then reinstated "with a catch" per press. — [VentureBeat](https://venturebeat.com/ai/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch/) (article body not read; treat details as unverified)
- `claude setup-token`: generates "a one-year OAuth token"; prints it (does not store); set as `CLAUDE_CODE_OAUTH_TOKEN`. "Use this for CI pipelines and scripts where browser login isn't available." Requires Pro/Max/Ultra/Team/Enterprise. "It can only make model requests, so it can't establish Remote Control sessions or fetch claude.ai connectors." Locally configured MCP servers still work. — [Authentication](https://code.claude.com/docs/en/authentication)
- `--bare` mode does not read `CLAUDE_CODE_OAUTH_TOKEN`, OAuth creds or the keychain; it needs `ANTHROPIC_API_KEY` or `apiKeyHelper`. "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." — [Headless](https://code.claude.com/docs/en/headless), [Authentication](https://code.claude.com/docs/en/authentication)
- Credential precedence: cloud provider > `ANTHROPIC_AUTH_TOKEN` > `ANTHROPIC_API_KEY` (always used in `-p` if present) > `apiKeyHelper` > `CLAUDE_CODE_OAUTH_TOKEN` > Anthropic profile > subscription `/login`. — [Authentication](https://code.claude.com/docs/en/authentication)
- GitHub Actions: `CLAUDE_CODE_OAUTH_TOKEN` is "an OAuth token that authenticates with your Claude subscription, available on Pro, Max, Ultra, Team, and Enterprise plans. Generate one by running `claude setup-token` locally." "If you authenticate with an OAuth token, runs use your Claude subscription instead of API billing." `/install-github-app` offers "creating a long-lived token with your Claude subscription" or an API key. — [GitHub Actions doc](https://code.claude.com/docs/en/github-actions)
- For shared/org secrets Anthropic recommends an API key "since an OAuth token is tied to the subscription of the person who ran `claude setup-token`." — [GitHub Actions doc](https://code.claude.com/docs/en/github-actions)

### Inferences
- For a solo developer running the unmodified `claude` binary (or `claude-code-action`, or their own Agent SDK scripts) on their own repos, subscription auth is explicitly permitted today; the Consumer Terms' anti-automation clause is satisfied via the "where we otherwise explicitly permit it" carve-out that the Claude Code docs supply.
- The risk is policy volatility: Anthropic tried to move exactly this usage to metered credits in June 2026, paused it "for now", and reserves enforcement "without prior notice". Design the pipeline so the auth mode (OAuth token vs API key) is a one-line switch.
- The stated future default of `--bare` for `-p` (which ignores subscription OAuth) is a signal: scripts should pass flags explicitly and not rely on today's `-p` defaults.
- Third-party orchestrators that drive the subscription through their own client (not the `claude` binary / Agent SDK) are the grey-to-prohibited zone; wrappers that shell out to `claude -p` are on the safe side.

### Gaps
- No official statement found on whether/when the paused Agent SDK credit change will be revived.
- Support article 15036540 does not mention GitHub Actions explicitly in its "still draw from subscription limits" sentences (the GitHub Actions doc does say OAuth-token runs use the subscription).
- Did not read the Usage Policy (AUP) or the API-credit program terms text directly.

---

## 3. Built-in automation features and how each works

### Takeaway
Claude Code now has first-party pieces for nearly the whole unattended loop: headless `claude -p`, background sessions with a supervisor (`claude --bg` / `claude agents`), three schedulers (cloud tasks, Desktop local tasks, session `/loop`), cloud sessions with PR auto-fix, Remote Control from phone, `claude-code-action`, local `/code-review` and cloud ultrareview, and auto mode + sandboxing for prompt-free runs. On an always-on Mac the local options need a logged-in, awake machine; the cloud options need GitHub and a claude.ai login.

### Cited Findings
**Headless (`claude -p`) / Agent SDK**
- `claude -p "<prompt>"` runs non-interactively; exit code 0/non-zero; `--output-format text|json|stream-json`; `--json-schema` for structured output; `--continue` / `--resume <session-id>`; JSON output includes `total_cost_usd` (client-side estimate). Piped stdin capped at 10 MB. — [Headless](https://code.claude.com/docs/en/headless)
- Without `--bare`, `-p` loads hooks, skills, plugins, MCP servers, CLAUDE.md like an interactive session, "even in a folder you've never trusted" (no trust dialog). — [Headless](https://code.claude.com/docs/en/headless)
- Since v2.1.302, `-p` runs start in Manual mode if nothing sets a mode; calls needing approval are denied unless covered by `--allowedTools`, `permissions.allow`, a `PermissionRequest` hook or `--permission-prompt-tool`. — [Headless](https://code.claude.com/docs/en/headless), [Permission modes](https://code.claude.com/docs/en/permission-modes)
- `--permission-prompts none` (v2.1.259+) or setting `permissions.denyInsteadOfPrompting: true`: anything that would prompt is denied, Claude is told not to retry, `AskUserQuestion` is removed; denials listed in `permission_denials`. Documented example: `claude -p "..." --permission-mode auto --permission-prompts none`. — [Headless](https://code.claude.com/docs/en/headless)
- `--max-budget-usd` caps a run; `--max-turns` limits iterations; `--fallback-model`. — [Headless](https://code.claude.com/docs/en/headless), [GitHub Actions](https://code.claude.com/docs/en/github-actions), [Model config](https://code.claude.com/docs/en/model-config)
- A `-p` run waits for background work up to 10 min idle (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`); SIGTERM exits 143 leaving the turn unfinished (use SIGINT to end the turn cleanly). — [Headless](https://code.claude.com/docs/en/headless)
- User-invoked skills/custom commands work in `-p` (`/skill-name` in the prompt); `/model`, `/effort` accept arguments. — [Headless](https://code.claude.com/docs/en/headless)

**Background sessions / agent view**
- `claude --bg "<prompt>"`, `/bg` or left-arrow moves a session to the background; `claude agents` lists sessions by state (Needs input / Working / Completed); `claude attach|logs|stop <id>`. A supervisor process keeps them running after the terminal closes. — [Agent view](https://code.claude.com/docs/en/agent-view)
- Idle/finished unattached sessions are stopped after ~1 hour (conversation kept on disk). Sleep does not kill sessions; shutdown does, and sessions active in the last 48 h show as failed and restart from saved conversation on attach/reply. — [Agent view](https://code.claude.com/docs/en/agent-view)
- Dispatched background sessions move into their own git worktree under `.claude/worktrees/` before editing (`worktree.bgIsolation: "none"` disables). Permission prompts park the session under "Needs input" until you attach. — [Agent view](https://code.claude.com/docs/en/agent-view)

**Scheduling (three options)**
- Comparison (official table): Cloud tasks run on Anthropic cloud, no machine needed, fresh clone, min interval 1 hour, auto mode by default. Desktop tasks run on your machine, need the app open and machine awake, local file access, min 1 minute if Claude sets it (1 hour in the form). `/loop` runs in an open session, min 1 minute. — [Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)
- Cloud scheduled tasks (formerly "routines"; research preview): saved prompt + repos + connectors; triggers = schedule, API (HTTP POST with bearer token), GitHub events; Pro/Max/Ultra/Team/Enterprise; manage at claude.ai/code/routines or `/schedule`; each run is a full cloud session; Claude pushes to `claude/`-prefixed branches; acts as your GitHub identity. Usage: "draw down subscription usage the same way interactive sessions do"; rate caps 100 scheduled runs/hour per account, 30/hour per task for Run-now/API fires. — [Routines](https://code.claude.com/docs/en/routines)
- Desktop local scheduled tasks: fresh session per run; checked every minute while app is open; skipped if asleep; on wake one catch-up run for the most recent missed time within 7 days; per-task permission mode and model; optional worktree per run; prompt stored at `~/.claude/scheduled-tasks/<name>/SKILL.md`; "Keep computer awake" setting. Runs stall on permission prompts until answered. — [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- `/loop`: `/loop 5m <prompt>` fixed interval (cron), `/loop <prompt>` self-paced (1 min to 1 h, Claude picks), bare `/loop` runs a built-in maintenance prompt (continue unfinished work, tend the branch's PR: review comments, failed CI, conflicts; then cleanup) or your `.claude/loop.md`. Tools: `CronCreate/CronList/CronDelete`; max 50 tasks per session; recurring tasks expire after 7 days; no catch-up; jitter up to 30 min on hourly+ schedules; `CLAUDE_CODE_DISABLE_CRON=1` disables. Session must be running; backgrounding carries the loop to a background session. — [Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)
- Related: `/goal` keeps a session working turn after turn toward a condition; Channels push events (e.g. CI failure) into a session; Monitor tool streams a background script's output instead of polling. — [Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)

**Cloud sessions (Claude Code on the web)**
- Available on Pro/Max/Ultra/Team; run in an Anthropic-managed VM, continue with laptop closed; start from claude.ai/code, mobile app, Desktop, or `claude --cloud "<task>"`; pull back with `claude --teleport`; queue follow-ups with `claude -p "msg" --cloud <session-id>`. Clones from GitHub (push first) or uploads a bundle (<100 MB) when no GitHub app/remote. Default "Limited" network access. PR creation needs GitHub. — [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- Parallelism: each `--cloud` command is an independent session; "Running multiple tasks in parallel consumes more rate limits proportionately." Sessions stop after inactivity (VM reclaimed; history restored on reopen, background work is not). — [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- Auto-fix PRs: Claude subscribes to PR events and pushes fixes for CI failures and review comments when the fix is clear, asks when ambiguous; enable from the session's Changes card, `/autofix-pr` in the terminal, or by asking; requires the Claude GitHub App; cannot react to merge conflicts; replies post under your GitHub user and can trigger comment-driven automation. — [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)

**Remote Control (phone/browser steering of a local session)**
- `claude remote-control` (server mode, `--spawn worktree`, `--capacity` default 32) or `/remote-control` in a session; Pro/Max/Ultra/Team/Enterprise; outbound HTTPS only, no inbound ports; reconnects after sleep/network drop; mobile push notifications; optional Trusted Devices. API keys are not supported and `setup-token` tokens cannot establish it ("requires a full-scope login token"). Server mode exits after ~10 min without network. — [Remote Control](https://code.claude.com/docs/en/remote-control)

**GitHub: `claude-code-action`, Code Review, `/code-review`, `/security-review`**
- `anthropics/claude-code-action@v1`: interactive mode (responds to `@claude` in issues/PR comments/reviews; issue-to-PR) and automation mode (`prompt` input on any event incl. `schedule`). Setup via `/install-github-app`. Only users with write access trigger it; bot actors rejected unless in `allowed_bots`. `claude_args` passes CLI flags (`--max-turns`, `--model`, `--allowedTools`). Consumes GitHub Actions minutes plus tokens (API key) or subscription (OAuth token). — [GitHub Actions doc](https://code.claude.com/docs/en/github-actions)
- PR review workflow example uses the `code-review` plugin: `prompt: "/code-review:code-review --comment <repo>/pull/<n>"`, posts inline comments; skips drafts/trivial PRs; fork PRs don't get secrets. — [GitHub Actions doc](https://code.claude.com/docs/en/github-actions)
- Managed "Code Review" service (auto review of every PR without a workflow) is Team/Enterprise only and "billed through usage credits". — [Docs index](https://code.claude.com/docs/llms.txt)
- Local `/code-review` (alias `/review`): bundled skill, works on any plan, "counts toward your plan's usage or API billing the same way the rest of the session does"; takes effort level, target (PR number, branch, path, range), `--fix`, `--comment`; runs as a background subagent; works in `-p`; can be scheduled via `/loop`. `/code-review ultra` runs the deep multi-agent cloud "ultrareview" (claude.ai login required; `claude ultrareview` subcommand for scripts). `/simplify` = cleanup-only review; `/verify` runs the app. — [Local code review](https://code.claude.com/docs/en/code-review-local)
- Security: a `security-guidance` plugin reviews Claude's own changes as it writes; a "Claude Security" plugin scans the codebase and proposes patches. — [Docs index](https://code.claude.com/docs/llms.txt)

**Extensibility building blocks (from the docs index; pages not read in depth)**
- Hooks: "Run shell commands automatically when Claude edits files, finishes tasks, or needs input"; hook events include PreToolUse, PermissionRequest, SessionStart, SessionEnd, Setup, Elicitation, WorktreeCreate. Hooks can rewrite tool input (e.g. trim test output). — [Docs index](https://code.claude.com/docs/llms.txt), [Costs](https://code.claude.com/docs/en/costs), [Headless](https://code.claude.com/docs/en/headless)
- Subagents: separate context window, per-agent `model` and `effort` frontmatter, `.claude/agents/`; skills: on-demand instructions in `.claude/skills/`, can run in a forked subagent; plugins bundle skills/hooks/MCP via marketplaces; custom commands in `.claude/commands/`. — [Docs index](https://code.claude.com/docs/llms.txt), [Costs](https://code.claude.com/docs/en/costs), [Model config](https://code.claude.com/docs/en/model-config)
- Worktrees: `--worktree` flag, subagent isolation, `.worktreeinclude`. Agent teams (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), dynamic workflows (script-driven subagent fan-out), projects (one conversation coordinating parallel cloud sessions), cross-session messaging. — [Docs index](https://code.claude.com/docs/llms.txt), [Costs](https://code.claude.com/docs/en/costs)

**Permission modes and sandboxing**
- Modes: Manual (`default`), `acceptEdits`, `plan`, `auto`, `dontAsk` ("anything that would prompt is denied", for locked-down CI), `bypassPermissions` ("Isolated containers and VMs only"). — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Auto mode: a classifier reviews actions, "blocking anything that escalates beyond your request, targets unrecognized infrastructure, or appears driven by hostile content Claude read"; blocks by default `curl | bash`, force push, production deploys/migrations, `terraform destroy`; after 3 consecutive or 20 total blocks it pauses and falls back to prompting (not configurable). Default starting mode for interactive sessions on all plans since v2.1.283. "does not guarantee safety." — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Sandboxed Bash (macOS Seatbelt): off by default; `/sandbox` or `sandbox.enabled: true`; writes limited to working dir + temp; network via proxy with `allowedDomains` (starts empty); reads most of the machine incl. `~/.ssh` unless `denyRead`; covers only shell commands (not Read/Edit/Write, MCP servers, hooks); escape hatch `dangerouslyDisableSandbox` unless `allowUnsandboxedCommands: false`. `docker`, `gh`, `ssh` often need exclusion. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)

### Inferences
- For an always-on Mac mini, the most robust local building blocks are (a) `launchd`/cron invoking `claude -p ... --permission-mode auto --permission-prompts none --max-budget-usd N` with `CLAUDE_CODE_OAUTH_TOKEN`, and (b) `claude remote-control` server mode with `--spawn worktree` under a full `/login` for phone steering. Desktop scheduled tasks are an alternative but depend on the GUI app staying open.
- `/loop` and session cron are unsuitable as the durable scheduler (7-day expiry, dies with the session, no catch-up); they are for babysitting a PR within a run.
- Cloud tasks + auto-fix offload work from the Mac entirely but spend the same Max quota, so they add parallelism, not capacity.
- The bare-`/loop` maintenance prompt and cloud auto-fix already implement "watch PR, fix CI, address review comments" - a custom pipeline may not need to build this.

### Gaps
- Did not read hooks, sub-agents, skills, plugins, worktrees, workflows, agent-teams, ultrareview or Code Review pricing pages in full; details above for those come from the index and cross-references.
- Daily run caps for cloud scheduled tasks per plan (earlier 2026 reports cited per-day caps) were not found in the current page; current page lists hourly rate limits only.
- Ultrareview cost / free-run allowance on Max not confirmed.
- No doc statement found on running `claude` as a `launchd` daemon specifically.

---

## 4. Subscription quota vs API credits; best use of a small API budget; API prices

### Takeaway
Everything authenticated with the claude.ai login or `CLAUDE_CODE_OAUTH_TOKEN` spends Max quota; anything run with `ANTHROPIC_API_KEY` spends Console credits. Crucially, since 2026-10-07 the Max plan itself includes $100/month of Claude Platform API credits (claim required, no rollover) that cover the API, Agent SDK and `claude -p` with an API key - so the user's separate $20/month budget may be unnecessary, or is pure overflow. Best use of API money: `--bare` scripted jobs, CI review on Haiku 5.5 / Sonnet 5.5, and Batch API (50% off) for non-urgent bulk work.

### Cited Findings
**What bills where**
| Surface | Bills to | Source |
|---|---|---|
| Interactive Claude Code via `/login` | Max plan limits | [Costs](https://code.claude.com/docs/en/costs) |
| `claude -p` / Agent SDK signed in with plan or `CLAUDE_CODE_OAUTH_TOKEN` | Max plan limits ("still draw from your subscription limits") | [support 15036540](https://support.claude.com/en/articles/15036540) |
| `claude -p` / Agent SDK with `ANTHROPIC_API_KEY` (always wins in `-p` if set) | Console credits (incl. monthly API credits) | [Authentication](https://code.claude.com/docs/en/authentication), [support 15036540](https://support.claude.com/en/articles/15036540) |
| `claude --bare -p` | API key only (ignores OAuth) | [Headless](https://code.claude.com/docs/en/headless) |
| `claude-code-action` with `claude_code_oauth_token` | Subscription ("runs use your Claude subscription instead of API billing") + GitHub Actions minutes | [GitHub Actions](https://code.claude.com/docs/en/github-actions) |
| `claude-code-action` with `anthropic_api_key` | API tokens + GitHub Actions minutes | [GitHub Actions](https://code.claude.com/docs/en/github-actions) |
| Cloud sessions, cloud scheduled tasks, auto-fix | Max plan limits ("always use your subscription credentials"; API key env vars in the cloud env do not override) | [Authentication](https://code.claude.com/docs/en/authentication), [Routines](https://code.claude.com/docs/en/routines) |
| Background sessions, subagents, `/code-review` local, `/insights` | Same account as the session (plan) | [Agent view](https://code.claude.com/docs/en/agent-view), [Local code review](https://code.claude.com/docs/en/code-review-local) |
| Auto mode classifier | No charge on Pro/Max/Ultra/Team (server-side checks); counts as tokens on API/Enterprise or behind a gateway | [Classifier billing](https://code.claude.com/docs/en/auto-mode-classifier-billing), [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| Usage past plan limits (if enabled) | Usage credits at standard API rates | [support 12429409](https://support.claude.com/en/articles/12429409) |
| Managed Code Review service (Team/Enterprise only) | Usage credits | [Docs index](https://code.claude.com/docs/llms.txt) |

**Monthly API credits bundled with Max (new 2026-10-07)**
- Max $100/mo, Ultra $200/mo, Team pooled up to $500. Claim by linking a Claude Console org at claude.ai Settings > Billing; new subscribers eligible after 7 days. Covers Claude API, Managed Agents, Agent SDK, Playground. "Doesn't cover: Claude Code, extra usage in the Claude apps." No rollover; expire each billing cycle. When exhausted, "API requests stop until your next monthly API credits arrive. Usage is never charged to your Claude plan." unless you buy credits / enable auto-reload. One Console org per plan. Workspace spend limits can cap a project. — [API credits for subscribers](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)
- Nuance/conflict: the platform doc says credits don't cover "Claude Code" (an interactive Claude Code session on an org holding only these credits shows "Credit balance too low"), while the help-center notice says they cover "the Claude Agent SDK and `claude -p` when you run them with an API key from your linked Claude Console organization." — [API credits doc](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers) vs [support 15036540](https://support.claude.com/en/articles/15036540)
- "Monthly API credits don't apply to usage credits in Claude, Claude Code, or Claude Cowork." — [support 12429409](https://support.claude.com/en/articles/12429409)

**API prices (USD per million tokens, Claude API first-party, fetched 2026-11-21)** — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
| Model | Input | Output | Cache read | 5m cache write | Batch in/out |
|---|---|---|---|---|---|
| Fable 5.2 | $8 | $40 | $0.20 | $10 | $4 / $20 |
| Fable 5.1 / Fable 5 | $10 | $50 | $0.25 / $1 | $12.50 | $5 / $25 |
| Opus 5.5 | $4 | $20 | $0.20 | $5 | $2 / $10 |
| Opus 5 / 4.8 / 4.7 / 4.6 / 4.5 | $5 | $25 | $0.50 | $6.25 | $2.50 / $12.50 |
| Sonnet 5.5 | $2 | $10 | $0.10 | $2.50 | $1 / $5 |
| Sonnet 5 | $2 | $10 | $0.20 | $2.50 | $1 / $5 |
| Sonnet 4.6 / 4.5 | $3 | $15 | $0.30 | $3.75 | $1.50 / $7.50 |
| Haiku 5.5 (prompt <=100k tok) | $0.10 | $0.50 | $0.01 | $0.125 | $0.05 / $0.25 |
| Haiku 5.5 (prompt >100k tok) | $0.50 | $2.50 | $0.05 | $0.625 | $0.25 / $1.25 |
| Haiku 4.5 | $1 | $5 | $0.10 | $1.25 | $0.50 / $2.50 |
- Sonnet 5's $2/$10 was introductory through 2026-08-31 and has been made the standard price (planned rise to $3/$15 on 2026-09-01 cancelled). — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Prompt caching: 5-min write 1.25x, 1-hour write 2x, read 0.1x (0.05x on Opus 5.5 / Sonnet 5.5, 0.025x on Fable 5.1/5.2); stacks with Batch. Batch API: 50% off input and output; not available with fast mode. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- 1M-token context at standard pricing on 4.6+ models except Haiku 5.5 (which reprices above 100k prompt tokens, counting cached tokens). Claude 4.7+ tokenizer yields ~30% more tokens for the same text. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Fast mode (up to 2.5x output speed) is 2x price: Opus 5.5 $8/$40, Fable 5.2 $16/$80. Web search tool $10 per 1,000 searches; web fetch free beyond tokens. Managed Agents: tokens + $0.08/session-hour. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Anthropic's own cost guidance: "Choose Haiku for simple tasks, Sonnet for most production workloads, and Opus for the most complex reasoning"; use caching; use Batch for non-time-sensitive work. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

### Inferences
- First action: claim the Max plan's $100/month API credits (link a Console org). That alone is 5x the user's stated $20 API budget, at no extra cost; keep a small purchased balance with auto-reload OFF and a workspace spend limit as the hard stop.
- Sensible split: Max quota for the heavy interactive/agentic implementation work (most expensive per token, flat-rate there); API credits for deterministic, bounded, high-frequency jobs where a fixed dollar cap is desirable: CI PR review via `claude-code-action` with `anthropic_api_key` on `--model` Sonnet 5.5 or Haiku 5.5 and `--max-turns`, nightly `claude --bare -p` triage/summaries, and Batch API for bulk classification/doc generation.
- Illustrative arithmetic (mine, from the price table): a PR review consuming 150k input + 5k output tokens costs about $0.35 on Sonnet 5.5 and about $0.08 on Haiku 5.5 (>100k tier) uncached; $20 buys roughly 55 Sonnet 5.5 or 250 Haiku 5.5 such reviews; with the $100 bundled credit, about 5x that.
- Keep Haiku 5.5 prompts under 100k tokens where possible: crossing the threshold is a 5x price step for the whole request.
- Never export `ANTHROPIC_API_KEY` globally in the Mac's shell profile: in `-p` mode it silently takes precedence over the subscription and drains credits; scope it per job.

### Gaps
- Whether `claude-code-action` with an API key from the linked Console org is covered by the bundled monthly API credits is not stated explicitly (it is built on the Agent SDK, so probably yes).
- Exact boundary of "Claude Code not covered" vs "`claude -p` covered" for the bundled credits is ambiguous between the two official pages.
- API rate-limit tier details for a Start-tier org (linked orgs "move up to at least the Start tier") not fetched.

---

## 5. Model selection and effort settings for cost/quota efficiency

### Takeaway
Default on Max is Opus 5.5 at medium effort; the documented quota-saving pattern is `opusplan` (Opus plans, Sonnet executes), Haiku for simple subagents, and effort tuned per task (low/medium for routine, high/xhigh where verification matters). Fable is opt-in, best for long autonomous/ambiguous problems, and capped at about half the weekly limit.

### Cited Findings
- Aliases: `default` = Opus 5.5 on Pro/Max/Ultra/Team/Enterprise/API; `opus`/`best` = Opus 5.5; `sonnet` = Sonnet 5.5; `haiku` = Haiku 5.5; `fable` = Fable 5.2; `opusplan` = Opus in plan mode, Sonnet for execution; `[1m]` suffix for 1M context. "No Fable model is the default on any plan." — [Model config](https://code.claude.com/docs/en/model-config)
- Set model via `/model`, `--model`, `ANTHROPIC_MODEL`, settings `model`, or `ANTHROPIC_DEFAULT_MODEL` (v2.1.236+); pin alias targets with `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_` / `_HAIKU_` / `_FABLE_`. — [Model config](https://code.claude.com/docs/en/model-config)
- Effort levels low/medium/high/xhigh/max; default medium on Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5. Set via `/effort`, `--effort`, `CLAUDE_CODE_EFFORT_LEVEL`, `effortLevel` setting, or `effort` in skill/subagent frontmatter (`max` not accepted in settings keys). — [Model config](https://code.claude.com/docs/en/model-config)
- Guidance: "`medium` suits most day-to-day work on Opus 5.5. Use `high` or `xhigh` where verification matters. Use `max` for hard problems, and test it first, since it can overthink." Fable: "suited to long autonomous sessions and ambiguous problems such as root-cause investigations and architecture decisions. Describe the outcome rather than the steps." — [Model config](https://code.claude.com/docs/en/model-config)
- "Sonnet handles most coding tasks well and costs less than Opus. Reserve Opus for complex architectural decisions or multi-step reasoning... For simple subagent tasks, specify `model: haiku`." Use Sonnet for agent-team teammates. — [Costs](https://code.claude.com/docs/en/costs)
- Thinking tokens bill as output; thinking cannot be turned off on Opus 5.5, Sonnet 5.5, Haiku 5.5 or Fable (always extended thinking) - use effort instead of `MAX_THINKING_TOKENS` on adaptive models. — [Costs](https://code.claude.com/docs/en/costs)
- Fallback chains (`--fallback-model sonnet,haiku`, max 3) apply to overload/unavailability only: "Rate-limit, authentication, billing, and request-size errors never trigger a fallback." — [Model config](https://code.claude.com/docs/en/model-config)
- Context hygiene that saves quota: `/clear` between tasks (free) vs `/compact` (a large request); keep CLAUDE.md under ~200 lines and move workflow detail into skills; prefer CLI tools (`gh`) over MCP servers; delegate verbose ops (tests, logs) to subagents; use hooks to pre-filter output; plan mode before big changes. — [Costs](https://code.claude.com/docs/en/costs)
- `/code-review` effort: `low` = fewer, high-confidence findings; medium..max broaden coverage. — [Local code review](https://code.claude.com/docs/en/code-review-local)
- Auto mode's classifier defaults to Sonnet 5. — [Permission modes](https://code.claude.com/docs/en/permission-modes)

### Inferences
- Suggested mapping for a quota-constrained Max seat: planning/architecture/ambiguous debugging = Opus 5.5 high (or Fable 5.2 occasionally); implementation from an approved plan = Sonnet 5.5 medium (`opusplan` automates the split); exploration/log-reading/test-running subagents = Haiku 5.5 low; pre-merge review = Opus 5.5 or Sonnet 5.5 at high in a fresh context; CI review on API credits = Sonnet 5.5 or Haiku 5.5.
- By API list price Opus 5.5 ($4/$20) is only 2x Sonnet 5.5 ($2/$10), a much narrower gap than the 5x of 2025; if subscription weighting follows price, the quota penalty for Opus is modest, and effort level/context size may matter more than model choice. (Subscription weighting per model is not published.)
- Pin model IDs (`claude-opus-5-5`) in automation so an alias retarget does not silently change cost/behaviour.

### Gaps
- How each model/effort level is weighted against Max limits is not published.
- `CLAUDE_CODE_SUBAGENT_MODEL` and fast-mode details were beyond the portion of the model-config page read.
- No independent benchmarks gathered on Opus 5.5 vs Sonnet 5.5 for implementation quality.

---

## 6. Pitfalls of unattended agents

### Takeaway
The main failure modes are (1) quota burn from loops, idle sessions and fan-out, (2) runs stalling or silently denying on permission prompts, (3) auth expiry - the interactive claude.ai login now has a fixed end date that use does not extend, and the macOS Keychain is unavailable in SSH/headless contexts, and (4) blast radius when prompts are disabled. Anthropic's guidance: auto mode or `dontAsk` + allowlists for unattended runs, and `--dangerously-skip-permissions` only inside a container/VM/sandbox runtime as non-root.

### Cited Findings
**Runaway loops / quota exhaustion**
- Session-scoped scheduled tasks "fire on [their] interval even while the session is idle, sending your full context each time"; recurring tasks auto-expire after 7 days specifically to bound forgotten loops. — [Costs](https://code.claude.com/docs/en/costs), [Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)
- Controls: `--max-budget-usd` (stops background work when hit), `--max-turns`, workflow-level timeouts and GitHub concurrency controls ("to avoid runaway jobs"), `claude-code-action` rejects bot actors "which keeps bots from triggering Claude in a loop". — [Headless](https://code.claude.com/docs/en/headless), [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- Auto-fix replies under your GitHub user can trigger comment-driven automation (Atlantis, custom `issue_comment` workflows). — [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- CI won't run on Claude's commits if the action uses the default `GITHUB_TOKEN`. — [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- Rate-limit errors never trigger model fallback; hitting the session/weekly limit blocks all models. — [Model config](https://code.claude.com/docs/en/model-config), [Costs](https://code.claude.com/docs/en/costs)
- Usage credits set to "unlimited" continue spending at API rates past the plan limit. — [support 12429409](https://support.claude.com/en/articles/12429409)

**Permission prompts blocking**
- `-p` runs (v2.1.302+) default to Manual: unapproved calls are denied, not prompted; with a permission host (SDK `canUseTool`, `--permission-prompt-tool`) the run waits indefinitely unless `--permission-prompts none` / `permissions.denyInsteadOfPrompting`. — [Headless](https://code.claude.com/docs/en/headless)
- Desktop scheduled runs and background sessions stall on prompts until you attach and answer; MCP tools marked `requiresUserInteraction` always stall. Cloud sessions can expire while waiting on a connector approval. — [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks), [Agent view](https://code.claude.com/docs/en/agent-view), [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- Auto mode falls back to prompting after 3 consecutive / 20 total classifier blocks. — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- `--allowedTools "Bash"` as a bare entry is dropped in auto mode (classifier evaluates each command); rule syntax matters: `Bash(git diff *)` vs `Bash(git diff*)`. — [Headless](https://code.claude.com/docs/en/headless)

**Auth / keychain / expiry on a headless Mac**
- macOS stores credentials in the Keychain; "When the Keychain rejects the write, such as when it's locked in an SSH session, Claude Code stores your login in `~/.claude/.credentials.json` with file mode `0600` instead." — [Authentication](https://code.claude.com/docs/en/authentication)
- The claude.ai login has an end date: `claude auth status --text` shows "Sign-in ends: between <date> and <date>" (v2.1.318+). "Using Claude Code doesn't extend the login." `claude -p` prints "Warning: this sign-in" on stderr when under 10 days remain. After expiry requests fail with "Login reached its time limit" / "Login expired" until a browser `/login`. — [Authentication](https://code.claude.com/docs/en/authentication)
- "Renewing early matters most for sessions that run unattended. A Remote Control session that outlives the login disconnects until you sign in again. A background session in agent view stops making progress if you have no other saved credential." — [Authentication](https://code.claude.com/docs/en/authentication)
- If another credential exists (e.g. an `ant auth login` profile), requests silently fall over to it "billed to its organization". — [Authentication](https://code.claude.com/docs/en/authentication)
- `claude setup-token` token lasts one year and is model-requests-only (no Remote Control, no claude.ai connectors, not read by `--bare`). — [Authentication](https://code.claude.com/docs/en/authentication)
- Desktop tasks skip runs while the Mac sleeps; background sessions die on shutdown; Remote Control server exits after ~10 min offline. — [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks), [Agent view](https://code.claude.com/docs/en/agent-view), [Remote Control](https://code.claude.com/docs/en/remote-control)

**Safety of `--dangerously-skip-permissions` and sandboxing**
- `bypassPermissions` disables prompts and safety checks including writes to protected paths (`.git`, `.claude`, `.mcp.json`, shell rc files). "Only use this mode in isolated environments like containers, VMs, or dev containers without internet access." Refuses to run as root/sudo outside a recognized sandbox. Deny rules still apply; a few actions (e.g. `rm -rf /` or `~`, explicit ask rules) are never auto-approved. — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- "Always run `--dangerously-skip-permissions` sessions inside a container, a VM, or the sandbox runtime, so that file tools, MCP servers, and hooks are also inside the boundary." — [Sandbox environments](https://code.claude.com/docs/en/sandbox-environments)
- "The sandboxed Bash tool on its own constrains only shell commands, so it is not sufficient for fully unattended runs in either mode." Auto mode "is a per-action control, not an isolation boundary"; isolation is defense in depth for it but "not required the way it is for `--dangerously-skip-permissions`". — [Sandbox environments](https://code.claude.com/docs/en/sandbox-environments)
- Recommended for unattended runs: the preconfigured dev container (default-deny iptables firewall), any container/VM, or `@anthropic-ai/sandbox-runtime` (`srt claude`; Seatbelt on macOS, no extra packages; beta research preview; default-deny network, needs `api.anthropic.com`, `claude.ai`, `platform.claude.com` allowed and write access to project, `~/.claude`, `~/.claude.json`, `/private/tmp`). Docker Sandboxes (microVM) is another option. — [Sandbox environments](https://code.claude.com/docs/en/sandbox-environments)
- "Sandbox isolation reduces the impact of a breach, but it does not eliminate risk. Any approach that allows network egress can still leak data the agent can read." A sandboxed session that can write Claude config paths "can persist hooks, permission rules, or MCP servers that run unsandboxed the next time you launch Claude Code." — [Sandbox environments](https://code.claude.com/docs/en/sandbox-environments)
- Prompt-injection surface: `-p` without `--bare` runs project hooks and connects `.mcp.json` servers with no trust dialog, "even in a folder you've never trusted". Public-repo fork PRs don't receive secrets in GitHub Actions. — [Headless](https://code.claude.com/docs/en/headless), [GitHub Actions](https://code.claude.com/docs/en/github-actions)

### Inferences
- On the Mac mini, run agents under a dedicated non-admin macOS user with only project SSH/GitHub deploy credentials; prefer auto mode + `--permission-prompts none` + explicit allow/deny rules + `sandbox.enabled` over bypass mode; reserve `--dangerously-skip-permissions` for `srt`/container runs.
- Use two credentials deliberately: a 1-year `setup-token` in the launchd job environment for scheduled `claude -p` jobs (survives the interactive login's expiry, avoids Keychain-locked-over-SSH issues), and a full `/login` (renewed by calendar reminder before "Sign-in ends") for Remote Control, `/schedule` and cloud features.
- Add an external watchdog: check `claude -p --output-format json` exit code, `permission_denials`, `total_cost_usd`, and grep stderr for "Warning: this sign-in"; alert on limit errors rather than retrying in a tight loop.
- Keep usage credits off (or tightly capped), keep auto-reload off on the Console org, and set workspace spend limits: these are the only hard dollar stops.
- Prevent macOS sleep at the OS level (Energy settings / `caffeinate`) and enable auto-login + auto-restart after power failure, since background sessions and Desktop tasks do not survive shutdown without manual re-attach. (OS-level advice is mine; not from Anthropic docs.)

### Gaps
- No Anthropic documentation found specifically on launchd/daemon operation or on Keychain access from a LaunchAgent vs LaunchDaemon context.
- The exact lifetime of the interactive claude.ai login ("Sign-in ends") is not stated on the page - only how to read it.
- No collected post-mortems / community incident reports (runaway cost, destructive commands) for 2026; search time was spent on official sources.
- Detailed auto-mode classifier accuracy/failure data not found.
