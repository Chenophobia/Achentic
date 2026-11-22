# Delete a note

## Sub-features
- Deleting a note that exists returns `200` and removes it from the list.
- Deleting an id that doesn't exist returns `404` (not exercised by the UI —
  the UI only ever offers a Delete button for notes it just listed).

## How to get to it (user POV)
Each note in the list (`#notes li`) has a **Delete** button next to its
text. Click it.

## Driving it with headless Chrome (CDP)
`node tools/verify/drive.mjs add-delete` (same run as Add a note — it adds a
note first so there's something real to delete).

The script:
1. Finds the `<li>` whose `<span>` text matches the note it just added, and
   clicks that `<li>`'s own `<button>` (never a selector that could hit the
   wrong row if other notes are present).
2. Polls the DOM until that `<li>` is gone (the click triggers the real
   `click` listener, which `fetch`es `DELETE /api/notes/:id` then calls
   `render()`).
3. Screenshots the list after deletion.
4. Confirms via `GET /api/notes` that the note's `id` is no longer present —
   the actual store state, not just the redrawn DOM.

## Gotchas
- Don't assert on list length alone — assert the specific note's `id` is
  gone. A future multi-note scenario would make a bare length check pass for
  the wrong reason.
