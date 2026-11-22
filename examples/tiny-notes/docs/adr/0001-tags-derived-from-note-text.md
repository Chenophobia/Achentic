# Derive tags from note text instead of a stored field

A note has no separate `tags` field. A note's [Tag](../../GLOSSARY.md)s are parsed from its `text` wherever they're needed — rendering, building the [Tag Bar](../../GLOSSARY.md), and filtering — using the pattern `#[a-zA-Z0-9_-]+`. We chose this over storing a `tags` array on the note to avoid a second source of truth that could drift from the text, and because the current note model (`store.js`) has no field for it or migration path to add one. Text stays the single source of truth; tags are just what's read out of it.

## Considered Options

- **Stored `tags` array, computed once at note creation**: rejected because any future edit to a note's text would silently desync the stored tags from the `#hashtags` actually written — a bug invisible until an edit feature exists to trigger it.
