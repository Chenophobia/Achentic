# Note length limit with a live counter

## Goal
A user cannot save a note longer than 280 characters, and sees how many characters are left while typing.

## Done-check (must be able to pass or fail)
- Posting a note of 281 characters to the notes API returns status 400 with a JSON error and stores nothing; 280 characters returns 201.
- On the page, typing shows the remaining characters (280 at empty, 0 at full), and the page does not let a user submit more than 280.
- Everything that worked before still works.

## Proof wanted
- `npm run gates` output, green.
- A new flow in the verify drive script that types into the page, reads the counter and checks the 281-character rejection, with a screenshot. `node tools/verify/drive.mjs all` green.

## Known
- The limit counts characters after the same trimming the API already applies.
- 280 is fixed. No setting for it.

## Constraints
- Do not edit gate or CI configuration.
- Commit locally on the branch `agent/002-note-length-limit`. Do not push.
