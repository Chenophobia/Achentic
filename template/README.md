# App template

Starting point for a new app that agents will build. TypeScript strict, six deterministic gates, GitHub Actions CI, agent rules.

## Use

1. Copy this folder into a new repository (including `.github/`, `.claude/` and `CLAUDE.md`).
2. Inside the new repo, install the plugins for it: `claude plugin install pstack@cursor-plugins --scope project` and `claude plugin install mattpocock-skills@claude-plugins-official --scope project`. Copying `.claude/settings.json` is not enough; without this step `/pstack:poteto-mode` is an unknown command.
3. `npm ci`
4. `npm run gates` — must print `gates: ok`.
5. Replace `src/` and `test/` with the real app. Keep the configuration.
6. In Claude Code, inside the repo: `/pstack:setup-pstack` (small or medium budget), then `/pstack:create-verification-skill`.
7. On GitHub: protect the default branch and require the `gates` check.

## Gates

`scripts/gates.sh` runs these in order and stops at the first failure.

| Gate | Tool | Fails on |
|---|---|---|
| Typecheck | `tsc --noEmit`, strict settings in `tsconfig.json` | Any type error, unused local or parameter, unchecked index access |
| Lint and format | Biome | Explicit `any`, non-null `!`, high complexity, unformatted code |
| No comments | `scripts/no-comments.sh` | Any comment without a link, tool directive or SPDX header |
| Dead code | knip | Unused files, exports, dependencies |
| Duplication | jscpd | Any copied block of 6+ lines |
| Tests | `node --test` | A failing test |

Each gate was checked against a seeded bad change on 2026-11-22: explicit `any`, a type error, a stray comment, an unused export, a duplicated function and a failing test each made `npm run gates` exit non-zero.

## Notes

- Type assertions (`as X`) are not gated. In the first build an agent used three; a non-author verifier judged each sound.
- TypeScript is pinned to 6.x: knip 5 does not accept TypeScript 7 as a peer.
- Runs TypeScript directly with Node's type stripping (`--experimental-strip-types`, Node 22.6+). No build step.
- The no-comments gate compares compiler output with and without comments, so it sees real comments only, not `//` inside strings. A file containing only types emits nothing and is not checked.
