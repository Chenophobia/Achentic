# Rebuild Tiny Notes on the TypeScript template

## Goal
Tiny Notes runs from this repository, written in strict TypeScript under this template's gates, and behaves exactly as the reference app does.

## Done-check (must be able to pass or fail)
- `npm run gates` exits 0.
- `node tools/verify/drive.mjs all` passes all three features (add-delete, dark-mode, resilience) against the app in this repository.
- For every route, status code and response body match the reference app, including unknown paths and bad input.

## Proof wanted
- `npm run gates` output.
- `node tools/verify/drive.mjs all` output.
- A side-by-side run of the same requests against the reference app and this one, with any difference listed.

## Known
- The reference app is at `../tiny-notes` (plain JavaScript, zero dependencies). Read it; do not change it.
- `src/` and `test/` currently hold a placeholder greeting sample from the template. Replace it.
- `tools/verify/` was copied from the reference app and starts the app the old way; it must start this app instead.
- No runtime dependencies. No build step: the app runs with Node's type stripping, as `npm start` already does.

## Constraints
- Do not edit `scripts/`, `biome.json`, `tsconfig.json`, `knip.json`, `package.json` devDependencies or `.github/` to get the gates green. If a gate is wrong, stop and say so.
- Do not write under `.claude/`.
- Stop every process you start.
- Commit locally on a branch named `agent/001-rebuild-on-template`. Do not push.
