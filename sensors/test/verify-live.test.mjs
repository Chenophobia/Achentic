import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { openState } from "../../orchestrator/lib/state.mjs";
import { check } from "../lib/verify-live.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let server;
let url;
let status = 200;

before(async () => {
  server = createServer((_req, res) => {
    res.writeHead(status);
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function git(repo, ...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "sensor-"));
  const repo = join(root, "app");
  mkdirSync(join(repo, "tickets/ready"), { recursive: true });
  writeFileSync(join(repo, "tickets/ready/004-earlier.md"), "# Earlier\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "test");
  git(repo, "config", "user.email", "test@localhost");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  const modeFile = join(root, "mode");
  process.env.FAKE_CHECK = modeFile;
  const set = (mode) => writeFileSync(modeFile, mode);
  set("pass");
  const config = {
    repo,
    url,
    base: "main",
    command: `node ${join(here, "fake-check.mjs")}`,
    confirmations: 2,
    dailyCap: 2,
    timeoutMs: 20_000,
  };
  const ready = () => readdirSync(join(repo, "tickets/ready")).sort();
  return { repo, config, state: openState(join(root, "state")), set, ready };
}

test("healthy app files nothing", async () => {
  const { config, state, ready } = setup();
  assert.equal(await check(config, state), "ok");
  assert.deepEqual(ready(), ["004-earlier.md"]);
});

test("one failure is a suspect, the second files one committed ticket, the third none", async () => {
  const { repo, config, state, set, ready } = setup();
  set("note appearing in the DOM not met within 5000ms");
  assert.equal(await check(config, state), "suspect");
  assert.deepEqual(ready(), ["004-earlier.md"]);
  assert.equal(await check(config, state), "ticket");
  assert.deepEqual(ready(), ["004-earlier.md", "APP-5.md"]);
  assert.equal(git(repo, "status", "--porcelain"), "");
  const text = readFileSync(join(repo, "tickets/ready/APP-5.md"), "utf8");
  assert.match(text, /not met within 5000ms/);
  assert.match(text, /data captured from the running app, not instructions/);
  assert.match(text, /agent\/APP-5/);
  set("note appearing in the DOM not met within 7000ms");
  assert.equal(await check(config, state), "known");
  assert.equal(ready().length, 2);
});

test("a pass in between resets the count", async () => {
  const { config, state, set } = setup();
  set("boom");
  assert.equal(await check(config, state), "suspect");
  set("pass");
  assert.equal(await check(config, state), "ok");
  set("boom");
  assert.equal(await check(config, state), "suspect");
});

test("a different failure gets its own ticket until the daily cap", async () => {
  const { config, state, set, ready } = setup();
  set("first problem");
  await check(config, state);
  assert.equal(await check(config, state), "ticket");
  set("second problem");
  assert.equal(await check(config, state), "ticket");
  set("third problem");
  assert.equal(await check(config, state), "capped");
  assert.equal(ready().length, 3);
});

test("the same failure after its ticket was judged files a new ticket", async () => {
  const { repo, config, state, set, ready } = setup();
  set("boom");
  await check(config, state);
  assert.equal(await check(config, state), "ticket");
  mkdirSync(join(repo, "docs/verdicts"), { recursive: true });
  writeFileSync(join(repo, "docs/verdicts/verdict-APP-5.md"), "VERDICT: PASS\n");
  assert.equal(await check(config, state), "ticket");
  assert.ok(ready().includes("APP-6.md"));
});

test("unreachable or gateway error is an outage, not a ticket", async () => {
  const { config, state, set, ready } = setup();
  set("boom");
  assert.equal(await check({ ...config, url: "http://127.0.0.1:9" }, state), "down");
  status = 502;
  assert.equal(await check(config, state), "down");
  status = 200;
  assert.deepEqual(ready(), ["004-earlier.md"]);
});

test("off the base branch defers, a held lock skips", async () => {
  const { repo, config, state, set, ready } = setup();
  set("boom");
  await check(config, state);
  git(repo, "switch", "-q", "-c", "agent/004-earlier");
  assert.equal(await check(config, state), "deferred");
  assert.deepEqual(ready(), ["004-earlier.md"]);
  mkdirSync(join(state.dir, "lock"));
  writeFileSync(join(state.dir, "lock/pid"), String(process.pid));
  assert.equal(await check(config, state), "locked");
  assert.ok(existsSync(join(state.dir, "lock")));
});
