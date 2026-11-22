# 02: Inline tag highlighting

**What to build:** When a note's text contains `#tag`s, render them highlighted inline in the notes list (per spec Implementation Decisions: original typed case preserved inline, no stripping into a separate row). Uses `extractTags` from ticket 01 to find the tags in each note's text at render time.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Saving a note containing `#work` shows `#work` visually highlighted (e.g. styled span) inside the rendered note text
- [ ] A note with multiple tags (`#work #urgent`) highlights all of them
- [ ] Highlighted tag text keeps the exact case the user typed, not the lowercase-canonical form
- [ ] A note with no `#tag` renders exactly as it does today, unchanged

## Comments
