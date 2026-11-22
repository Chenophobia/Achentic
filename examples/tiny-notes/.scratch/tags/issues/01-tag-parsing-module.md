# 01: Tag-parsing module

**What to build:** A pure, dependency-free module exposing `extractTags(text)` and `noteHasTag(note, tag)`, per the spec's Implementation Decisions and [[ADR 0001]](../../../docs/adr/0001-tags-derived-from-note-text.md). `extractTags(text)` returns the distinct Tags in a string of note text (matching `#[a-zA-Z0-9_-]+`, `#` stripped, lowercase-normalized, deduped). `noteHasTag(note, tag)` reports whether a note's text contains a given Tag. No DOM, no server, no stored `tags` field — this is the single seam everything else in the feature builds on.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `extractTags` returns `[]` for text with no `#tag`
- [ ] `extractTags` returns all distinct tags for text with multiple tags (e.g. `"#work #urgent"` → `["work", "urgent"]`)
- [ ] `extractTags` is case-insensitive: `"#Work"` and `"#work"` both normalize to `"work"` and dedupe as one tag
- [ ] `extractTags` stops a tag at the first whitespace/punctuation character outside `[a-zA-Z0-9_-]`
- [ ] `noteHasTag` returns true/false correctly for a note's text against a given tag, case-insensitively
- [ ] Covered by `node:test` unit tests, following the no-mocking style of `test/api.test.js`

## Comments
