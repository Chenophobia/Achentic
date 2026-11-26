import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createMissionControl } from "../server.mjs";

let root;
let base;
let server;
let locked;
let lockedBase;

function git(repo, ...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function line(type, content, extra = {}) {
  return JSON.stringify({ type, timestamp: "2026-11-23T10:00:00.000Z", message: { role: type, content, ...extra } });
}

function fixture() {
  root = mkdtempSync(join(tmpdir(), "mc-"));
  const repo = join(root, "work/notes");
  const dir = join(root, "home/notes");
  mkdirSync(join(repo, "tickets/ready"), { recursive: true });
  mkdirSync(join(repo, "docs/verdicts"), { recursive: true });
  mkdirSync(join(dir, "logs"), { recursive: true });
  writeFileSync(join(repo, "tickets/ready/001-count.md"), "# Note count\n\n## Goal\nSee how many.\n");
  writeFileSync(join(repo, "tickets/ready/002-export.md"), "# Export notes\n");
  writeFileSync(join(repo, "tickets/ready/003-search.md"), "# Search\n");
  writeFileSync(join(repo, "docs/verdicts/verdict-001-count.md"), "Looked fine.\n\nVERDICT: PASS\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "t");
  git(repo, "config", "user.email", "t@localhost");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  writeFileSync(join(dir, "repo"), repo);
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    tickets: {
      "001-count": { status: "review", branch: "agent/001-count", verdict: "PASS", attempts: 1 },
      "002-export": { status: "blocked", branch: "agent/002-export", reason: "Change touches protected files: biome.json\nmore" },
    },
    days: {},
  }));
  const at = new Date().toISOString();
  writeFileSync(join(dir, "runs.jsonl"), [
    { at, ticket: "001-count", role: "builder", attempt: 1, model: "sonnet", ok: true, costUsd: 1.5, wallMs: 120000 },
    { at, ticket: "001-count", role: "verifier", attempt: 1, model: "opus", ok: true, costUsd: 1.25, verdict: "PASS" },
  ].map((row) => JSON.stringify(row)).join("\n"));
  writeFileSync(join(dir, "orchestrator.log"), [
    `${at} notes 001-count: started: Branch agent/001-count`,
    `${at} notes 001-count: attempt 1 · gates passed`,
    `${at} notes 001-count: ready to merge (PASS)`,
    `${at} notes 002-export: blocked: Change touches protected files: biome.json`,
  ].join("\n"));
  writeFileSync(join(dir, "logs/001-count-builder-1.json"), JSON.stringify({ result: "Built the count.", session_id: "sess-1" }));
  const project = join(root, "claude/projects/-work-notes");
  mkdirSync(join(project, "sess-1/subagents"), { recursive: true });
  writeFileSync(join(project, "sess-1.jsonl"), [
    line("user", "<command-name>/pstack:poteto-mode</command-name> Implement the ticket"),
    line("assistant", [{ type: "tool_use", name: "Read", input: { file_path: "/x/pstack/1.0/skills/poteto-mode/playbooks/feature.md" } }], { model: "claude-sonnet-5" }),
    line("assistant", [{ type: "tool_use", name: "Agent", input: { description: "Explore the page", subagent_type: "Explore", model: "haiku" } }], { model: "claude-sonnet-5" }),
    line("assistant", [{ type: "tool_use", name: "Edit", input: { file_path: `${repo}/public/index.html` } }], { model: "claude-sonnet-5" }),
    line("assistant", [{ type: "tool_use", name: "Bash", input: { command: "npm run gates" } }], { model: "claude-sonnet-5" }),
    "not json at all",
  ].join("\n"));
  writeFileSync(join(project, "sess-1/subagents/agent-a1.jsonl"), line("assistant", [{ type: "tool_use", name: "Grep", input: { pattern: "count" } }], { model: "claude-haiku-5" }));
  writeFileSync(join(project, "sess-1/subagents/agent-a1.meta.json"), JSON.stringify({ description: "Explore the page", agentType: "Explore" }));
  return { home: join(root, "home"), claudeHome: join(root, "claude") };
}

async function listen(config) {
  const made = createMissionControl(config);
  await new Promise((resolve) => made.listen(0, "127.0.0.1", resolve));
  return { made, url: `http://127.0.0.1:${made.address().port}` };
}

before(async () => {
  const config = fixture();
  ({ made: server, url: base } = await listen({ ...config, token: "" }));
  ({ made: locked, url: lockedBase } = await listen({ ...config, token: "open-sesame" }));
});

after(() => {
  server.close();
  locked.close();
});

const get = async (path) => (await fetch(base + path)).json();
const post = (path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("overview and ticket list show each ticket at its station", async () => {
  const [app] = await get("/api/overview");
  assert.equal(app.name, "notes");
  assert.deepEqual(app.tally, { merged: 1, blocked: 1, queued: 1 });
  assert.equal(app.today.runs, 2);
  assert.equal(app.today.usd, 2.75);
  const list = await get("/api/apps/notes/tickets");
  const brief = Object.fromEntries(list.map((item) => [item.id, [item.status, item.station, item.title]]));
  assert.deepEqual(brief["001-count"], ["merged", 7, "Note count"]);
  assert.deepEqual(brief["002-export"].slice(0, 1), ["blocked"]);
  assert.deepEqual(brief["003-search"], ["queued", 0, "Search"]);
  assert.equal(list.find((item) => item.id === "002-export").reason, "Change touches protected files: biome.json");
});

test("a ticket shows its timeline, who did what, skills, helper agents and the verdict", async () => {
  const detail = await get("/api/apps/notes/tickets/001-count");
  assert.deepEqual(detail.timeline.map((event) => event.text), ["started: Branch agent/001-count", "attempt 1 · gates passed", "ready to merge (PASS)"]);
  assert.match(detail.verdictText, /VERDICT: PASS/);
  const [builder, verifier] = detail.runs;
  assert.equal(builder.report, "Built the count.");
  assert.deepEqual(builder.activity.skills, ["pstack:poteto-mode", "playbook: feature"]);
  assert.deepEqual(builder.activity.tools, { Read: 1, Agent: 1, Edit: 1, Bash: 1 });
  assert.deepEqual(builder.activity.files, ["public/index.html"]);
  assert.deepEqual(builder.activity.commands.map((command) => command.text), ["npm run gates"]);
  assert.equal(builder.activity.subagents.length, 1);
  assert.equal(builder.activity.subagents[0].description, "Explore the page");
  assert.deepEqual(builder.activity.subagents[0].models, ["claude-haiku-5"]);
  assert.deepEqual(builder.activity.subagents[0].tools, { Grep: 1 });
  assert.equal(verifier.activity, undefined);
  assert.equal((await fetch(`${base}/api/apps/notes/tickets/999-nope`)).status, 404);
  assert.equal((await fetch(`${base}/api/apps/elsewhere/tickets`)).status, 404);
});

test("a new ticket lands in the inbox, shows as waiting, and never touches the repository", async () => {
  const refused = await post("/api/apps/notes/tickets", { title: "No goal" });
  assert.equal(refused.status, 400);
  const made = await post("/api/apps/notes/tickets", { title: "Dark mode!", goal: "A dark page.", doneCheck: "Toggle flips it.", known: "" });
  assert.equal(made.status, 201);
  const files = readdirSync(join(root, "home/notes/inbox"));
  assert.equal(files.length, 1);
  assert.match(files[0], /^\d+-dark-mode\.md$/);
  const text = readFileSync(join(root, "home/notes/inbox", files[0]), "utf8");
  assert.match(text, /^# Dark mode!\n\n## Goal\nA dark page\.\n\n## Done-check/);
  assert.doesNotMatch(text, /## Known/);
  assert.equal(git(join(root, "work/notes"), "status", "--porcelain"), "");
  const list = await get("/api/apps/notes/tickets");
  assert.equal(list[0].status, "waiting");
  assert.equal(list[0].title, "Dark mode!");
});

test("requests from another site, wrong content type or odd paths are refused", async () => {
  const body = { title: "x", goal: "y", doneCheck: "z" };
  assert.equal((await post("/api/apps/notes/tickets", body, { origin: "https://evil.example" })).status, 403);
  assert.equal((await fetch(`${base}/api/apps/notes/tickets`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) })).status, 403);
  assert.equal((await fetch(`${base}/api/apps/notes/tickets/..%2F..%2Fstate`)).status, 400);
  mkdirSync(join(root, "home/notes/lock"), { recursive: true });
  assert.equal((await post("/api/apps/notes/tickets/002-export/retry", {})).status, 409);
});

test("with an access word set, nothing is served until it is given", async () => {
  assert.equal((await fetch(`${lockedBase}/api/overview`)).status, 401);
  assert.equal((await fetch(`${lockedBase}/`)).status, 200);
  const wrong = await fetch(`${lockedBase}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "guess" }) });
  assert.equal(wrong.status, 401);
  const right = await fetch(`${lockedBase}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "open-sesame" }) });
  assert.equal(right.status, 200);
  const cookie = right.headers.get("set-cookie").split(";")[0];
  assert.match(right.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.equal((await fetch(`${lockedBase}/api/overview`, { headers: { cookie } })).status, 200);
});
