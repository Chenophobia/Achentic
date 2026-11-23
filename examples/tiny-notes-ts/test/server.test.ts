import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/server.ts";
import type { Note } from "../src/store.ts";

async function withApp(run: (base: string) => Promise<void>): Promise<void> {
  const server = createApp().listen(0);
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("expected a network address");
  const base = `http://localhost:${address.port}`;
  try {
    await run(base);
  } finally {
    server.close();
  }
}

const post = (base: string, body: unknown) =>
  fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("adds, lists and deletes a note", async () => {
  await withApp(async (base) => {
    const created = (await (await post(base, { text: "buy milk" })).json()) as Note;
    assert.equal(created.text, "buy milk");

    const listed = (await (await fetch(`${base}/api/notes`)).json()) as Note[];
    assert.deepEqual(
      listed.map((note) => note.text),
      ["buy milk"],
    );

    const removed = await fetch(`${base}/api/notes/${created.id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/notes`)).json(), []);
  });
});

test("rejects an empty note", async () => {
  await withApp(async (base) => {
    assert.equal((await post(base, { text: "   " })).status, 400);
  });
});

test("rejects a note longer than 280 characters", async () => {
  await withApp(async (base) => {
    const res = await post(base, { text: "a".repeat(281) });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(typeof body.error, "string");

    const listed = (await (await fetch(`${base}/api/notes`)).json()) as Note[];
    assert.deepEqual(listed, []);
  });
});

test("accepts a note of exactly 280 characters", async () => {
  await withApp(async (base) => {
    const res = await post(base, { text: "a".repeat(280) });
    assert.equal(res.status, 201);
    const created = (await res.json()) as Note;
    assert.equal(created.text.length, 280);
  });
});

test("responds 400 to invalid JSON and keeps serving after", async () => {
  await withApp(async (base) => {
    const bad = await fetch(`${base}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nope",
    });
    assert.equal(bad.status, 400);

    const after = await fetch(`${base}/api/notes`);
    assert.equal(after.status, 200);
  });
});

test("responds 4xx to GET // and keeps serving after", async () => {
  await withApp(async (base) => {
    const bad = await fetch(`${base}//`);
    assert.equal(bad.status >= 400 && bad.status < 500, true);

    const after = await fetch(`${base}/api/notes`);
    assert.equal(after.status, 200);
  });
});

test("responds 400 to a JSON null body and keeps serving after", async () => {
  await withApp(async (base) => {
    const bad = await post(base, null);
    assert.equal(bad.status, 400);

    const after = await fetch(`${base}/api/notes`);
    assert.equal(after.status, 200);
  });
});

test("responds ok to a health check", async () => {
  await withApp(async (base) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
  });
});

test("responds 404 to an unsupported method on the health path", async () => {
  await withApp(async (base) => {
    const bad = await fetch(`${base}/api/health`, { method: "POST" });
    assert.equal(bad.status, 404);
  });
});

test("serves the page", async () => {
  await withApp(async (base) => {
    const html = await (await fetch(base)).text();
    assert.match(html, /Tiny Notes/);
  });
});
