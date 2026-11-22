# Dark mode toggle

## Goal
A visitor can switch Tiny Notes between light and dark appearance, and the choice survives a page reload.

## Done-check (must be able to pass or fail)
On the running app: clicking the toggle changes the page background from light to dark; after reloading the page it is still dark; clicking again returns it to light.

## Proof wanted
- `npm run gates` output, green.
- Evidence from the served page (curl of `/` or a browser check) showing the toggle exists and the stored preference is applied on load.

## Known
- Zero dependencies, no build step. Keep it that way.
- With no stored choice, follow the operating system preference.

## Constraints
- Do not edit `scripts/gates.sh` or `scripts/size-budget`.
- Commit locally on a branch named `agent/001-dark-mode`. Do not push.
