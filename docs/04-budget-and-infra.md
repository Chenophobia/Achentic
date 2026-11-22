# Budget and infrastructure

## Quota: the real constraint

- Max $100 = 5× Pro: rolling 5-hour limit + weekly all-models limit + separate weekly Fable limit. Anthropic publishes no absolute numbers.
- One pool for everything on the subscription login or `CLAUDE_CODE_OAUTH_TOKEN`: interactive, `claude -p`, background sessions, subagents, cloud sessions, scheduled cloud tasks.
- Parallel work burns quota proportionally. **One agent at a time.**
- Headless use of the subscription is permitted as of Nov 2026. A June 2026 change to meter it separately was paused "for now". Keep auth mode a one-line switch in the wrapper.
- No source measured what one issue-to-PR run costs. Measure it yourself in stage 1 via `/usage`.

## Model per job

| Work | Model, effort | Billed to |
|---|---|---|
| Grilling, spec, tickets, architecture | Opus 5.5, high | Subscription |
| Implementation from ticket | Sonnet 5.5, medium (or `opusplan`) | Subscription |
| Exploration / log-reading subagents | Haiku 5.5, low | Subscription |
| Non-author verdict | Opus or Sonnet, high, fresh process | Subscription |
| Issue triage, nightly digest | Haiku via `claude --bare -p --max-budget-usd` | $20 API |
| Advisory diff review in CI | Sonnet via API key, `--max-turns` | $20 API |
| Bulk non-urgent jobs | Batch API (50% off) | $20 API |

Fable: counts for up to half the weekly limit. Reserve for a rare stuck root-cause hunt.

pstack defaults (Opus xhigh, three-seat panels) assume a far bigger budget. Scale down in `/setup-pstack`. Save `/poteto-mode` for work that needs rigor.

## The $20 API budget

Treat as a second, hard-capped fuel tank that still works when the subscription is locked out.

- Rough arithmetic (not measured): a 150k-in / 5k-out review ≈ $0.35 on Sonnet, ≈ $0.09 on Haiku → about 57 Sonnet or 230 Haiku reviews a month.
- Keep Haiku prompts under 100k tokens to avoid a price step.

Four settings make the cap real:

1. `--bare` — ignores OAuth, uses only the API key. Clean split from subscription jobs.
2. Never export `ANTHROPIC_API_KEY` globally. Scope it to the one job.
3. Extra usage / usage credits: **off**.
4. Console workspace spend limit set, auto-reload off.

**Possible freebie:** since 2026-10-07 Max includes $100/month API credits (link a Console org; no rollover; requests stop when exhausted). Two official pages disagree on whether `claude -p` is covered. Claim, run one small `--bare` job, check the balance.

## Mac mini layout

```text
 Phone ──► GitHub Issues (queue) ◄── gh ── poller (launchd, user: agent)
   │                                          │
   │ Remote Control                           ▼
   └──────────► interactive claude      srt claude -p  (worktree, sandboxed)
                (user: you)                   │ local commits
                                              ▼
                                   wrapper pushes branch, opens PR
                                              │
                         deploy runner on the Mac (user: runner)
                         preview compose → verdict job   (gates: GitHub Actions)
                                              │  you merge
                                              ▼
                         deploy compose (image tag = git SHA) → smoke → rollback
                                              │
                         cloudflared (one tunnel) ──► Cloudflare ──► internet
```

Three separated roles:

| macOS user | Runs | Can touch |
|---|---|---|
| you (admin) | Interactive sessions, Remote Control | Everything |
| `agent` (non-admin) | Poller + `srt claude -p` | Its own worktrees only |
| `runner` (non-admin) | Previews, verdict job, deploys. Deterministic gates run on GitHub-hosted Actions, not here | Docker socket, deploy secrets |

Scheduler: `launchd`, not `/loop` (session tasks expire after 7 days and die with the session).

## Deploys

- Docker Compose under OrbStack or Colima. One compose file per app.
- Push to `main` → runner deploys → smoke test → on failure redeploy previous SHA tag.
- Per-PR compose project for previews.

## Cloudflare tunnel

One named tunnel. `config.yml` order matters — first match wins:

```yaml
ingress:
  - hostname: app.example.com          # production first
    service: http://localhost:3000
  - hostname: "*.example.com"          # previews → local reverse proxy
    service: http://localhost:8080
  - service: http_status:404           # required catch-all
```

- Preview names flat: `pr-123-app.example.com`. Universal SSL covers one subdomain level only.
- Cloudflare Access (Zero Trust free tier) in front of previews and admin tools.

## Guardrails

Threat: prompt injection (issue text, web page, dependency README) reaching an agent with shell on the box that hosts production and holds tunnel credentials.

In order of value:

1. Private repos. Every trigger owner-only.
2. Agent as non-admin user with no read access to your home, `~/.cloudflared`, or prod env files.
3. `srt claude` with egress allowlist; auto mode with prompts denied. **Never** `--dangerously-skip-permissions` on the bare host.
4. Wrapper (outside sandbox) does `git push` / `gh pr create`. Token stays out of the agent's reach.
5. `main` protected server-side with required checks. Agent token has no workflow-file permission.
6. Docker socket + deploy secrets only with the deploy job, triggered only by push to `main`.
7. Any agent PR touching gate config or workflows → `ready-for-human`.
8. Pocock's `git-guardrails-claude-code` hook as extra belt for interactive sessions.

Anthropic's own floor: auto mode is "a per-action control, not an isolation boundary"; the built-in Bash sandbox "is not sufficient for fully unattended runs"; `srt` is a beta research preview. Default Bash sandbox still allows reading `~/.ssh` unless `denyRead` is set.

## Observability

- `claude -p --output-format json` → log `total_cost_usd`, session id, `permission_denials`.
- GitHub mobile notifications for PRs and failed checks.
- Heartbeat to a push-style uptime monitor to catch a dead scheduler.
- Calendar reminder for interactive-login expiry (use does not extend it).

Not researched: backups, secrets management.
