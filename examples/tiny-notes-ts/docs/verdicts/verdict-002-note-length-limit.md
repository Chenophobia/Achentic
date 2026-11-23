All processes stopped, port down.

## Verifier report — `agent/002-note-length-limit`

Goal: user cannot save note >280 chars, sees live remaining counter.

**Ran**
- `sh scripts/gates.sh` → green. typecheck strict, lint/format, no-comments, knip, jscpd (0 clones), tests 8/8 pass (includes 2 new: 281 rejected, 280 accepted).
- `node tools/verify/drive.mjs all` → all 4 features PASSED (add-delete, dark-mode, **length-limit**, resilience). Each self-tore-down its server + chrome.
- `length-limit` flow proved on real headless Chrome + real server: input clamped 281→280, counter read `"0 characters left"`, `POST 281 → 400` body `{"error":"text must be at most 280 characters"}`, 281-char note not stored, `POST 280 → 201` and stored. Screenshots written to evidence dir.
- Adversarial API runs author did not make (live server on :3999):

| case | result | correct? |
|---|---|---|
| 281 non-space | 400 | yes |
| 280 + trailing space(s) (raw 281/282, trims→280) | 201 | yes — spec: limit counts post-trim |
| 141 emoji = 282 UTF-16 units | 400 | yes |
| 140 emoji = 280 UTF-16 units | 201 | yes |
| whitespace-only 300 | 400 (text required) | yes |

  Final list: 0 notes stored >280. Trim-before-length-check matches ticket "Known". Front-end `maxlength` and back-end `.length` both count UTF-16 code units → they agree, no split-brain between clamp and API.

**Findings**
- Code clean vs CLAUDE.md. No `any`, no `!`, no comments, no enums. Validation sits at the boundary (`createNote`), business path trusts trimmed string. Order correct: empty-check → length-check → store.
- `MAX_NOTE_LENGTH = 280` lives in both `src/server.ts` and inline script in `index.html`. Separate runtimes (server TS vs browser), jscpd clean, ticket says 280 is fixed with no setting. Not a shared-source violation.
- **No type assertions or escape hatches added to product code.** New test assertions (`as Note`, `as { error: string }`) match the file's existing style and narrow known-shape JSON responses — sound.

**Could not check**
- Screenshots captured but not OCR'd; counter text verified via live DOM `textContent` read (authoritative), so no gap.
- No concurrency/load testing — out of ticket scope.

No process left running (port 3999 down: `000`; driver features self-cleaned).

VERDICT: PASS
