#!/usr/bin/env node
// Read-only check: is there a tiny-notes instance worth driving on this port?
// Does not start or stop anything.
//
//   node tools/verify/doctor.mjs <port>

const port = process.argv[2];
if (!port) {
  console.error("usage: node tools/verify/doctor.mjs <port>");
  process.exit(1);
}

const base = `http://localhost:${port}`;

try {
  const apiRes = await fetch(`${base}/api/notes`, { signal: AbortSignal.timeout(2000) });
  const body = apiRes.ok ? await apiRes.json() : null;
  const isNotesArray = Array.isArray(body);

  const pageRes = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) });
  const html = pageRes.ok ? await pageRes.text() : "";
  const looksLikeTinyNotes = html.includes("Tiny Notes");

  console.log(`GET /api/notes -> ${apiRes.status} (JSON array: ${isNotesArray})`);
  console.log(`GET /          -> ${pageRes.status} (has "Tiny Notes" markup: ${looksLikeTinyNotes})`);

  const healthy = apiRes.status === 200 && isNotesArray && pageRes.status === 200 && looksLikeTinyNotes;
  console.log(healthy ? `port ${port}: healthy tiny-notes instance` : `port ${port}: NOT a healthy tiny-notes instance`);
  process.exit(healthy ? 0 : 1);
} catch (err) {
  console.log(`port ${port}: not reachable (${err.message})`);
  process.exit(1);
}
