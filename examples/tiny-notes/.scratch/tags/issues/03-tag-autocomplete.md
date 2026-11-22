# 03: Tag autocomplete while typing

**What to build:** Typing `#` in the note input shows a dropdown of existing Tags (derived via `extractTags` from ticket 01, applied across all currently-loaded notes) so a Tag can be finished in one click instead of retyped, per spec User Story 6.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Typing `#` in the new-note input opens a dropdown listing distinct existing Tags across all loaded notes
- [ ] Continuing to type after `#` narrows the dropdown to matching tags
- [ ] Picking a suggestion inserts it into the note text at the cursor, replacing the partial `#...` being typed
- [ ] Typing a `#` for a brand-new tag with no matches shows an empty (or hidden) dropdown, and still lets the user finish typing a new tag freely
- [ ] Dropdown dismisses on blur/escape without blocking note submission

## Comments
