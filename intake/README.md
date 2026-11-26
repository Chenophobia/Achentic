# Intake and progress: GitHub issues in, Discord out

Two things that let you work from anywhere, with no access to the Mac mini:

- **In:** open a GitHub issue on the app's repository, from any browser or the GitHub app. It becomes a ticket.
- **Out:** every step of every ticket is posted to a Discord channel.

```
you, anywhere ── GitHub issue with the label "agent"
                        │  read every 30 minutes, just before the orchestrator
                        ▼
                 tickets/ready/<ID>.md ──► orchestrator ──► branch for you to merge
                        │                              │
                        └──────── Discord channel ◄────┘
     queued · started · building · gates passed · verdict PASS · ready to merge · blocked
```

## Issues in

```sh
node intake/issues.mjs --repo <app-repo> --github <owner>/<name>
```

What one run does:

1. Reads the open issues carrying the label `agent`.
2. Keeps only those opened by an allowed author. By default that is the repository owner alone.
3. For each one not seen before: writes a ticket with the issue's title and text, commits it on the base branch, posts "queued" to Discord.
4. An issue from anyone else is ignored and reported once.

The app template ships an issue form, `.github/ISSUE_TEMPLATE/agent-ticket.yml`, with the ticket's fields (Goal, Done-check, Proof wanted, Known). Opening an issue with that form adds the label by itself. A plain issue with the label works too.

### Why only the owner

On a public repository anyone can open an issue, and an issue form applies its label for them. The text of the issue becomes the builder's task. So the label is not enough: the author must be on the list. Add more people with `--authors login,login` or `ACHENTIC_ISSUE_AUTHORS`.

### Settings

| Variable | Default | Meaning |
|---|---|---|
| `ACHENTIC_GITHUB_REPO` | unset | `owner/name`. When set in the agent's `~/.achentic/env`, the scheduled orchestrator job runs the intake first |
| `ACHENTIC_ISSUE_AUTHORS` | the repository owner | Logins whose issues are accepted, comma-separated |
| `ACHENTIC_ISSUE_LABEL` | `agent` | The label to look for |
| `ACHENTIC_GITHUB_TOKEN` | unset | Needed only for a private repository: a fine-grained token with read access to issues. You create it and paste it into the env file |

A public repository needs no token; GitHub allows 60 unauthenticated reads an hour and this uses two.

The issue stays open. Close it yourself when you merge. Nothing writes back to GitHub.

## Progress out

Set `ACHENTIC_DISCORD_WEBHOOK_URL` in the same env file. Then the orchestrator, the intake and the sensors post one line per event:

```
MA-4 Note count in the heading: queued          Project my-app, from issue #12
MA-4 Note count in the heading: started         Project my-app, branch agent/MA-4
MA-4 Note count in the heading: attempt 1 · building
MA-4 Note count in the heading: attempt 1 · branch checks passed
MA-4 Note count in the heading: attempt 1 · gates failed, sent back to the builder
MA-4 Note count in the heading: attempt 2 · building
MA-4 Note count in the heading: attempt 2 · gates passed
MA-4 Note count in the heading: attempt 2 · browser drive passed
MA-4 Note count in the heading: attempt 2 · verdict PASS
MA-4 Note count in the heading: ready to merge (PASS)
```

A failed step carries the first lines of the reason. Sensors post when they file a ticket, when the app is unreachable and when it recovers.

### Create the webhook (you, once)

1. In your Discord server: the channel's settings → Integrations → Webhooks → New Webhook.
2. Copy the webhook URL.
3. Paste it into the agent's `~/.achentic/env` as `ACHENTIC_DISCORD_WEBHOOK_URL=…`.

The URL is a secret: anyone who has it can post to the channel. Keep it out of every repository. Messages are sent with mentions switched off, so text from a ticket cannot ping `@everyone`.

Uptime Kuma can post to the same channel: in its notification settings choose Discord and paste the same URL.

## Tests

```sh
node --test intake/test/issues.test.mjs orchestrator/test/notify.test.mjs
```

Against a fake GitHub and a fake Discord: owner's issue to one ticket and one post, nothing on the second run, a stranger's issue ignored and reported once, pull requests skipped, token sent when given, GitHub down, repository busy; message format, mentions off, long bodies trimmed, a failing webhook never fails a run.

## What was checked

- All of the above tests.
- The intake against the real GitHub API, read-only, on a public repository with no labelled issues: answered, nothing filed.

Not checked: a real issue turning into a ticket on GitHub, and a real Discord channel receiving posts. Both need things only you can create: the issue and the webhook.
