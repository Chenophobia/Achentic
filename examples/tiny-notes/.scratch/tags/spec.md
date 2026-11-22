Status: ready-for-agent

## Problem Statement

Notes pile up with no way to group related ones. Finding "everything about work" means scrolling and reading every note. There's also no way to label a note faster than typing it out while jotting the note down — any tagging step that interrupts typing won't get used.

## Solution

Let a note carry one or more `#tag`s written directly in its text — no separate tag field, no picker dialog, just type `#work` inline while writing the note. Known tags autocomplete as you type `#`, so reusing a tag is near-zero extra effort. A Tag Bar lists every distinct Tag in use; clicking one narrows the note list down to just notes containing it, clicking it again clears the filter. The active filter is reflected in the URL so reload/back/share preserve it.

## User Stories

1. As a note-taker, I want to write `#work` directly in a note's text, so that tagging costs no extra step beyond typing.
2. As a note-taker, I want to put more than one tag on a note (`#work #urgent`), so that a note can belong to more than one group.
3. As a note-taker, I want `#Work` and `#work` treated as the same Tag, so that casing slips don't fragment my tags.
4. As a note-taker, I want tags restricted to letters/numbers/dash/underscore, so that a trailing word in a sentence isn't mistaken for part of the tag.
5. As a note-taker, I want to see my tags highlighted inline in the note once saved, so that I can confirm the tag was recognized without hunting for it.
6. As a note-taker, I want a dropdown of my existing tags to appear when I type `#`, so that I can finish a tag in one click instead of retyping it.
7. As a note-taker, I want a Tag Bar showing every distinct Tag across all notes, so that I can see what groups exist without reading every note.
8. As a note-taker, I want to click a Tag (in the Tag Bar or inline in a note) and see only notes containing it, so that I can find everything about a topic at once.
9. As a note-taker, I want to click the active Tag again to return to all notes, so that clearing a filter is as easy as setting one.
10. As a note-taker, I want a clear message when a filtered view has zero notes ("No notes tagged #foo"), so that I'm not confused by an empty list.
11. As a note-taker, I want the active filter reflected in the URL (`?tag=work`), so that reloading, going back, or sharing a link preserves what I was looking at.
12. As a note-taker, I want tagging to add no new dependency or build step, so that the app stays the zero-dependency, no-build tool it already is.

## Implementation Decisions

- **New pure module** (highest-seam, per [[ADR 0001]](../../docs/adr/0001-tags-derived-from-note-text.md)): a dependency-free module exposing `extractTags(text)` (returns distinct, lowercase-normalized tag names matching `#[a-zA-Z0-9_-]+`, stripped of the `#`) and `noteHasTag(note, tag)`. No DOM, no server — directly unit-testable with `node:test`, same pattern as the existing API test.
- **No stored `tags` field and no new API endpoints.** Per [[ADR 0001]], a note's Tags are always derived from its `text` on demand. `GET /api/notes` keeps returning the full, unfiltered list exactly as today; filtering, the Tag Bar, autocomplete suggestions, and inline highlighting are all computed client-side from that one response.
- **Single active filter.** Exactly one Tag can be active at a time — no multi-tag AND/OR in this pass. Clicking any Tag instance (Tag Bar or inline) sets it as the active filter, replacing whatever was active; clicking the currently-active Tag again clears it.
- **URL as the filter's state carrier**: the active filter is read from `location.search` (`?tag=work`) on load and written via `history.pushState`/`replaceState` on every Tag click — no client router added.
- **Display convention**: the Tag Bar shows the lowercase-canonical form of each distinct Tag (so `#Work` and `#work` collapse to one Tag Bar entry); inline occurrences inside a note's rendered text keep whatever case the user originally typed.
- **Autocomplete source**: the dropdown shown after typing `#` in the note input is built from the same `extractTags` output applied across all currently-loaded notes — no separate tags index or endpoint.

## Testing Decisions

- Good tests here assert externally-observable behavior, not internals: given input text, what tags come out; given a note and a tag, does it match. No DOM, no mocking.
- `extractTags` and `noteHasTag` get direct unit tests in `node:test` — covering multi-tag notes, case-insensitivity, charset boundaries (tag stops at whitespace/punctuation), and no-tag text.
- Prior art: `test/api.test.js` already exercises `store.js`/`server.js` behavior end-to-end with no mocking; the new module follows the same "test real behavior through the real seam" philosophy, just at the pure-function level since this logic has no HTTP surface.
- The client-side DOM wiring (rendering, Tag Bar clicks, autocomplete dropdown, URL updates) has no automated test coverage, consistent with the current app: `public/index.html`'s existing render/submit logic isn't under test today either, and adding a browser test harness would be a new dependency this project avoids.

## Out of Scope

- Multi-tag filtering (AND/OR across more than one active Tag)
- Renaming or merging tags after the fact
- Removing a tag from a note other than by editing the note's text (there is no note-edit feature yet at all)
- Any tag-based sort order, tag colors/icons, or tag management screen

## Further Notes

- Seam choice (one new pure module, zero API/server changes) was proposed and not objected to before ticket breakdown started; flagging here in case that's not actually settled.
- See [[GLOSSARY.md]](../../GLOSSARY.md) for canonical terms: Tag, Active Filter, Tag Bar.
