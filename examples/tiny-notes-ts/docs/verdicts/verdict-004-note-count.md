Clean — no stray processes, port free.

## Verdict: `agent/004-note-count`

**Goal:** user sees note count next to heading without counting.

**What I ran**
- `sh scripts/gates.sh` → exit 0, 10/10 tests pass, `gates: ok`.
- Reviewed full diff vs `main` (only `public/index.html` + `tools/verify/drive.mjs`).
- Read orchestrator browser evidence `.verify-evidence/orchestrator-drive.txt` → all 4 features PASS, exit 0. Screenshots present (`add-delete-01/02/03.png`).
- My own independent HTTP run (spawned `src/main.ts` on PORT 5599, add/delete via API): len 0→1→2→1 maps to "0 notes"/"1 note"/"2 notes"/"1 note".

**What I found**
- Count logic `${notes.length} ${notes.length === 1 ? "note" : "notes"}` correct for 0/1/n. No off-by-one.
- `render()` fires on load, after POST (submit handler), after DELETE (delete handler). Live update, no reload. Orchestrator confirms DOM read "0 notes" → "1 note" → "0 notes" across add/delete.
- `aria-live="polite"` on `#note-count` — announces changes, sound a11y choice.
- Count sourced from existing `GET /api/notes`, no new API (matches ticket Known).
- Regression check: dark-mode, length-limit, resilience features all still PASS.

**Escape hatches:** none added. No `any`, no `!`, no type assertions, no new deps/files/exports, no comments. Nothing to judge for soundness.

**What I could not check myself**
- Live headless Chrome DOM — sandbox blocks browser (expected). Relied on orchestrator-drive.txt + screenshots (the sanctioned path). Independently verified the data source + format string that feed the DOM.

Done-check met on all three points. Proof-wanted satisfied (gates green, `drive.mjs all` green with count assertions + screenshots).

VERDICT: PASS
