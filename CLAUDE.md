# Achentic

This repository is the tooling for an agentic development cycle: an orchestrator script that walks tickets through build, gates and a non-author verdict; sensors that watch live apps; a template for new app repositories. It is not an app itself.

Map: [README.md](README.md). How it works: [docs/00-crash-course.md](docs/00-crash-course.md).

## When asked to set up this machine

Follow [setup/SETUP.md](setup/SETUP.md) from the top. Start by running `sh setup/doctor.sh` and reading its output; it tells you what is missing. Do not skip ahead.

## When asked to start a new project

Run `sh setup/new-project.sh <name>`. It creates `~/work/<name>` from `template/`, installs both plugins for it, runs the gates and makes the first commit. Then help write the first ticket from `tickets/TEMPLATE.md`.

## When asked how things are going

Run `sh setup/status.sh` and summarise it. The same picture, with every ticket's full history, is the mission control page: `node mission-control/server.mjs`, then http://localhost:4400. Log locations are in the last section of `setup/SETUP.md`.

## Limits that hold in every session here

- Never type, generate or store a password, a login token or an API key. The person creates the Claude token, the GlitchTip token and every account, and pastes secrets into files themselves. Tell them which file.
- Never run `sudo`. Print the exact command and let the person run it.
- Never push, merge or deploy unless asked for that specific action.
- Check `claude auth status` shows the personal account before any headless run. A work login must not be used for this.
- Do not edit `template/scripts/`, `template/biome.json`, `template/tsconfig.json` or `template/knip.json` to make something pass. Those are the gates.

## Working on this repository itself

- Plain Node 22, no dependencies, `.mjs`. No comments in code under `orchestrator/` and `sensors/`.
- Tests: `node --test orchestrator/test/*.test.mjs sensors/test/*.test.mjs intake/test/*.test.mjs mission-control/test/*.test.mjs`. They must pass before a commit.
- A change to the orchestrator or a sensor needs a test that fails without it.
- Record what was run and what happened in `docs/05-unverified.md`, with what it did not prove.
