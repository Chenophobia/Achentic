# Running the agents as their own user, inside a sandbox

Two layers. Each covers what the other cannot.

| Layer | What it limits | Where it stops |
|---|---|---|
| 1. Sandbox (`ACHENTIC_SANDBOX=1`) | Every shell command the builder and the verifier run: writes only inside the app repository and the temp folder, network only to localhost and the npm registry, no reading of key folders | Does not cover the gates and the browser check, which the orchestrator runs itself, outside the sandbox, on code the agent just wrote |
| 2. Separate macOS user | Everything: orchestrator, gates, tests, browser, agents. That user owns no keys, no personal files and has no admin rights | Does not stop the agent from damaging its own clones or using its own Claude login |

Layer 1 is tested. Layer 2 is written and syntax-checked but has not been run: it needs `sudo` on the Mac mini.

## Layer 1: the sandbox

Set `ACHENTIC_SANDBOX=1` for the orchestrator. It then writes a settings file to `$ACHENTIC_HOME/<app>/agent-settings.json` and passes it to every agent run with `--settings`. It uses Claude Code's built-in sandbox (Seatbelt on macOS).

Measured on 2026-11-23, Claude Code 2.1.212, by running a probe script inside a sandboxed agent run:

| Attempt | Result |
|---|---|
| Write inside the repository | Allowed |
| Write to the home folder, or to the folder above the repository | Blocked |
| List `~/.ssh`, `~/.config/gh` | Blocked |
| Query the login keychain | Blocked |
| Reach example.com, github.com | Blocked |
| Reach the npm registry | Allowed |
| Start a server on a local port and call it | Allowed |
| Six gates | Pass |
| Start headless Chrome | Fails |

Because GitHub is unreachable, a `git push` from the agent fails even if it tries.

### The cost: no browser inside the sandbox

Chrome cannot start inside it. The only setting that lets it also opens every local socket, including Docker's, which would hand the agent the machine. So:

- The builder and the verifier are told not to run browser flows. Tests, gates and plain-HTTP flows still run.
- The orchestrator runs the full browser drive after the builder, as before, and saves the output to `.verify-evidence/orchestrator-drive.txt`. A failure goes back to the builder like any other.
- The verifier reads that file instead of driving a browser itself. It loses the ability to try new things in the page; it keeps everything it can do over HTTP.

One real ticket has been through this (note count in the heading, a browser-only feature): the builder wrote the page change and the browser check without being able to run it, the orchestrator's drive passed first time, verdict PASS.

### Also in the settings file

- The Read tool is denied `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, the keychain folder, `~/.netrc` and the Claude credentials file.
- The Edit tool is denied `~/.claude`, so an agent cannot rewrite the pstack playbooks that later runs will read.
- `allowUnsandboxedCommands` is off: a blocked command cannot be retried outside the sandbox.
- `failIfUnavailable` is on: if the sandbox cannot start, the run fails instead of running open.

## Layer 2: the separate user (Mac mini, you run this)

1. Create the user. You choose its password; it is a standard account, not an admin.

   ```sh
   sudo sh setup/agent-user/create-user.sh agent
   ```

   It also creates `~agent/work` for clones and `~agent/.achentic/env` (readable by that user only), and lists any home folder that other users can look into, with the command to close it.

2. Become that user and install what it needs: Node 22, Claude Code, Google Chrome is already system-wide.

   ```sh
   sudo -u agent -i
   ```

3. As that user, clone Achentic and the app repositories into `~/work`, and in each app repository run the two `claude plugin install … --scope project` commands and `npm ci`.

4. As that user, create a long-lived Claude token and put it in the secrets file yourself. The token is shown once; nothing here stores or prints it.

   ```sh
   claude setup-token
   ```

   Then add one line to `~/.achentic/env`: `CLAUDE_CODE_OAUTH_TOKEN=` followed by the token. Optional lines in the same file: `ACHENTIC_NTFY_URL`, `ACHENTIC_HEARTBEAT_URL`, `ACHENTIC_SENSOR_HEARTBEAT_URL`, `ACHENTIC_DAILY_CAP`.

5. Run one ticket by hand as that user before scheduling anything.

   ```sh
   sh ~/work/Achentic/setup/agent-user/run-as-agent.sh orchestrator ~/work/<app>
   ```

6. Back as your own user, install the scheduled jobs. They run as `agent` from the system domain, so nobody has to be logged in.

   ```sh
   sudo sh setup/agent-user/install-daemon.sh agent orchestrator /Users/agent/work/<app>
   sudo sh setup/agent-user/install-daemon.sh agent sensor /Users/agent/work/<app> https://app.example.com
   ```

   Each prints the command that starts it. If Node or Claude Code live somewhere else, pass `NODE_DIR=` and `CLAUDE_DIR=`.

`run-as-agent.sh` turns the sandbox on by default and removes `ANTHROPIC_API_KEY` from the environment, so runs use the subscription token and cannot fall back to paid API use.

## Getting work in and out

The agent user has no GitHub credentials on purpose. It can pull a public repository; it cannot push.

- In: push tickets to GitHub as yourself. The agent's clone needs a `git pull` before a run. That step is not automated yet.
- Out: from your own clone, `git fetch /Users/agent/work/<app> 'refs/heads/agent/*:refs/remotes/agent/*'`, review, merge, push as yourself.

## Not verified

- Everything in layer 2. In particular: whether headless Chrome starts for a user with no login session (the orchestrator's browser drive needs it), and whether Claude Code accepts the token from the environment under launchd.
- The docs give the token a one-year life. Put a reminder in your calendar.
- Sensor tickets are committed in the agent's clone and reach GitHub only when you fetch them.
- The sandbox settings were measured on Claude Code 2.1.212. Newer versions add stricter options; rerun the probe after updating.
