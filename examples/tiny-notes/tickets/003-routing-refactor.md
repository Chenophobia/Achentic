# Refactor: make the request routing readable at a glance

## Goal
Someone opening `server.js` for the first time can see which routes exist and what each one does without reading the whole request handler top to bottom.

## Done-check (must be able to pass or fail)
- Observable behaviour is unchanged: same status codes and bodies for every route, including unknown paths and bad input.
- The total line count reported by `npm run gates` does not go up.

## Proof wanted
- A test that pins current behaviour, committed before any restructuring.
- `npm run gates` output before and after.
- One or two sentences on what a reader no longer has to hold in their head. If the honest answer is "nothing", revert and say so.

## Constraints
- No new dependencies, no new files outside `test/`.
- Do not edit `scripts/gates.sh` or `scripts/size-budget`.
- Commit locally on a branch named `agent/003-routing-refactor`. Do not push.
