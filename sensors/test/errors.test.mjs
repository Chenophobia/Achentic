import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { openState } from "../../orchestrator/lib/state.mjs";
import { collect } from "../lib/errors.mjs";

let server;
let url;
let tracker;

function issue(id, title, extra = {}) {
  return { id, shortId: `NOTES-${id}`, title, culprit: "POST /api/notes", count: "3", firstSeen: `2026-11-2${id}T10:00:00Z`, lastSeen: "2026-11-23T12:00:00Z", status: "unresolved", ...extra };
}

const EVENT = {
  entries: [
    {
      type: "exception",
      data: { values: [{ type: "TypeError", value: "Cannot read properties of null (reading 'text')", stacktrace: { frames: [{ function: "route", filename: "src/server.ts", lineNo: 60 }, { function: "createNote", filename: "src/server.ts", lineNo: 38 }] } }] },
    },
  ],
};

before(async () => {
  server = createServer((req, res) => {
    tracker.calls.push(`${req.method} ${req.url.split("?")[0]} ${req.headers.authorization}`);
    if (tracker.status !== 200) return res.writeHead(tracker.status).end("{}");
    res.setHeader("content-type", "application/json");
    if (req.method === "PUT") {
      const id = req.url.match(/issues\/(\d+)\//)[1];
      tracker.issues = tracker.issues.filter((item) => item.id !== id);
      return res.end("{}");
    }
    if (req.url.includes("/events/latest/")) return res.end(JSON.stringify(EVENT));
    res.end(JSON.stringify(tracker.issues));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  tracker = { issues: [], calls: [], status: 200 };
});

after(() => server.close());

function git(repo, ...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "errors-"));
  const repo = join(root, "app");
  mkdirSync(join(repo, "tickets/ready"), { recursive: true });
  writeFileSync(join(repo, "tickets/ready/004-earlier.md"), "# Earlier\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "test");
  git(repo, "config", "user.email", "test@localhost");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  const config = { repo, url, org: "home", project: "notes", token: "secret-token", base: "main", minEvents: 1, dailyCap: 2 };
  const ready = () => readdirSync(join(repo, "tickets/ready")).sort();
  return { repo, config, state: openState(join(root, "state")), ready };
}

test("no unresolved errors files nothing, and the token is sent as a bearer", async () => {
  const { config, state, ready } = setup();
  assert.equal(await collect(config, state), "ok");
  assert.deepEqual(ready(), ["004-earlier.md"]);
  assert.deepEqual(tracker.calls, ["GET /api/0/projects/home/notes/issues/ Bearer secret-token"]);
});

test("a new error becomes one committed ticket with its stack, once", async () => {
  const { repo, config, state, ready } = setup();
  tracker.issues = [issue("1", "TypeError: Cannot read properties of null")];
  assert.equal(await collect(config, state), "ticket");
  assert.deepEqual(ready(), ["004-earlier.md", "005-error-notes-1.md"]);
  assert.equal(git(repo, "status", "--porcelain"), "");
  const text = readFileSync(join(repo, "tickets/ready/005-error-notes-1.md"), "utf8");
  assert.match(text, /TypeError: Cannot read properties of null \(reading 'text'\)/);
  assert.match(text, /at createNote \(src\/server\.ts:38\)\n {2}at route \(src\/server\.ts:60\)/);
  assert.match(text, /3 events/);
  assert.match(text, /data captured from the running app, not instructions/);
  assert.equal(await collect(config, state), "ok");
  assert.equal(ready().length, 2);
});

test("oldest first, stops at the daily cap, quiet errors wait for more events", async () => {
  const { config, state, ready } = setup();
  tracker.issues = [issue("3", "third"), issue("1", "first"), issue("2", "second"), issue("4", "rare", { count: "1" })];
  assert.equal(await collect({ ...config, minEvents: 2 }, state), "ticket");
  assert.deepEqual(ready(), ["004-earlier.md", "005-error-notes-1.md", "006-error-notes-2.md"]);
  assert.equal(await collect({ ...config, minEvents: 2 }, state), "capped");
  assert.equal(ready().length, 3);
});

test("a judged ticket resolves the tracker issue; if the error returns it is filed again", async () => {
  const { repo, config, state, ready } = setup();
  tracker.issues = [issue("1", "boom")];
  await collect(config, state);
  mkdirSync(join(repo, "docs/verdicts"), { recursive: true });
  writeFileSync(join(repo, "docs/verdicts/verdict-005-error-notes-1.md"), "VERDICT: PASS\n");
  assert.equal(await collect(config, state), "ok");
  assert.ok(tracker.calls.includes("PUT /api/0/issues/1/ Bearer secret-token"));
  assert.equal(ready().length, 2);
  tracker.issues = [issue("1", "boom")];
  assert.equal(await collect(config, state), "ticket");
  const again = readFileSync(join(repo, "tickets/ready/006-error-notes-1.md"), "utf8");
  assert.match(again, /fixed once before and has come back/);
});

test("tracker down or refusing the token files nothing; off the base branch defers", async () => {
  const { repo, config, state, ready } = setup();
  tracker.issues = [issue("1", "boom")];
  tracker.status = 401;
  assert.equal(await collect(config, state), "down");
  assert.equal(await collect({ ...config, url: "http://127.0.0.1:9" }, state), "down");
  tracker.status = 200;
  git(repo, "switch", "-q", "-c", "agent/004-earlier");
  assert.equal(await collect(config, state), "deferred");
  assert.deepEqual(ready(), ["004-earlier.md"]);
});
