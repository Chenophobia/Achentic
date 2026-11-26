# Agent rules

## Engine

pstack is the engine. Any task that touches code runs through `/pstack:poteto-mode`, which picks the playbook (Feature, Bug fix, Refactoring).

mattpocock-skills are used only when a human types one of these by name:

- `/mattpocock-skills:grill-with-docs`, then `/mattpocock-skills:to-spec`, then `/mattpocock-skills:to-tickets` — turning an idea into tickets
- `/mattpocock-skills:triage` — labelling incoming issues
- `/mattpocock-skills:improve-codebase-architecture` — a report, never edits

Do not use mattpocock-skills for building, testing, reviewing, debugging, prototyping or research. Use the pstack playbook instead.

## Definition of done

1. `npm run gates` exits 0. Never edit `scripts/gates.sh`, `scripts/no-comments.sh`, `biome.json`, `tsconfig.json`, `knip.json` or `.github/` to get there; if a gate is wrong, stop and say so.
2. The ticket's done-check passes on the running app, driven with the project's `verify-<app>` skill, with evidence saved.
3. The report says what was not verified.

## Code

Enforced by gates, listed here so the first attempt passes:

- TypeScript strict. No `any`, no non-null `!`, no enums or other non-erasable syntax.
- No comments. If code needs one, rename or restructure. Exceptions: a line with a link, a tool directive, an SPDX header.
- No unused files, exports or dependencies. No copy-pasted blocks.
- Imports use the `.ts` extension.

## Notes every ticket leaves

The orchestrator names two files in its prompt, under `docs/work/<ticket>/`. Write them; the branch check sends the work back without them.

- `2-design/design.md`, before changing code: what you found, the shapes you considered, the one you chose and why, files you expect to touch, risks.
- `3-build/report.md`, when done: what changed and why, how you proved it, gate failures and how you resolved them, what you could not verify.

## Tickets

Goal, pass/fail done-check, proof wanted, known facts, real constraints. See `tickets/TEMPLATE.md`.

## Limits

Commit locally on the branch the ticket names. Do not push, deploy, delete data, or write under `.claude/`. Stop every process you start.
