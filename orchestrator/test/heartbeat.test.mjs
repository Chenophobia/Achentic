import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { beat } from "../lib/heartbeat.mjs";

test("heartbeat reports the result, keeps the token path, and never throws", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(req.url);
    res.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/push/token123`;
  assert.equal(await beat(base, "review"), true);
  assert.deepEqual(seen, ["/api/push/token123?status=up&msg=review"]);
  server.close();
  assert.equal(await beat(base, "idle"), false);
  assert.equal(await beat(undefined, "idle"), false);
});
