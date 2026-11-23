# tiny-notes feature map

One file per user-facing feature. Each answers: what it is, how a user
reaches it, how to drive it with `tools/verify/drive.mjs`, and what to watch
for.

| Feature | File | Drive command |
| --- | --- | --- |
| Add a note | [add-note.md](add-note.md) | `node tools/verify/drive.mjs add-delete` |
| Delete a note | [delete-note.md](delete-note.md) | `node tools/verify/drive.mjs add-delete` |
| Dark mode toggle | [dark-mode-toggle.md](dark-mode-toggle.md) | `node tools/verify/drive.mjs dark-mode` |
| Resilience to malformed requests | [malformed-json-resilience.md](malformed-json-resilience.md) | `node tools/verify/drive.mjs resilience` |

Not mapped: tagging notes (`tickets/idea-tags.md`) — an idea, not implemented.
Add a file here if it ships.

This is the repo's maintained verification source. A proof that only drives
one convenient entry point (e.g. only `add-delete`) is incomplete when the
map lists more — run `node tools/verify/drive.mjs all` for full coverage.
