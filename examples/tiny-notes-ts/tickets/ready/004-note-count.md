# Note count in the heading

## Goal
A user sees how many notes there are without counting them.

## Done-check (must be able to pass or fail)
- The page shows the number of notes next to the heading: "0 notes", "1 note", "2 notes".
- The number changes right after a note is added or deleted, without a reload.
- Everything that worked before still works.

## Proof wanted
- `npm run gates` output, green.
- The verify drive script checks the count in the page before adding, after adding and after deleting a note, with a screenshot. `node tools/verify/drive.mjs all` green.

## Known
- The count comes from the notes the page already loads. No new API.

## Constraints
- Do not edit gate or CI configuration.
- Commit locally on the branch `agent/004-note-count`. Do not push.
