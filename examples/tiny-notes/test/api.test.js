import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";

async function withApp(run) {
  const server = createApp().listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    await run(base);
  } finally {
    server.close();
  }
}

const post = (base, body) =>
  fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("adds, lists and deletes a note", async () => {
  await withApp(async (base) => {
    const created = await (await post(base, { text: "buy milk" })).json();
    assert.equal(created.text, "buy milk");

    const listed = await (await fetch(`${base}/api/notes`)).json();
    assert.deepEqual(listed.map((note) => note.text), ["buy milk"]);

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

test("serves the page", async () => {
  await withApp(async (base) => {
    const html = await (await fetch(base)).text();
    assert.match(html, /Tiny Notes/);
  });
});
