# Dark mode toggle

## Sub-features
- With no stored preference, the page follows the OS/browser
  `prefers-color-scheme`.
- Clicking **Dark**/**Light** (`#theme-toggle`, in the header) flips
  `document.documentElement.dataset.theme` and the button's own label.
- The choice is persisted to `localStorage` (`theme` key) and survives a
  reload.

## How to get to it (user POV)
The toggle button sits in the page header, to the right of the "Tiny Notes"
title. Its label shows the *other* mode (it reads "Dark" while light is
active, and vice versa).

## Driving it with headless Chrome (CDP)
`node tools/verify/drive.mjs dark-mode`

The script:
1. Loads `/`, reads the initial `dataset.theme`, screenshots it.
2. Clicks `#theme-toggle` (its real `click` listener — not setting
   `localStorage` directly) and polls until `dataset.theme` changes.
3. Screenshots the toggled state, then reads `localStorage.getItem("theme")`
   and confirms it matches what's applied on screen.
4. Navigates to `/` again (a real reload, new `Page.navigate` + waiting for
   `Page.loadEventFired`) and confirms the theme is still the toggled one —
   this is the ticket's actual done-check ("after reloading the page it is
   still dark"), not just that the in-memory DOM state didn't get touched.
5. Toggles back and confirms it returns to the original theme, matching
   "clicking again returns it to light."

## Gotchas
- Headless Chrome's default `prefers-color-scheme` is `light`; the "initial
  theme" the script observes is whatever that resolves to with no stored
  preference, not necessarily light in every Chrome build — don't hardcode
  an expected initial value, read it and compare against it.
- A fresh `--user-data-dir` per run means no stale `localStorage` from a
  previous drive leaks in — the "no stored choice" starting state is real,
  not assumed.
