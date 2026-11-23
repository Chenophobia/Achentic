import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { notify } from "../lib/notify.mjs";

test("posts to the Discord webhook with pings disabled, trims long bodies, never throws", async () => {
  const posts = [];
  let status = 204;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      posts.push(JSON.parse(body));
      res.writeHead(status).end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const discordUrl = `http://127.0.0.1:${server.address().port}/hook`;
  const lines = [];
  const state = { log: (line) => lines.push(line) };

  await notify({ discordUrl }, state, "app 001-x: attempt 1 · gates passed");
  assert.deepEqual(posts[0], { username: "Achentic", content: "**app 001-x: attempt 1 · gates passed**", allowed_mentions: { parse: [] } });

  await notify({ discordUrl }, state, "app 001-x: blocked", `@everyone look\n${"line\n".repeat(30)}`);
  assert.equal(posts[1].content.split("\n").length, 9);
  assert.deepEqual(posts[1].allowed_mentions, { parse: [] });

  status = 404;
  await notify({ discordUrl }, state, "still fine");
  assert.ok(lines.some((line) => line.includes("Discord answered 404")));

  server.close();
  await notify({ discordUrl }, state, "server gone");
  await notify({}, state, "no webhook set");
  assert.equal(posts.length, 3);
  assert.ok(lines.includes("no webhook set"));
});
