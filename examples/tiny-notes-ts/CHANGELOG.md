# Changelog

- Ticket 001: rebuilt Tiny Notes on the strict-TypeScript template (add/delete notes, dark mode, malformed-request resilience).
- Ticket 003: added `GET /api/health`, returning 200 with `{"status":"ok"}`; any other method on that path still returns 404.
