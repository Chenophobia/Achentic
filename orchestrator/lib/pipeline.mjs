import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { build, judge } from "./agents.mjs";
import { notify } from "./notify.mjs";
import { git, run, tail } from "./proc.mjs";
import { commitTicket, nextId } from "../../sensors/lib/tickets.mjs";

const PROTECTED = [
  "scripts/gates.sh",
  "scripts/no-comments.sh",
  "biome.json",
  "tsconfig.json",
  "knip.json",
  "CLAUDE.md",
  ".github/",
  ".claude/",
];

const ok = () => ({ kind: "ok" });
const retry = (message) => ({ kind: "retry", message });
const block = (message) => ({ kind: "block", message });

function isProtected(path) {
  return PROTECTED.some((entry) => (entry.endsWith("/") ? path.startsWith(entry) : path === entry));
}

function scriptsAt(repo, ref) {
  try {
    return JSON.stringify(JSON.parse(git(repo, "show", `${ref}:package.json`)).scripts ?? {});
  } catch {
    return "";
  }
}

function inspect(config) {
  const { repo, base } = config;
  const touched = git(repo, "diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const guarded = touched.filter(isProtected);
  if (guarded.length > 0) return block(`Change touches protected files: ${guarded.join(", ")}`);
  if (scriptsAt(repo, base) !== scriptsAt(repo, "HEAD")) {
    return block("Change edits package.json scripts, which the gates run through");
  }
  if (git(repo, "rev-list", "--count", `${base}..HEAD`) === "0") {
    return retry("There is no commit on the branch. Commit the work.");
  }
  const dirty = git(repo, "status", "--porcelain");
  if (dirty !== "") return retry(`The working tree is not clean:\n${dirty}`);
  return ok();
}

async function command(config, label, line) {
  const [bin, ...args] = line.split(" ");
  const outcome = await run(bin, args, { cwd: config.repo, timeoutMs: config.gatesTimeoutMs });
  if (outcome.code === 0 && !outcome.timedOut) return ok();
  const reason = outcome.timedOut ? "timed out" : `exited ${outcome.code}`;
  return retry(`${label} (${line}) ${reason}:\n${tail(outcome.stdout + outcome.stderr, 60)}`);
}

async function verify(config) {
  if (!existsSync(join(config.repo, "tools/verify/drive.mjs"))) return ok();
  const line = "node tools/verify/drive.mjs all";
  const outcome = await run("node", ["tools/verify/drive.mjs", "all"], { cwd: config.repo, timeoutMs: config.gatesTimeoutMs });
  const output = outcome.stdout + outcome.stderr;
  mkdirSync(join(config.repo, ".verify-evidence"), { recursive: true });
  writeFileSync(join(config.repo, ".verify-evidence/orchestrator-drive.txt"), `$ ${line}\n${output}\nexit ${outcome.code}\n`);
  if (outcome.code === 0 && !outcome.timedOut) return ok();
  const reason = outcome.timedOut ? "timed out" : `exited ${outcome.code}`;
  return retry(`Browser verification (${line}) ${reason}:\n${tail(output, 60)}`);
}

function record(state, id, role, attempt, model, result) {
  state.saveOutput(`${id}-${role}-${attempt}.json`, result.raw);
  state.recordRun({
    ticket: id,
    role,
    attempt,
    model,
    ok: result.ok,
    turns: result.turns,
    durationMs: result.durationMs,
    wallMs: result.wallMs,
    costUsd: result.costUsd,
    verdict: result.verdict,
  });
}

async function verdict(config, state, job, attempt) {
  const head = git(config.repo, "rev-parse", "HEAD");
  const result = await judge(config, job);
  record(state, job.id, "verifier", attempt, config.verifierModel, result);
  if (!result.ok) return block(`Verifier run failed: ${result.error}`);
  const moved = git(config.repo, "rev-parse", "HEAD") !== head;
  if (moved || git(config.repo, "status", "--porcelain") !== "") {
    return block("Verifier changed the repository; its verdict is void");
  }
  if (result.verdict === undefined) return block("Verifier gave no VERDICT line");
  if (result.verdict === "FAIL") return retry(`A non-author verifier failed the change:\n\n${result.text}`);
  return { kind: "pass", verdict: result.verdict, text: result.text };
}

function progress(label, step) {
  if (step.kind === "ok") return `${label} passed`;
  if (step.kind === "pass") return `verdict ${step.verdict}`;
  if (step.kind === "retry") return `${label} failed, sent back to the builder`;
  return `${label} stopped the ticket`;
}

async function attemptOnce(config, state, job, attempt, feedback, session) {
  const tag = `${basename(config.repo)} ${job.id}: attempt ${attempt}`;
  await notify(config, state, `${tag} · building`);
  const result = await build(config, { ...job, feedback, session });
  record(state, job.id, "builder", attempt, config.builderModel, result);
  if (!result.ok) return { step: block(`Builder run failed: ${result.error}`), session };
  const checks = [
    ["branch checks", () => inspect(config)],
    ["gates", () => command(config, "Gates", config.gates)],
    ["browser drive", () => verify(config)],
    ["verifier", () => verdict(config, state, job, attempt)],
  ];
  let step = ok();
  for (const [label, check] of checks) {
    step = await check();
    await notify(config, state, `${tag} · ${progress(label, step)}`, step.kind === "retry" || step.kind === "block" ? step.message : "");
    if (step.kind !== "ok") break;
  }
  return { step, session: result.session ?? session };
}

async function work(config, state, job) {
  let feedback;
  let session;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const outcome = await attemptOnce(config, state, job, attempt, feedback, session);
    session = outcome.session;
    if (outcome.step.kind === "pass") return { ...outcome.step, attempts: attempt };
    if (outcome.step.kind === "block") return { ...outcome.step, attempts: attempt };
    feedback = outcome.step.message;
  }
  return { kind: "block", attempts: config.maxAttempts, message: `Still failing after ${config.maxAttempts} attempts. Last finding:\n${feedback}` };
}

function verdictFile(id) {
  return `docs/verdicts/verdict-${id}.md`;
}

function close(config, job, result) {
  const { repo } = config;
  mkdirSync(join(repo, "docs/verdicts"), { recursive: true });
  writeFileSync(join(repo, verdictFile(job.id)), `${result.text.trimEnd()}\n`);
  git(repo, "add", verdictFile(job.id));
  git(repo, "commit", "-m", `Record verdict for ticket ${job.id}: ${result.verdict}`);
}

function leaveBranch(config, id) {
  if (git(config.repo, "status", "--porcelain") !== "") {
    git(config.repo, "stash", "push", "--include-untracked", "-m", `orchestrator ${id}`);
  }
  git(config.repo, "switch", config.base);
}

export function queue(config, state) {
  const dir = join(config.repo, "tickets/ready");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+.*\.md$/.test(name))
    .sort()
    .map((name) => basename(name, ".md"))
    .filter((id) => state.tickets[id] === undefined)
    .filter((id) => !existsSync(join(config.repo, verdictFile(id))));
}

function preflight(config, state) {
  const { repo, base } = config;
  if (git(repo, "status", "--porcelain") !== "") return "working tree is not clean";
  if (git(repo, "branch", "--show-current") !== base) return `not on ${base}`;
  if (state.startedToday() >= config.dailyCap) return `daily cap of ${config.dailyCap} reached`;
  return undefined;
}

async function handle(config, state, id) {
  const job = { id, ticket: `tickets/ready/${id}.md`, branch: `agent/${id}` };
  const name = basename(config.repo);
  if (git(config.repo, "branch", "--list", job.branch) !== "") {
    state.setTicket(id, { status: "blocked", branch: job.branch, reason: "Branch already exists" });
    await notify(config, state, `${name} ${id}: blocked`, "Branch already exists");
    return "blocked";
  }
  state.countStart();
  git(config.repo, "switch", "-c", job.branch, config.base);
  await notify(config, state, `${name} ${id}: started`, `Branch ${job.branch}`);
  try {
    const result = await work(config, state, job);
    if (result.kind === "pass") {
      close(config, job, result);
      state.setTicket(id, { status: "review", branch: job.branch, verdict: result.verdict, attempts: result.attempts });
      await notify(config, state, `${name} ${id}: ready to merge (${result.verdict})`, `Branch ${job.branch}, ${result.attempts} attempt(s). Verdict in docs/verdicts/verdict-${id}.md`);
      return "review";
    }
    state.setTicket(id, { status: "blocked", branch: job.branch, reason: result.message, attempts: result.attempts });
    await notify(config, state, `${name} ${id}: blocked`, result.message);
    return "blocked";
  } finally {
    leaveBranch(config, id);
  }
}

async function drainInbox(config, state) {
  const folder = join(state.dir, "inbox");
  if (!existsSync(folder)) return;
  const waiting = readdirSync(folder).filter((name) => name.endsWith(".md")).sort();
  if (waiting.length === 0) return;
  if (git(config.repo, "status", "--porcelain") !== "" || git(config.repo, "branch", "--show-current") !== config.base) return;
  for (const name of waiting) {
    const id = nextId(config.repo, basename(name, ".md").replace(/^\d+-/, ""));
    const body = readFileSync(join(folder, name), "utf8").trimEnd();
    const text = `${body}\n\n## Constraints\n- Do not edit gate or CI configuration.\n- Commit locally on the branch \`agent/${id}\`. Do not push.\n`;
    commitTicket(config.repo, id, text, `Ticket ${id} from mission control`);
    rmSync(join(folder, name));
    await notify(config, state, `${basename(config.repo)} ${id}: queued`, "From mission control");
  }
}

export async function runOnce(config, state) {
  if (!state.lock()) {
    state.log("another run holds the lock");
    return "locked";
  }
  try {
    await drainInbox(config, state);
    const [id] = queue(config, state);
    if (id === undefined) return "idle";
    const problem = preflight(config, state);
    if (problem !== undefined) {
      state.log(`skipped: ${problem}`);
      return "skipped";
    }
    return await handle(config, state, id);
  } finally {
    state.unlock();
  }
}
