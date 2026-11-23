#!/usr/bin/env node
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { beat } from "./lib/heartbeat.mjs";
import { queue, runOnce } from "./lib/pipeline.mjs";
import { git } from "./lib/proc.mjs";
import { openState } from "./lib/state.mjs";

const MINUTE = 60_000;
const USAGE = `usage: orchestrator.mjs <run|status|retry <ticket-id>> --repo <path>`;

function number(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function configFor(repo) {
  const env = process.env;
  return {
    repo,
    home: join(env.ACHENTIC_HOME ?? join(homedir(), ".achentic"), basename(repo)),
    base: env.ACHENTIC_BASE ?? "main",
    gates: env.ACHENTIC_GATES ?? "sh scripts/gates.sh",
    claudeBin: env.ACHENTIC_CLAUDE_BIN ?? "claude",
    builderModel: env.ACHENTIC_BUILDER_MODEL ?? "sonnet",
    verifierModel: env.ACHENTIC_VERIFIER_MODEL ?? "opus",
    ntfyUrl: env.ACHENTIC_NTFY_URL,
    sandbox: env.ACHENTIC_SANDBOX === "1",
    dailyCap: number("ACHENTIC_DAILY_CAP", 3),
    maxAttempts: number("ACHENTIC_MAX_ATTEMPTS", 3),
    buildTimeoutMs: number("ACHENTIC_BUILD_MINUTES", 30) * MINUTE,
    verdictTimeoutMs: number("ACHENTIC_VERDICT_MINUTES", 20) * MINUTE,
    gatesTimeoutMs: number("ACHENTIC_GATES_MINUTES", 10) * MINUTE,
  };
}

function status(config, state) {
  console.log(`repo: ${config.repo}`);
  console.log(`started today: ${state.startedToday()} of ${config.dailyCap}`);
  console.log(`ready: ${queue(config, state).join(", ") || "none"}`);
  for (const [id, entry] of Object.entries(state.tickets)) {
    const detail = entry.status === "review" ? entry.verdict : entry.reason.split("\n")[0];
    console.log(`${id}: ${entry.status} on ${entry.branch} — ${detail}`);
  }
}

function retry(config, state, id) {
  const entry = state.tickets[id];
  if (entry === undefined) throw new Error(`no record of ticket ${id}`);
  if (git(config.repo, "branch", "--list", entry.branch) !== "") {
    const stale = `stale/${id}-${Date.now()}`;
    git(config.repo, "branch", "-m", entry.branch, stale);
    console.log(`kept the old attempt as ${stale}`);
  }
  state.forgetTicket(id);
  console.log(`${id} is back in the queue`);
}

async function main() {
  const [action, ...rest] = process.argv.slice(2);
  const flag = rest.indexOf("--repo");
  if (action === undefined || flag === -1 || rest[flag + 1] === undefined) throw new Error(USAGE);
  const config = configFor(resolve(rest[flag + 1]));
  const state = openState(config.home);
  if (action === "run") {
    const result = await runOnce(config, state);
    state.log(`run: ${result}`);
    await beat(process.env.ACHENTIC_HEARTBEAT_URL, result);
    return;
  }
  if (action === "status") return status(config, state);
  if (action === "retry" && rest[0] !== "--repo") return retry(config, state, rest[0]);
  throw new Error(USAGE);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
