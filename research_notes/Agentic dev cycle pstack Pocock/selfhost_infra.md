# Self-hosted home-lab pipeline for AI coding agents on a Mac mini M4 behind Cloudflare Tunnel (state: Nov 2026)

Reading notes for the report writer:
- "Official docs" below means pages fetched directly on 2026-11-21 (code.claude.com, developers.cloudflare.com, coolify.io). Everything from dev.to / personal blogs is anecdotal and marked as such.
- Several items come only from search-result summaries (not the full page); these are marked "(search snippet, not read in full)".
- Budget for this research was ~25 tool calls; Forgejo/Gitea runners, Uptime Kuma details, Playwright smoke tests, Workers/Pages/D1 limits, fine-grained PAT scopes and branch protection were NOT researched from primary sources. They appear only under Gaps / Inferences.

## 1. Orchestration on macOS: how people run Claude Code agents 24/7 on a Mac mini

### Takeaway
The dominant community pattern is "shell script + launchd LaunchAgent + `claude -p`" or "GitHub Actions self-hosted runner installed as a LaunchAgent, triggered by issue labels/comments"; both work on a subscription via a long-lived OAuth token, but launchd has specific macOS traps (PATH, TCC, exit 78 crash loops) and headless OAuth refresh has an open reliability report.

### Cited Findings

**Official Claude Code headless facts (fetched)**
- Non-interactive mode is `claude -p "<prompt>"`; common companions are `--allowedTools`, `--output-format json|stream-json`, `--continue`/`--resume <session_id>`, `--append-system-prompt`, `--json-schema`. Exit code 0 on success, non-zero on failure, so scripts can branch on it — [Claude Code docs: headless](https://code.claude.com/docs/en/headless.md)
- With Claude Code v2.1.302+, `claude -p` runs start in Manual permission mode when nothing sets a mode; in Manual mode a call that needs approval is denied unless a rule/hook approves it — [headless docs](https://code.claude.com/docs/en/headless.md)
- For scheduled/unattended jobs the docs recommend `--permission-prompts none` (v2.1.259+), e.g. `claude -p "Update the dependency pins and run the tests" --permission-mode auto --permission-prompts none`; the persistent equivalent is `permissions.denyInsteadOfPrompting: true`. Denials are listed in `permission_denials` in the JSON result — [headless docs](https://code.claude.com/docs/en/headless.md)
- `--permission-mode dontAsk` denies every call that would otherwise prompt ("useful for locked-down CI runs"); `acceptEdits` auto-approves file writes and common fs commands but other shell commands still need `--allowedTools`/`permissions.allow` — [headless docs](https://code.claude.com/docs/en/headless.md)
- `--output-format json` includes `total_cost_usd` and a per-model cost breakdown (client-side estimates) — [headless docs](https://code.claude.com/docs/en/headless.md)
- `--max-budget-usd` exists as a cap for `-p` runs (mentioned as stopping background work when reached) — [headless docs](https://code.claude.com/docs/en/headless.md)
- `--bare` skips hooks, skills, plugins, MCP, auto memory and CLAUDE.md and "will become the default for `-p` in a future release"; in bare mode Claude Code never reads OAuth credentials or the keychain, so it needs `ANTHROPIC_API_KEY` or `apiKeyHelper`. Implication stated by docs: don't use bare mode for a run that needs hooks, and bare mode does not use the subscription login — [headless docs](https://code.claude.com/docs/en/headless.md)
- Without `--bare`, a `-p` session runs hooks from a project's `.claude/settings.json` and connects servers in its `.mcp.json` "even in a folder you've never trusted" (no trust dialog in `-p`) — [headless docs](https://code.claude.com/docs/en/headless.md)
- SIGTERM to a `claude -p` run exits with code 143, kills the Bash process tree and runs `SessionEnd` hooks; resume later with `--resume` (set `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` to continue the interrupted turn) — [headless docs](https://code.claude.com/docs/en/headless.md)
- Anthropic also documents "self-hosted environments" (a runner + optional autoscaling orchestrator that executes Claude Code cloud sessions on your own Linux or macOS host); the deploy guide warns a self-hosted runner executes arbitrary model-directed code on your infrastructure (search snippet, not read in full; plan availability for individual Pro/Max users not verified) — [self-hosted environments reference](https://code.claude.com/docs/en/self-hosted-environments-reference.md), [deploy guide](https://code.claude.com/docs/en/self-hosted-environments-deploy)

**Subscription billing for headless use (CONFLICTING — verify before relying)**
- Anthropic announced that Agent SDK / `claude -p` usage on subscription plans would draw from a separate monthly "Agent SDK credit" starting June 15, 2026, with amounts Pro $20, Max 5x $100, Max 20x $200 (search snippets of the support article and secondary posts) — [support.claude.com article 15036540](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), [dev.to summary](https://dev.to/vainamoinen/what-anthropics-200-agent-sdk-credit-means-if-you-run-claude-p-in-production-ce2)
- Contradiction: the search result for the current support article (English and Japanese versions) says the change is paused and "for now, nothing has changed" (i.e. `claude -p` still counts against normal subscription limits). The headless docs page fetched on 2026-11-21 contains no mention of an Agent SDK credit — [support article](https://support.claude.com/en/articles/15036540), [headless docs](https://code.claude.com/docs/en/headless.md)

**GitHub Actions self-hosted runner on a Mac (blog, Feb 11 2026, read in full)**
- Setup: runner installed per repo under `~/actions-runner/`, run as a macOS LaunchAgent via `./svc.sh install` / `start`; auth via `claude setup-token` (one-year OAuth token) stored as repo secret `CLAUDE_CODE_OAUTH_TOKEN`; author warns Max/Pro users not to set `ANTHROPIC_API_KEY` — [hdknr blog](https://hdknr.github.io/blogs/posts/2026/02/a8d22576ec3097e23c32dc62ae462283/)
- Triggers: `issues: [labeled]` (label `claude`) and `issue_comment: [created]`; `/claude` = read-only investigation (`--allowedTools Read,Glob,Grep`), `/approve` (requires a "pending approval" label) or `/claude --execute` = execution (`Bash,Read,Write,Edit,Glob,Grep`). An `if:` compares the actor to `github.repository_owner` so only the owner can trigger — [hdknr blog](https://hdknr.github.io/blogs/posts/2026/02/a8d22576ec3097e23c32dc62ae462283/)
- Lessons: LaunchAgents don't load shell profiles → set `PATH` and `HOME` explicitly in the workflow; using `opened` plus `labeled` double-fires (use `labeled` only); keep stderr separate from stdout or JSON parsing breaks; `runner.home` is undefined (derive with `whoami`); secrets must be set per repo; add a monthly health-check workflow running a minimal prompt to catch an expired token; queued jobs wait up to 6 hours if the runner is down — [hdknr blog](https://hdknr.github.io/blogs/posts/2026/02/a8d22576ec3097e23c32dc62ae462283/)
- A July 2026 issue report says headless `claude -p` on macOS can fail with "OAuth session expired and could not be refreshed" while interactive sessions on the same machine keep working; reported open with no maintainer reply (search snippet of a third-party issue mirror; not verified against the GitHub issue) — [claudeissues.com mirror #79685](https://claudeissues.com/issue/79685-headless-claude-p-fails-oauth-session-expired-and-could-not-be-refreshed-while-c)
- claude-code-action issue reports: SDK init failing after a Pro→Max upgrade despite the OAuth token being passed (search snippet) — [anthropics/claude-code-action#1281](https://github.com/anthropics/claude-code-action/issues/1281)

**launchd specifics (dev.to, dated "Jul 11", year not shown; read in full; anecdotal)**
- cron may silently not run on modern macOS; migrate to launchd. Use `launchctl bootstrap gui/$(id -u) <plist>`, `kickstart`, `print`, `bootout` (the `load`/`list` verbs are legacy) — [dev.to: 5 launchd traps](https://dev.to/bokuwalily/5-launchd-traps-i-hit-running-claude-code-automation-247-on-macos-32bi)
- `StartCalendarInterval` has no `*/5` syntax: use `StartInterval` (seconds) or an array of calendar dicts. `Label` needs a dot; `ProgramArguments` must be an array; without absolute `StandardOutPath`/`StandardErrorPath` output is lost — [same](https://dev.to/bokuwalily/5-launchd-traps-i-hit-running-claude-code-automation-247-on-macos-32bi)
- launchd/GUI children get only `/usr/bin:/bin:/usr/sbin:/sbin`; fix by setting `PATH` (incl. `/opt/homebrew/bin`) in the `env` block of `~/.claude/settings.json` (or the plist) — [same](https://dev.to/bokuwalily/5-launchd-traps-i-hit-running-claude-code-automation-247-on-macos-32bi)
- macOS has no `timeout`; `brew install coreutils` gives `gtimeout`. System bash is 3.2 — [same](https://dev.to/bokuwalily/5-launchd-traps-i-hit-running-claude-code-automation-247-on-macos-32bi)
- `last exit code = 78` (EX_CONFIG) crash loop with `KeepAlive` (author saw ~15,000 restarts in 6 days, silently): causes were logs in TCC-protected paths (`~/Documents`, `~/Desktop`) → use `~/Library/Logs/`; unsigned Homebrew bash in shebang → use `["/bin/bash","script.sh"]`; missing `WorkingDirectory` (defaults to `/`). Add `ThrottleInterval` ~30s and periodically check that log mtimes advance — [same](https://dev.to/bokuwalily/5-launchd-traps-i-hit-running-claude-code-automation-247-on-macos-32bi)
- With `KeepAlive` as a dict using `SuccessfulExit = false`, launchd will not restart an agent that exits 0 (search snippet) — [dev.to: crash-tolerant agent with launchd](https://dev.to/whoffagents/how-to-build-a-crash-tolerant-ai-agent-with-launchd-on-macos-454)
- Claude Code's in-session `/loop` is unsuitable for 24/7 work because recurring tasks "automatically expire 7 days after creation"; guide uses launchd plists in `~/Library/LaunchAgents/` plus `pmset` to prevent sleep (search snippet) — [christopheralarcon.com](https://christopheralarcon.com/blog/run-claude-code-24-7-on-a-mac-mini/)
- Minimal open-source example of the pattern "each agent = one .sh with a prompt + one .plist with a schedule" (search snippet) — [raulriera/macpilot](https://github.com/raulriera/macpilot)

**Issue-queue agent loops (community repos; search snippets only unless noted)**
- `loope`: watches one repo for issues with an `ai-agent` label and runs headless Claude Code sessions in git worktrees until they become a PR; tracks state with labels; needs `gh` and a logged-in `claude` — [ngthluu/loope](https://github.com/ngthluu/loope)
- Other similar projects surfaced: `superlooper`, `claude-code-runner`, `owl-claw`, Ralph for Claude Code (loop harness) — [willprout/superlooper](https://github.com/willprout/superlooper), [ericvtheg/claude-code-runner](https://github.com/ericvtheg/claude-code-runner), [YaminT/owl-claw](https://github.com/YaminT/owl-claw), [frankbria/ralph-claude-code](https://cdn.jsdelivr.net/gh/frankbria/ralph-claude-code@main/README.md)
- A July 2025 design guide ("Autonomous Claude Code on Mac Mini with GitHub Issue Control") proposes: dedicated `claude-agent` macOS user created with `dscl`, `pmset -a sleep 0`, a LaunchDaemon with `RunAtLoad`+`KeepAlive` running a Node supervisor, a webhook server (port 8080) verifying `x-hub-signature-256`, `@claude <action>` in the issue body as trigger, per-issue dirs `/tmp/claude-tasks/issue-<n>`, max 4 parallel tasks, 6-hour max runtime, results posted as issue comments. CAUTION: it is an untested sketch — it invokes `claude --headless --no-interactive` (flags that do not match the documented CLI, which uses `-p`), stores `ANTHROPIC_API_KEY` in the plist in plaintext, and its supervisor code contains a variable-shadowing bug — [script-kit claude-research](https://script-kit.github.io/claude-research/docs/deployment/autonomous-mac-mini)
- Operational anecdotes: autonomous runs burn usage limits faster than interactive use; scheduled setups should use scoped work with limited blast radius; one self-reported API spend of ~$5/day for a 24/7 agent (search snippets, single-author claims) — [dev.to suzu](https://dev.to/suzu/how-i-run-claude-code-247-on-a-2015-macbook-the-framework-that-survived-6-months-296n), [dev.to joeytbuilds](https://dev.to/joeytbuilds/how-i-run-an-ai-agent-247-on-a-mac-mini-the-full-setup-2cd2)

### Inferences
- Two viable zero-cost orchestrators for a solo dev: (a) GitHub Actions self-hosted runner as LaunchAgent (free minutes on your own hardware, event-driven by labels/comments, logs in the GitHub UI, natural fit with required status checks); (b) a launchd-scheduled poller script (`gh issue list --label agent-ready` → `git worktree add` → `claude -p` → `gh pr create`). (a) gives the phone-friendly trigger and audit trail for free; (b) avoids GitHub Actions entirely and is simpler to sandbox.
- Because a LaunchAgent (per-user, `gui/<uid>` domain) needs a logged-in GUI session, an always-on Mac mini needs auto-login for the agent user (or a LaunchDaemon with `UserName`), plus `pmset` sleep disabled — consistent with the 2025 guide, but keychain-stored OAuth credentials may be unavailable to a daemon without a login session, which is one plausible reason people prefer `CLAUDE_CODE_OAUTH_TOKEN` env auth for unattended runs (inference, not sourced).
- Since `--bare` is slated to become the `-p` default and bare mode ignores OAuth, subscription-based unattended pipelines may need an explicit opt-out once that lands; pin the Claude Code version and watch release notes.
- The "investigate read-only → human `/approve` → execute" two-phase pattern from the hdknr blog is a cheap human gate that also works from a phone.

### Gaps
- Forgejo/Gitea + act_runner on macOS was not researched; no sources collected.
- No verified, end-to-end, 2026-dated reference repo combining launchd + issue queue + worktrees + Cloudflare previews was read in full (loope looked closest but only its snippet was seen).
- Whether the Agent SDK credit is active in Nov 2026 is unresolved (sources conflict). Must be checked at support.claude.com/en/articles/15036540 before designing around subscription headless usage.
- Current status of the macOS headless OAuth-refresh failure is unknown.
- Whether Anthropic "self-hosted environments" (cloud sessions routed to your own Mac) and "routines"/scheduled cloud agents are available on individual Pro/Max plans was not verified.
- tmux-based persistent-session setups were not specifically sourced (only implied by the channels docs' "background process or persistent terminal").

## 2. Task intake: prompting an idea from a phone so it lands as work

### Takeaway
There are three practical zero-cost intake paths: GitHub Issues from the GitHub mobile app (label/comment triggers a runner), Claude Code Channels (official Telegram/Discord/iMessage bridge into a running local session — still research preview), and Remote Control (drive a local session from the Claude mobile app); issues are the most durable queue, channels the lowest-friction chat.

### Cited Findings
- Channels: "an MCP server that pushes events into your running Claude Code session"; Telegram, Discord and iMessage plugins are included; status is research preview ("`--channels` flag syntax and protocol contract may change"); requires claude.ai or Console API-key auth; Pro/Max/Ultra users without an org can opt in per session — [Claude Code docs: channels](https://code.claude.com/docs/en/channels.md)
- Events only arrive while the session is open, "so for an always-on setup you run Claude in a background process or persistent terminal" — [channels docs](https://code.claude.com/docs/en/channels.md)
- Telegram setup: BotFather token → `/plugin install telegram@claude-plugins-official` → `/telegram:configure <token>` (saved to `~/.claude/channels/telegram/.env`) → `claude --channels plugin:telegram@claude-plugins-official` → pair with code → `/telegram:access policy allowlist`. Plugins require Bun — [channels docs](https://code.claude.com/docs/en/channels.md)
- iMessage channel is macOS-only, reads `~/Library/Messages/chat.db` (needs Full Disk Access for the launching terminal) and replies via AppleScript; texting yourself works with no setup — [channels docs](https://code.claude.com/docs/en/channels.md)
- Security: sender allowlist via pairing; anyone on the allowlist who can reply can also approve/deny tool use if the channel declares permission relay; a server must be named in `--channels` (being in `.mcp.json` is not enough) — [channels docs](https://code.claude.com/docs/en/channels.md)
- Unattended caveat: if Claude hits a permission prompt while you're away, the session pauses unless the channel relays prompts; docs say `--dangerously-skip-permissions` bypasses most prompts "but only use it in environments you trust". With `-p`, tools needing terminal input are disabled — [channels docs](https://code.claude.com/docs/en/channels.md)
- A webhook-receiver channel can be built (CI, error tracker, deploy pipeline events pushed into the session); custom channels need `--dangerously-load-development-channels` during the preview because `--channels` only accepts the Anthropic-maintained allowlist — [channels docs](https://code.claude.com/docs/en/channels.md), [channels reference](https://code.claude.com/docs/en/channels-reference.md)
- Official comparison: Remote Control = "you drive your local session from claude.ai or the Claude mobile app"; cloud sessions = fresh cloud sandbox cloned from GitHub for async work; Claude in Slack spawns a cloud session from an @mention — [channels docs](https://code.claude.com/docs/en/channels.md)
- Channels launched March 20, 2026 with Telegram and Discord; iMessage followed about a week later (secondary sources, search snippet) — [VentureBeat](https://venturebeat.com/orchestration/anthropic-just-shipped-an-openclaw-killer-called-claude-code-channels), [MacStories](https://macstories.net/stories/first-look-hands-on-with-claude-codes-new-telegram-and-discord-integrations)
- Community author's view of the trade-off: "full remote capability, or permission safety. Not both." (search snippet) — [dev.to ji_ai](https://dev.to/ji_ai/claude-code-channels-vs-openclaw-the-tradeoffs-nobodys-talking-about-2h5h)
- GitHub-issue intake from iPhone: write an issue in the GitHub mobile app, add the `claude` label (or comment `/claude`), runner on the Mac investigates and replies as a comment; `/approve` executes — [hdknr blog](https://hdknr.github.io/blogs/posts/2026/02/a8d22576ec3097e23c32dc62ae462283/)
- Third-party Telegram bridge predating/alongside channels: `claude-telegram-remote` (v3.5.0 listed May 15, 2026; search snippet) — [oscarsterling/claude-telegram-remote](https://github.com/oscarsterling/claude-telegram-remote)

### Inferences
- Recommended layering: use chat (Telegram/iMessage channel or Claude mobile) only as a front door whose job is to turn an idea into a well-formed GitHub issue (`gh issue create`), and let the issue queue + label be the single source of work. This keeps the durable state in GitHub (survives session restarts, visible on phone) and limits what the chat-attached session is allowed to do (e.g. only `Bash(gh issue *)`), avoiding the "full remote capability vs. permission safety" trade-off.
- A Cloudflare Worker webhook → runner path is possible via `repository_dispatch` or a custom webhook channel, but adds moving parts with no clear benefit over the GitHub mobile app for a solo dev.

### Gaps
- Remote Control docs were not read directly (only the official comparison table row and blog descriptions like "/rc + QR code"); requirements and limits unverified.
- Email-to-issue and Cloudflare Workers webhook → runner setups: no sources collected.
- Whether Claude mobile can start a NEW session on the home Mac (vs. steering an existing one) was not verified.
- Cloud sessions / routines as an alternative intake (Anthropic-hosted) were not researched; they don't run on the Mac mini unless self-hosted environments apply.

## 3. CI/CD for self-hosted apps on the same Mac

### Takeaway
On macOS every container PaaS runs inside a Linux VM: Coolify has an official Colima how-to, Dokploy's installer does not support macOS, and Kamal has been shown to deploy to a Mac mini running OrbStack with two PATH fixes; for a solo dev the lowest-friction route is plain Docker Compose (OrbStack or Colima) driven by the self-hosted runner, with per-PR compose projects for previews.

### Cited Findings
- Coolify publishes a "macOS using Colima" guide: `brew install colima docker`, start a VM (guide's recommended minimum 2 CPU / 2 GB RAM / 30 GB disk, fixed `--ssh-port 2222`, `--save-config`), `colima ssh` and run the normal Coolify installer inside the VM, UI on port 8000; requires Remote Login enabled and an SSH key with no passphrase; bridged vs shared network modes; `brew services start colima` for start at boot. The page does not state an official support level for macOS — [Coolify docs](https://coolify.io/docs/knowledge-base/how-to/macos-colima)
- Coolify also documents exposing all resources through one Cloudflare Tunnel (wildcard hostname → Coolify's proxy) (search snippet, not read) — [Coolify: Access All Resource via Cloudflare Tunnels](https://coolify.io/docs/integrations/cloudflare/tunnels/all-resource)
- Dokploy: third-party summaries say the installer targets Linux (Ubuntu/Debian/CentOS/RHEL) and is not officially supported on macOS; community workaround is running the Dokploy image under Docker Desktop (search snippets; Dokploy's own docs not read) — [answeroverflow thread](https://www.answeroverflow.com/m/1319407679059267686), [community gist](https://gist.github.com/m-jovanovic/d09ef4e0f7c14fa54839bfba51357aeb). Dokploy does have a Cloudflare Tunnels guide — [Dokploy docs](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels)
- Kamal → Mac mini (Jan 27 2026 blog, read in full): M2 Pro Mac mini on macOS Tahoe, Remote Login on, OrbStack as Docker. `kamal setup` initially failed with "docker not available" because Kamal's SSH is non-interactive → fix: `export PATH=/usr/local/bin:$PATH` in `~/.zshenv`; a `cp` incompatibility fixed by `brew install coreutils` and putting `/opt/homebrew/opt/coreutils/libexec/gnubin` first in PATH. Simple app deploys in ~10 s. The post does not cover kamal-proxy, registry, rollback or Cloudflare Tunnel — [erikminkel.com](https://www.erikminkel.com/2026/01/27/deploy-to-mac-mini-with-kamal/)
- Kamal ensures a compatible `kamal-proxy` container is present before deploying (search snippet) — [kamal-deploy.org proxy docs](https://kamal-deploy.org/docs/configuration/proxy/)
- OrbStack: Mac-only, needs macOS 14+, free for personal use (paid for companies); Colima and Podman are free and open source; release notes list v2.2.2 (Aug 2026) with macOS 27 beta compatibility and lower idle CPU (search snippets) — [OrbStack release notes](https://docs.orbstack.dev/release-notes), [starryhope.com](https://www.starryhope.com/mac/orbstack-docker-desktop-mac/)
- Home-server guides recommend OrbStack "start at login" and container restart policies (search snippet) — [machomeserver.com](https://machomeserver.com/2026/01/31/how-to-set-up-orbstack-for-a-mac-mini-home-server/)
- Docker on macOS lacks true `--network=host`; containers reach host services via `host.docker.internal` (search snippet from a Nextcloud PR discussion; OrbStack has its own host-networking doc, not read) — [nextcloud/all-in-one PR #4800](https://github.com/nextcloud/all-in-one/pull/4800), [OrbStack host networking](https://docs.orbstack.dev/docker/host-networking)
- Docker Sandboxes is described by Anthropic's docs as "a free, standalone product from Docker that does not require Docker Desktop", providing a microVM with its own Docker daemon — relevant because agents that need to run `docker compose` can do so inside it rather than against the host daemon — [Claude Code docs: sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)

### Inferences
- Simplest robust design for one Mac: each app = one `compose.yml`; production = `docker compose -p app up -d --build` (or pull a locally tagged image) run by a deploy job on the self-hosted runner after merge to main; preview = same compose file with `-p app-pr-123` and a distinct port or a shared reverse proxy (Caddy/Traefik in a container) routing `pr-123-app.example.com` by Host header; the tunnel's wildcard ingress points at that one proxy. Tear down on PR close.
- Rollback at near-zero cost: tag images by git SHA and keep the previous tag; "rollback" = re-run compose with the prior SHA. Zero-downtime on a single host needs a proxy that health-checks and swaps (this is exactly what kamal-proxy does), which is the main argument for Kamal over raw compose; for personal apps a few seconds of downtime on `compose up -d` is usually acceptable.
- Coolify-in-Colima gives a UI and built-in PR previews but adds a VM-inside-SSH indirection, a no-passphrase SSH key into the Mac, and a second control plane the agent must talk to; that is more attack surface and more to break than runner + compose. Dokploy is a poor fit on macOS.
- The deploy job should run under a different identity/trigger than the coding agent (e.g. only on `push` to protected `main`), so the agent can never deploy unreviewed code.

### Gaps
- No source read in full on PR-preview environments via Cloudflare Tunnel wildcard + compose on macOS; the design above is inference.
- Coolify's preview-deployment feature and its behaviour inside Colima were not verified. Kamal rollback (`kamal rollback`) and zero-downtime details were not read from Kamal docs.
- OrbStack vs Colima performance/idle-resource numbers on M4 not sourced. Apple's native `container` tool was not researched.
- Docker Sandboxes on macOS specifics (requirements, limits) not read.

## 4. Cloudflare specifics: tunnel config for many apps, wildcard ingress, Access, free-tier limits

### Takeaway
One `cloudflared` tunnel with a `config.yml` of hostname→localhost rules (including a single-level wildcard and a mandatory catch-all) is enough for many apps; Zero Trust Free covers Access for up to 50 users at $0, and the main gotchas are certificate depth for nested wildcard hostnames and keeping Access in front of every preview/admin hostname.

### Cited Findings
- `config.yml` needs `tunnel` (UUID) and `credentials-file`; each ingress rule maps `hostname` and/or `path` to a `service` (`http://localhost:PORT`, `ssh://`, `tcp://`, `unix:`, `http_status:404`). "Configuration files that contain ingress rules must always include a catch-all rule that concludes the file" (e.g. `service: http_status:404`) — [Cloudflare docs: tunnel configuration file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- Wildcards: `*.example.com` matches subdomains; "cloudflared does not support wildcards in the middle of the hostname" (e.g. `test.*.example.com` invalid). Rules are matched in order, first match wins (`cloudflared tunnel ingress rule <url>` reports the first matching rule) — [same](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- `path` is a Go regexp; cloudflared forwards the unmodified path. Validate with `cloudflared tunnel ingress validate`. `originRequest` options can be set globally or per rule — [same](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- Recent behaviour changes: path normalization added in cloudflared 2026.10.0 (off by default in 2026.10.0 and 2026.11.0); 2026.11.0+ also strips semicolon path parameters for matching — [same](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- Updating a locally-managed config: start a replica with the new file, then stop the old instance; long-lived connections on the stopped instance drop — [same](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- DNS: each tunnel has a `<UUID>.cfargotunnel.com` target; you create a CNAME per hostname pointing at it (docs), and community guides use a single wildcard CNAME (`*` → tunnel) (search snippets) — [Cloudflare docs: tunnel DNS records](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/), [Coolify tunnel guide](https://coolify.io/docs/integrations/cloudflare/tunnels/all-resource)
- A May 2026 community report says the dashboard's "Add Published Application" form rejected wildcard (`*`) subdomains (search snippet; status in Nov 2026 unknown) — [Cloudflare community, tunnel category](https://community.cloudflare.com/c/zero-trust/cloudflare-tunnel/46)
- TLS depth: Universal SSL covers the apex and one level of subdomain; deeper names such as `a.b.example.com` need a separate certificate (Total TLS / advanced certs) (search snippet of Cloudflare blog) — [Cloudflare blog: Total TLS](https://blog.cloudflare.com/total-tls-one-click-tls-for-every-hostname/)
- Limits: Tunnel account defaults cited in Cloudflare's Tunnels-for-Platforms docs are 50,000 routes per account, 1,000 virtual networks, 25 replicas per tunnel; published applications are limited by configuration size, not the route limit; the API is rate-limited (queue create/delete operations) (search snippet) — [Cloudflare docs: Tunnels for Platforms](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/)
- Zero Trust Free plan: $0, 50-user limit; pay-as-you-go is $7/user/month and charges for every seat once you leave Free (search snippets of Cloudflare pricing pages + community posts) — [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/sase-zero-trust.md), [Cloudflare Access product page](https://www.cloudflare.com/sase/products/access/), [community thread](https://community.cloudflare.com/t/zero-trust-free-hard-0-cap-or-blocked-at-50-seats/976840)
- Cloudflare lists short-lived tunnels for CI/CD and preview environments as an intended use case (search snippet) — [Tunnels for Platforms](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/)
- Cloudflare Pages has an official how-to "Preview local projects with Cloudflare Tunnel" (title only; not read) — [Cloudflare Pages docs](https://developers.cloudflare.com/pages/how-to/preview-with-cloudflare-tunnel/)

### Inferences
- IMPORTANT correction to a search-tool summary: because Universal SSL only covers `example.com` and `*.example.com`, preview hostnames should be FLAT, e.g. `pr-123-myapp.example.com` or `myapp-pr-123.example.com`, not `pr-123.preview.example.com` (a second-level name that would need a paid advanced certificate or Total TLS). This follows from the cited Total TLS blog statement; verify against current Universal SSL docs.
- Suggested layout: one named tunnel run by a LaunchDaemon (`cloudflared service install`), with explicit rules for production apps first, then one wildcard rule `*.example.com → http://localhost:<proxy port>` for previews handled by a local reverse proxy, then the catch-all 404. Order matters because first match wins.
- Prefer a locally-managed `config.yml` in git (reviewable, agent-proposable via PR) over dashboard-managed routes; but do NOT let the coding agent's sandbox write to `~/.cloudflared/` or hold the tunnel credentials file — the deploy job should own it.
- Put one Access application over the preview wildcard and admin tools (Uptime Kuma, Coolify UI, etc.) with a single allow-your-email policy; a solo dev uses 1 of the 50 free seats. Smoke tests from the runner can hit `localhost` directly, or use an Access service token for through-the-edge tests.

### Gaps
- Whether Access self-hosted applications accept wildcard hostnames (e.g. `*-preview.example.com` patterns vs. only `*.example.com`) was not verified from Access docs.
- Access service tokens, free-tier feature limits beyond the 50-seat cap, and log retention on Free were not researched.
- Workers / Pages / D1 / R2 free-tier limits as alternatives for static/edge pieces: not researched; no sources collected.
- Cloudflare ToS constraints on proxying large media through free tunnels were not checked.
- `cloudflared` as a macOS launchd service (install command, log paths) not read from docs.

## 5. Isolation & safety for unattended agents

### Takeaway
Anthropic's own guidance is explicit: the built-in sandboxed Bash tool alone "is not sufficient for fully unattended runs"; `--dangerously-skip-permissions` must only be used inside a container, VM or the whole-process sandbox runtime (`srt claude`), and on macOS the Seatbelt-based sandbox runtime is the no-Docker option; combine this with owner-only triggers, least-privilege tokens and server-side branch protection.

### Cited Findings

**Built-in sandboxed Bash tool (official docs)**
- macOS uses the built-in Seatbelt framework (nothing to install); the sandbox is off by default; enable with `/sandbox` or `sandbox.enabled: true`. Covers Bash/Monitor commands and their child processes only — [Claude Code docs: sandboxing](https://code.claude.com/docs/en/sandboxing.md)
- Default filesystem policy: writes limited to the working directory, per-user temp and added dirs; READS allowed for most of the machine "including `~/.ssh` and `~/.aws/credentials`" unless you add `sandbox.filesystem.denyRead` (docs example: `"denyRead": ["~/"], "allowRead": ["."]`) — [sandboxing docs](https://code.claude.com/docs/en/sandboxing.md)
- Network: all connections go through a local proxy that checks `network.allowedDomains` (starts empty); related keys `deniedDomains`, `strictAllowlist`, `allowLocalBinding`. UDP/QUIC/ICMP can't leave; tools ignoring proxy env vars (plain `ssh`, most DB drivers) can't connect; the proxy does not inspect TLS by default — [sandboxing docs](https://code.claude.com/docs/en/sandboxing.md)
- Non-allowlisted host behaviour by mode: `bypassPermissions` → allowed without prompt; Manual/`acceptEdits` → prompt; Auto → refused unless classifier approves; `dontAsk` → refused — [sandboxing docs](https://code.claude.com/docs/en/sandboxing.md)
- NOT covered by the Bash sandbox: Read/Edit/Write/WebFetch/WebSearch tools (a `denyRead` entry doesn't stop Read; `allowedDomains` doesn't limit WebFetch), hooks, local MCP servers, plugin monitors, LSP servers, status line, `excludedCommands` — [sandboxing docs](https://code.claude.com/docs/en/sandboxing.md)
- Fail-open default: if the sandbox can't start, commands run unsandboxed with a warning unless `sandbox.failIfUnavailable: true` (search snippet of same docs) — [sandboxing docs](https://code.claude.com/docs/en/sandboxing)
- Protected paths (`.claude/settings.json`, `.bashrc`, `.git/hooks`) stay write-denied; Go-based CLIs such as `gh` may fail TLS verification under Seatbelt; Apple Events blocked by default — [sandboxing docs](https://code.claude.com/docs/en/sandboxing.md)

**Choosing an isolation boundary (official docs)**
- "The sandboxed Bash tool on its own constrains only shell commands, so it is not sufficient for fully unattended runs in either mode" (auto or skip-permissions) — [Claude Code docs: sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- "Always run `--dangerously-skip-permissions` sessions inside a container, a VM, or the sandbox runtime"; Claude Code refuses to start with this flag as root on Linux/macOS — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- Auto mode "replaces the prompt with a classifier that reviews actions... a per-action control, not an isolation boundary"; an isolation boundary is defense in depth for auto mode and not strictly required the way it is for skip-permissions — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- Sandbox runtime: `npm install -g @anthropic-ai/sandbox-runtime`, configure `~/.srt-settings.json`, run `srt claude`. Wraps the WHOLE Claude Code process (file tools, MCP servers, hooks) in Seatbelt on macOS with no extra packages; default-denies network and confines writes. It is "a beta research preview" whose config format may change — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md), [anthropics/sandbox-runtime](https://github.com/anthropics/sandbox-runtime)
- Required grants for srt: write to project dir, `~/.claude`, `~/.claude.json`, and `/private/tmp` on macOS; network to `api.anthropic.com` plus `claude.ai` and `platform.claude.com` for OAuth sign-in/refresh — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- srt auto-denies writes to `.git/hooks`, `.git/config` (unless `filesystem.allowGitConfig: true`), `.mcp.json`, `.claude/commands`, `.claude/agents` and shell startup files; on macOS these are checked at write time so nested repos are covered. If no settings file exists it starts anyway with network blocked ("Don't take a clean start as proof your settings loaded") — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- Persistence warning: a sandboxed session that can write Claude Code config paths "can persist hooks, permission rules, or MCP servers that run unsandboxed the next time you launch Claude Code"; review writable paths after unattended runs — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- Dev container: Anthropic publishes an example with a default-deny iptables firewall; "because the firewall blocks unapproved egress, a configuration like this supports running Claude Code with `--dangerously-skip-permissions` for unattended work" — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md), [devcontainer docs](https://code.claude.com/docs/en/devcontainer.md)
- General caveat: "Any approach that allows network egress can still leak data the agent can read, and any approach that mounts your project directory writable can still modify that code" — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)
- Container checklist from docs: review what is mounted writable, what credentials/tokens are reachable inside, and what the egress policy allows — [sandbox environments](https://code.claude.com/docs/en/sandbox-environments.md)

**Self-hosted runner risks (GitHub docs; search snippets)**
- GitHub: self-hosted runners should almost never be used with public repositories, because anyone can open a PR and run code on the machine; self-hosted runners are not ephemeral clean VMs and "can be persistently compromised by untrusted code in a workflow" — [GitHub Docs: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- Mitigations GitHub documents: just-in-time (single-job) runners, runner groups, and being careful with `pull_request_target` — [GitHub Docs: secure use](https://docs.github.com/en/actions/reference/security/secure-use), [securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- Community practice: owner-only `if:` guard on triggers, private repos only, read-only tool list for the first phase — [hdknr blog](https://hdknr.github.io/blogs/posts/2026/02/a8d22576ec3097e23c32dc62ae462283/)
- Dedicated macOS user for the agent (created via `dscl`) and Keychain storage of API keys (`security add-generic-password`) are proposed in the 2025 design guide (untested sketch) — [script-kit claude-research](https://script-kit.github.io/claude-research/docs/deployment/autonomous-mac-mini)
- Worktree-per-issue isolation is the norm in issue-loop tools (loope, Cyrus) (search snippets) — [ngthluu/loope](https://github.com/ngthluu/loope)

### Inferences
- Prompt-injection is the realistic threat for a solo dev: issue text, web pages and dependency READMEs are untrusted input to an agent that has shell access on the same Mac that hosts production apps and the Cloudflare tunnel credentials. The owner-only trigger closes the "stranger files an issue" path but not web/dependency content.
- A layered, near-zero-cost baseline for this Mac: (1) separate non-admin macOS user for agents with its own `~/.claude`, no access to the main user's home, `~/.cloudflared`, or production `.env` files; (2) run `srt claude -p ...` (or a container/Docker Sandbox) with `denyRead ~/` + allow project, and an egress allowlist of api.anthropic.com, claude.ai, platform.claude.com, github.com, registry.npmjs.org; (3) `--permission-mode auto --permission-prompts none` rather than `--dangerously-skip-permissions` where possible; (4) one git worktree per issue; (5) a fine-grained PAT scoped to the specific repos with only contents + pull requests + issues write, no admin/workflows scope; (6) branch protection/rulesets on `main` requiring PR + passing status checks, enforced server-side so no local misbehaviour can bypass it; (7) deploy job triggered only by merge to `main` and holding the only copy of deploy secrets.
- The agent should not be able to modify `.github/workflows/` unreviewed (withholding the PAT's `workflows` permission blocks pushes that touch workflow files), otherwise it can rewrite its own gates or exfiltrate secrets through the self-hosted runner.
- Since Go CLIs like `gh` may fail TLS under Seatbelt, test `gh` inside `srt` early; a fallback is doing git/gh operations in the wrapper script outside the sandbox (agent only edits + commits locally; script pushes and opens the PR), which also keeps the GitHub token out of the agent's reach entirely.
- Docker-socket access equals host-level control of every container (incl. production apps); do not mount the host Docker socket into an agent sandbox — use Docker Sandboxes' private daemon or let only the CI job touch Docker.

### Gaps
- Fine-grained PAT permission specifics, GitHub rulesets/branch protection availability on free private repos, and required-status-check configuration were not researched from GitHub docs (only the permissions page title surfaced). Statements above are inference from general knowledge and should be verified.
- The "Security limitations" section of the sandboxing page was truncated and not read.
- Backups (Time Machine, restic, DB dumps) for a home-lab: no sources collected.
- Secrets-manager options (1Password CLI, sops/age, macOS Keychain with launchd) not researched beyond one Keychain mention.
- No source verified that the sandbox runtime works well with `claude -p` under launchd for a non-GUI user.

## 6. Observability & notifications

### Takeaway
The cheap, proven building blocks are: JSON output from `claude -p` (cost + denials) written to `~/Library/Logs`, Claude Code hooks (Stop/Notification) posting to ntfy or Telegram, ccusage for local token/cost accounting, and a self-hosted uptime monitor with push monitors; no single off-the-shelf project combines them.

### Cited Findings
- `claude -p --output-format json` returns `total_cost_usd`, per-model cost, `session_id`, and (with `--permission-prompts none`) `permission_denials`; `stream-json` emits `system/api_retry` events with error categories such as `rate_limit`, `billing_error`, `authentication_failed`, plus a `system/init` event listing MCP servers/plugins and load errors that a CI gate can fail on — [headless docs](https://code.claude.com/docs/en/headless.md)
- `SessionEnd` hooks run even on SIGTERM; hooks do not run in `--bare` mode — [headless docs](https://code.claude.com/docs/en/headless.md)
- Community notification tools (search snippets): a Stop-hook gist that sends ntfy.sh alerts; `ccnotify` (Stop hooks → Discord, ntfy, macOS notifications); `claude-code-ntfy-notification-hook` (forwards Notification events to an ntfy topic); a guide pairing self-hosted ntfy with Tailscale via `NTFY_URL` — [gist iboss-ptk](https://gist.github.com/iboss-ptk/3c036277237f4e483447a9f450244e58), [ccnotify](https://www.pkgstats.com/pkg:ccnotify), [PyPI claude-code-ntfy-notification-hook](https://pypi.org/project/claude-code-ntfy-notification-hook/), [dev.to felipeelias](https://dev.to/felipeelias/perfect-claude-code-notifications-setup-with-tailscale-and-ntfy-1ii1)
- ccusage reads token cost from local Claude Code logs; a separate tool `ccwatch` targets subscription-limit alerts (search snippet) — [PyPI ccwatch](https://pypi.org/project/ccwatch/)
- Uptime Kuma supports ntfy as a notification provider and has push-type monitors; `notify-me` is a CLI that pushes status to a Kuma push monitor (search snippet) — [rwxd/notify-me](https://github.com/rwxd/notify-me)
- Channels can double as a notification path: Claude replies through Telegram/Discord/iMessage, and a webhook-receiver channel can push CI/deploy/monitoring events into a session — [channels docs](https://code.claude.com/docs/en/channels.md)
- launchd operational check: periodically confirm via `launchctl print gui/$(id -u)/<label>` (state, runs, last exit code) and that log mtimes advance, to catch silently dead jobs — [dev.to: 5 launchd traps](https://dev.to/bokuwalily/5-launchd-traps-i-hit-running-claude-code-automation-247-on-macos-32bi)
- Monthly token-expiry health-check workflow (minimal prompt) as an early-warning — [hdknr blog](https://hdknr.github.io/blogs/posts/2026/02/a8d22576ec3097e23c32dc62ae462283/)

### Inferences
- Minimal stack: wrapper script captures `claude -p --output-format json` to a per-run file, extracts `total_cost_usd`/exit status with `jq`, and `curl`s a one-line summary + PR link to an ntfy topic (or Telegram bot); a heartbeat curl to an Uptime Kuma push monitor at the end of each scheduler tick detects a dead loop. All free.
- Because GitHub already sends mobile push notifications for PRs, comments and failed workflow runs, a solo dev can get most of the notification value with zero extra infrastructure by making the agent report via issue/PR comments.
- If ntfy is self-hosted behind the tunnel, it cannot sit behind Access with an interactive login (the phone app needs to reach it); use ntfy's own auth/tokens or the public ntfy.sh with an unguessable topic.
- Post-deploy smoke test: a Playwright (or plain `curl`) check in the deploy job against `localhost` and against the public hostname; on failure, redeploy the previous image tag and notify.

### Gaps
- ccusage's current feature set/flags (2026) not read from its docs; Pushover not researched.
- Uptime Kuma on macOS/OrbStack, and Playwright post-deploy smoke-test write-ups: no sources read.
- Claude Code's OpenTelemetry/usage-dashboard options for individuals were not researched.
- No source quantifies subscription usage consumed by a typical issue-to-PR run.

## 7. Free/cheap deterministic quality gates that reduce reliance on LLM review

### Takeaway
Community "quality-gate" recipes for agent-written TypeScript converge on one script whose exit code is decided only by deterministic tools (typecheck, Biome or ESLint, knip, jscpd, tests), run both in a pre-push hook (lefthook) and as required CI checks, with a baseline so only NEW findings block; evidence here is thin and comes from third-party skills/blogs.

### Cited Findings
- Knip builds a module graph from entry points and reports unused files, exports and dependencies; a `@knip/mcp` package lets AI assistants query it; the guide recommends running knip in a lefthook pre-push hook so the push is blocked until unused code is removed (search snippet of a May 2026 blog) — [recca0120 blog](https://recca0120.github.io/en/2026/05/02/knip-dead-code-detector/)
- A Claude Code "ts-quality-gates" skill describes a single gate script where "only deterministic checks decide the exit code", old debt lives in a baseline and does not block while a new finding on a changed line does; it lists `dup/jscpd` among checks, and treats Biome as a replacement for ESLint+Prettier (then add typecheck, knip, jscpd, tests) (search snippet) — [skillsmp: ts-quality-gates](https://skillsmp.com/creators/caliluke/skills/skills-ts-quality-gates)
- A "quality-gates" skill advises never weakening a gate to get CI green ("write code to meet it") and using coverage as a diagnostic with higher targets for patch coverage on new code rather than arbitrary global thresholds (search snippet) — [skills.sh: phrazzld quality-gates](https://skills.sh/phrazzld/claude-config/quality-gates)
- `fallow` appeared as a newer Rust-based tool bundling dead-code/duplication-style analysis with agent skill patterns (search hit only; not evaluated) — [fallow on unpkg](https://app.unpkg.com/fallow@3.37.0/files/skills/fallow/references/patterns.md)
- Claude can itself be used as a cheap piped linter in a script (`git diff main | claude -p "..."`) per the official docs — relevant as a contrast: this consumes model usage, unlike the deterministic gates — [headless docs](https://code.claude.com/docs/en/headless.md)

### Inferences
- Suggested free gate set for a TS web app, ordered by cost: `tsc --noEmit` → Biome (lint+format, `biome ci`) → knip (unused files/exports/deps) → jscpd with a duplication threshold → unit tests with a patch-coverage floor → build + bundle-size budget (e.g. size-limit) → `npm audit --audit-level=high` / osv-scanner → Playwright smoke on the preview URL. All run locally on the Mac runner at no cost.
- Enforce at three layers so the agent gets fast feedback and cannot bypass: (1) Claude Code hooks or a `verify` script the agent is told to run before finishing; (2) lefthook pre-commit/pre-push in the worktree (agents can skip with `--no-verify`, so this is advisory); (3) required status checks on the protected branch (authoritative).
- Protect the gates themselves: treat changes to gate config (`biome.json`, `knip.json`, coverage thresholds, `lefthook.yml`, workflow files) as requiring human review (CODEOWNERS or a CI check that fails when those paths change in an agent PR), since "agent weakens the check to make CI pass" is the commonly cited failure mode.
- LLM review then only needs to cover what tools can't (intent match with the issue, architecture, security logic), reducing subscription usage per PR.

### Gaps
- No primary-source documentation for knip, jscpd, Biome, lefthook, size-limit or audit tools was read in this pass; tool capabilities above the cited snippets are from general knowledge and should be confirmed.
- No empirical data found on how much deterministic gates reduce defects or review load for agent-generated code.
- Non-TypeScript stacks (Python: ruff/mypy/vulture; Go) not covered.
