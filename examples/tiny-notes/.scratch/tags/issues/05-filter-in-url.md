# 05: Filter reflected in URL

**What to build:** The Active Filter from ticket 04 is reflected in the address bar as `?tag=work`, read from `location.search` on page load and written via `history.pushState`/`replaceState` on every Tag click, per spec Implementation Decisions (no client router added).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Clicking a Tag updates the URL to `?tag=<name>` without a full page reload
- [ ] Reloading the page with `?tag=work` in the URL restores that Active Filter on load
- [ ] Clicking the active Tag again (clearing the filter) removes `tag` from the URL
- [ ] Browser back/forward navigates between filter states correctly

## Comments
