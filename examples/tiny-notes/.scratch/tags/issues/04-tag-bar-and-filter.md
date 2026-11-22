# 04: Tag Bar + click-to-filter

**What to build:** A Tag Bar listing every distinct Tag in use (lowercase-canonical, per spec), built from `extractTags` (ticket 01) applied across all loaded notes. Clicking a Tag — in the Tag Bar, or inline in a note if ticket 02 has landed — sets it as the single Active Filter, narrowing the notes list to only notes containing it (via `noteHasTag`). Clicking the active Tag again clears the filter back to all notes. A filtered view with zero matches shows "No notes tagged #foo".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Tag Bar shows one entry per distinct Tag across all notes, lowercase-canonical, deduped regardless of original typed case
- [ ] Clicking a Tag Bar entry narrows the notes list to notes whose text contains that tag (case-insensitive)
- [ ] Clicking a different Tag while one is already active replaces the filter (single active filter, no AND/OR)
- [ ] Clicking the currently-active Tag again clears the filter, showing all notes
- [ ] A filter with zero matching notes shows a "No notes tagged #foo" message instead of a blank list
- [ ] Adding a new note while a filter is active still works normally, respecting the current filter on re-render

## Comments
