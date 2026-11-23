# Tiny Notes (TypeScript)

Tiny Notes rebuilt on `template/` by a headless pstack run from one ticket, [tickets/001-rebuild-on-template.md](tickets/001-rebuild-on-template.md). First app built under the six gates.

- `npm ci`, then `npm run gates` — strict types, lint, no comments, dead code, duplication, tests.
- `node tools/verify/drive.mjs all` — drives the running app in headless Chrome; evidence in `.verify-evidence/`.
- Non-author verdict: [docs/verdicts/verdict-001.md](docs/verdicts/verdict-001.md) — PASS.
- Tickets 002 (280-character limit with a live counter) and 003 (health endpoint) were then built and judged by the orchestrator with no hand steps: [tickets/done/](tickets/done), verdicts in [docs/verdicts/](docs/verdicts). Both PASS; 003 passed on its second attempt after a forced gate failure. A human merged the two branches.

Behaviour is identical to the JavaScript original in [../tiny-notes](../tiny-notes).
