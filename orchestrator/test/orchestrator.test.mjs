import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runOnce } from "../lib/pipeline.mjs";
import { openState } from "../lib/state.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const PASS = { result: "looked fine\n\nVERDICT: PASS" };
const FAIL = { result: "crashes on empty input\n\nVERDICT: FAIL" };
const GOOD = { write: { "feature.txt": "x" }, commit: true };

function git(repo, ...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function setup(plan) {
  const root = mkdtempSync(join(tmpdir(), "orchestrator-"));
  const repo = join(root, "app");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "tickets/ready"), { recursive: true });
  writeFileSync(join(repo, "scripts/gates.sh"), "test ! -e bad\n");
  writeFileSync(join(repo, "package.json"), '{"scripts":{"gates":"sh scripts/gates.sh"}}\n');
  writeFileSync(join(repo, "tickets/ready/001-thing.md"), "# Thing\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "test");
  git(repo, "config", "user.email", "test@localhost");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  const planFile = join(root, "plan.json");
  writeFileSync(planFile, JSON.stringify(plan));
  process.env.FAKE_PLAN = planFile;
  const config = {
    repo,
    base: "main",
    gates: "sh scripts/gates.sh",
    claudeBin: join(here, "fake-claude.mjs"),
    builderModel: "sonnet",
    verifierModel: "opus",
    dailyCap: 3,
    buildMaxUsd: 6,
    verdictMaxUsd: 4,
    maxAttempts: 3,
    buildTimeoutMs: 20_000,
    verdictTimeoutMs: 20_000,
    gatesTimeoutMs: 20_000,
  };
  const calls = () =>
    readFileSync(`${planFile}.calls`, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  return { repo, config, state: openState(join(root, "state")), calls };
}

function assertHome(repo) {
  assert.equal(git(repo, "branch", "--show-current"), "main");
  assert.equal(git(repo, "status", "--porcelain"), "");
}

test("passing change ends in review with the verdict recorded on the branch", async () => {
  const { repo, config, state } = setup([GOOD, PASS]);
  assert.equal(await runOnce(config, state), "review");
  assertHome(repo);
  assert.equal(state.tickets["001-thing"].verdict, "PASS");
  const files = git(repo, "ls-tree", "-r", "--name-only", "agent/001-thing");
  assert.match(files, /tickets\/ready\/001-thing\.md/);
  for (const file of ["1-plan/ticket.md", "2-design/design.md", "3-build/report.md", "4-test/gates.txt", "4-test/verdict.md"]) {
    assert.ok(files.includes(`docs/work/001-thing/${file}`), file);
  }
  assert.match(git(repo, "show", "agent/001-thing:docs/work/001-thing/4-test/gates.txt"), /^\$ sh scripts\/gates\.sh[\s\S]*exit 0/);
  assert.equal(await runOnce(config, state), "idle");
});

test("two open tickets merge without conflict and stay done without the state file", async () => {
  const other = { write: { "other.txt": "y" }, commit: true };
  const { repo, config, state } = setup([GOOD, PASS, other, PASS]);
  assert.equal(await runOnce(config, state), "review");
  writeFileSync(join(repo, "tickets/ready/002-other.md"), "# Other\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "second ticket");
  assert.equal(await runOnce(config, state), "review");
  git(repo, "merge", "-q", "--no-ff", "-m", "merge 1", "agent/001-thing");
  git(repo, "merge", "-q", "--no-ff", "-m", "merge 2", "agent/002-other");
  assertHome(repo);
  assert.ok(existsSync(join(repo, "feature.txt")) && existsSync(join(repo, "other.txt")));
  const fresh = openState(join(dirname(repo), "fresh-state"));
  assert.equal(await runOnce(config, fresh), "idle");
});

test("sandbox mode passes a settings file that confines commands and tells the agents", async () => {
  const { config, state, calls } = setup([GOOD, PASS]);
  assert.equal(await runOnce({ ...config, sandbox: true, home: state.dir }, state), "review");
  for (const call of calls()) {
    const settings = JSON.parse(readFileSync(call[call.indexOf("--settings") + 1], "utf8"));
    assert.equal(settings.sandbox.enabled, true);
    assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
    assert.deepEqual(settings.sandbox.network.allowedDomains, ["registry.npmjs.org"]);
    assert.ok(settings.permissions.deny.includes("Read(~/.ssh/**)"));
    assert.ok(settings.permissions.deny.includes("Edit(~/.claude/**)"));
    assert.match(call[1], /operating-system sandbox/);
  }
  const plain = setup([GOOD, PASS]);
  await runOnce(plain.config, plain.state);
  assert.ok(plain.calls().every((call) => !call.includes("--settings")));
});

test("each agent run carries its own spending cap, and going over it blocks the ticket", async () => {
  const { config, state, calls } = setup([GOOD, PASS]);
  await runOnce(config, state);
  const caps = calls().map((call) => call[call.indexOf("--max-budget-usd") + 1]);
  assert.deepEqual(caps, ["6", "4"]);
  assert.doesNotMatch(calls()[0][1], /arena|larger model/);
  const over = setup([{ error: true, result: null, subtype: "error_max_budget_usd" }]);
  assert.equal(await runOnce(over.config, over.state), "blocked");
  assert.match(over.state.tickets["001-thing"].reason, /error_max_budget_usd/);
});

test("every step of a ticket is announced, in order", async () => {
  const fix = { remove: ["bad"], commit: true };
  const { config, state } = setup([{ write: { bad: "x" }, commit: true }, fix, PASS]);
  const said = [];
  await runOnce(config, { ...state, log: (line) => said.push(line.replace(/^001-thing Thing: /, "")) });
  assert.deepEqual(
    said.map((line) => line.split(": ")[0].replace(/ · /g, " | ")),
    [
      "started",
      "attempt 1 | building",
      "attempt 1 | branch checks passed",
      "attempt 1 | gates failed, sent back to the builder",
      "attempt 2 | building",
      "attempt 2 | branch checks passed",
      "attempt 2 | gates passed",
      "attempt 2 | browser drive passed",
      "attempt 2 | verdict PASS",
      "ready to merge (PASS)",
    ],
  );
});

test("an idea left in the inbox becomes a numbered, committed ticket and is built", async () => {
  const { repo, config, state } = setup([GOOD, PASS, GOOD, PASS]);
  mkdirSync(join(state.dir, "inbox"), { recursive: true });
  writeFileSync(join(state.dir, "inbox/1700000000000-dark-mode.md"), "# Dark mode\n\n## Goal\nA dark page.\n");
  assert.equal(await runOnce(config, state), "review");
  assert.equal(state.tickets["001-thing"].status, "review");
  const text = readFileSync(join(repo, "tickets/ready/APP-2.md"), "utf8");
  assert.match(text, /^# Dark mode/);
  assert.match(text, /agent\/APP-2/);
  assert.equal(await runOnce(config, state), "review");
  assert.equal(state.tickets["APP-2"].status, "review");
  assert.equal(readdirSync(join(state.dir, "inbox")).length, 0);
  assert.equal(git(repo, "status", "--porcelain"), "");
});

test("a builder that skips its design or build note is sent back for them", async () => {
  const bare = { write: { "feature.txt": "x" }, commit: true, noNotes: true };
  const { config, state, calls } = setup([bare, { commit: true }, PASS]);
  assert.equal(await runOnce(config, state), "review");
  assert.match(calls()[1][1], /notes are missing[\s\S]*docs\/work\/001-thing\/2-design\/design\.md, docs\/work\/001-thing\/3-build\/report\.md/);
  assert.match(calls()[0][1], /Design before you build/);
});

test("gate failure goes back to the same builder session with the output", async () => {
  const fix = { remove: ["bad"], commit: true };
  const { config, state, calls } = setup([{ write: { bad: "x" }, commit: true }, fix, { result: "ok\nVERDICT: PASS+NOTES" }]);
  assert.equal(await runOnce(config, state), "review");
  assert.equal(state.tickets["001-thing"].attempts, 2);
  assert.equal(state.tickets["001-thing"].verdict, "PASS+NOTES");
  const second = calls()[1];
  assert.equal(second[second.indexOf("--resume") + 1], "session-1");
  assert.match(second[1], /Gates \(sh scripts\/gates\.sh\) exited 1/);
});

test("verifier FAIL is fed back, then blocks after three attempts", async () => {
  const again = { write: { "feature.txt": "y" }, commit: true };
  const more = { write: { "feature.txt": "z" }, commit: true };
  const { repo, config, state, calls } = setup([GOOD, FAIL, again, FAIL, more, FAIL]);
  assert.equal(await runOnce(config, state), "blocked");
  assertHome(repo);
  assert.equal(calls().length, 6);
  assert.match(calls()[2][1], /crashes on empty input/);
  assert.match(state.tickets["001-thing"].reason, /after 3 attempts/);
  assert.equal(await runOnce(config, state), "idle");
});

test("touching a gate file blocks at once and never reaches the verifier", async () => {
  const cheat = { write: { "scripts/gates.sh": "true\n" }, commit: true };
  const { config, state, calls } = setup([cheat, PASS]);
  assert.equal(await runOnce(config, state), "blocked");
  assert.equal(calls().length, 1);
  assert.match(state.tickets["001-thing"].reason, /protected files: scripts\/gates\.sh/);
});

test("editing package.json scripts blocks", async () => {
  const cheat = { write: { "package.json": '{"scripts":{"gates":"true"}}\n' }, commit: true };
  const { config, state } = setup([cheat, PASS]);
  assert.equal(await runOnce(config, state), "blocked");
  assert.match(state.tickets["001-thing"].reason, /package\.json scripts/);
});

test("uncommitted work is sent back, and a verifier that edits is void", async () => {
  const meddle = { write: { "feature.txt": "tampered" }, result: "VERDICT: PASS" };
  const { repo, config, state, calls } = setup([{ write: { "feature.txt": "x" } }, { commit: true }, meddle]);
  assert.equal(await runOnce(config, state), "blocked");
  assert.match(calls()[1][1], /no commit on the branch/);
  assert.match(state.tickets["001-thing"].reason, /Verifier changed the repository/);
  assertHome(repo);
});

test("builder error, missing verdict line, daily cap and lock", async () => {
  const broken = setup([{ error: true, result: "OAuth session expired" }]);
  assert.equal(await runOnce(broken.config, broken.state), "blocked");
  assert.match(broken.state.tickets["001-thing"].reason, /OAuth session expired/);

  const silent = setup([GOOD, { result: "looks good to me" }]);
  assert.equal(await runOnce(silent.config, silent.state), "blocked");
  assert.match(silent.state.tickets["001-thing"].reason, /no VERDICT line/);

  const capped = setup([GOOD, PASS]);
  assert.equal(await runOnce({ ...capped.config, dailyCap: 0 }, capped.state), "skipped");

  const held = setup([GOOD, PASS]);
  mkdirSync(join(held.state.dir, "lock"));
  writeFileSync(join(held.state.dir, "lock/pid"), String(process.pid));
  assert.equal(await runOnce(held.config, held.state), "locked");
  writeFileSync(join(held.state.dir, "lock/pid"), "999999");
  assert.equal(await runOnce(held.config, held.state), "review");
});
