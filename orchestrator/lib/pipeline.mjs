import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { build, judge } from "./agents.mjs";
import { notify } from "./notify.mjs";
import { git, run, tail } from "./proc.mjs";
import { commitTicket, isJudged, nextId, ticketNumber, titleOf, workDir } from "../../sensors/lib/tickets.mjs";

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

function inspect(config, job) {
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
  const missing = [job.design, job.report].filter((path) => !existsSync(join(repo, path)));
  if (missing.length > 0) return retry(`These notes are missing; write and commit them: ${missing.join(", ")}`);
  const dirty = git(repo, "status", "--porcelain");
  if (dirty !== "") return retry(`The working tree is not clean:\n${dirty}`);
  return ok();
}

function keep(state, job, name, line, outcome) {
  state.saveOutput(`${job.id}-${name}.txt`, `$ ${line}\n${outcome.stdout}${outcome.stderr}\nexit ${outcome.code}\n`);
}

async function command(config, state, job, label, line) {
  const [bin, ...args] = line.split(" ");
  const outcome = await run(bin, args, { cwd: config.repo, timeoutMs: config.gatesTimeoutMs });
  keep(state, job, "gates", line, outcome);
  if (outcome.code === 0 && !outcome.timedOut) return ok();
  const reason = outcome.timedOut ? "timed out" : `exited ${outcome.code}`;
  return retry(`${label} (${line}) ${reason}:\n${tail(outcome.stdout + outcome.stderr, 60)}`);
}

async function verify(config, state, job) {
  if (!existsSync(join(config.repo, "tools/verify/drive.mjs"))) return ok();
  const line = "node tools/verify/drive.mjs all";
  const outcome = await run("node", ["tools/verify/drive.mjs", "all"], { cwd: config.repo, timeoutMs: config.gatesTimeoutMs });
  const output = outcome.stdout + outcome.stderr;
  keep(state, job, "browser", line, outcome);
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
  const tag = `${job.label}: attempt ${attempt}`;
  await notify(config, state, `${tag} · building`);
  const result = await build(config, { ...job, feedback, session });
  record(state, job.id, "builder", attempt, config.builderModel, result);
  if (!result.ok) return { step: block(`Builder run failed: ${result.error}`), session };
  const checks = [
    ["branch checks", () => inspect(config, job)],
    ["gates", () => command(config, state, job, "Gates", config.gates)],
    ["browser drive", () => verify(config, state, job)],
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

function close(config, state, job, result) {
  const { repo } = config;
  const test = join(repo, workDir(job.id), "4-test");
  mkdirSync(join(repo, workDir(job.id), "1-plan"), { recursive: true });
  mkdirSync(test, { recursive: true });
  copyFileSync(join(repo, job.ticket), join(repo, workDir(job.id), "1-plan/ticket.md"));
  for (const name of ["gates", "browser"]) {
    const saved = join(state.dir, "logs", `${job.id}-${name}.txt`);
    if (existsSync(saved)) copyFileSync(saved, join(test, `${name}.txt`));
  }
  writeFileSync(join(test, "verdict.md"), `${result.text.trimEnd()}\n`);
  git(repo, "add", workDir(job.id));
  git(repo, "commit", "-m", `${job.id}: record plan, test output and verdict ${result.verdict}`);
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
    .filter((name) => ticketNumber(name) !== undefined)
    .sort((a, b) => ticketNumber(a) - ticketNumber(b))
    .map((name) => basename(name, ".md"))
    .filter((id) => state.tickets[id] === undefined)
    .filter((id) => !isJudged(config.repo, id));
}

function preflight(config, state) {
  const { repo, base } = config;
  if (git(repo, "status", "--porcelain") !== "") return "working tree is not clean";
  if (git(repo, "branch", "--show-current") !== base) return `not on ${base}`;
  if (state.startedToday() >= config.dailyCap) return `daily cap of ${config.dailyCap} reached`;
  return undefined;
}

async function handle(config, state, id) {
  const ticket = `tickets/ready/${id}.md`;
  const title = titleOf(readFileSync(join(config.repo, ticket), "utf8"), id);
  const job = { id, title, ticket, branch: `agent/${id}`, label: `${id} ${title}`, design: `${workDir(id)}/2-design/design.md`, report: `${workDir(id)}/3-build/report.md` };
  const name = job.label;
  if (git(config.repo, "branch", "--list", job.branch) !== "") {
    state.setTicket(id, { status: "blocked", branch: job.branch, reason: "Branch already exists" });
    await notify(config, state, `${name}: blocked`, "Branch already exists");
    return "blocked";
  }
  state.countStart();
  git(config.repo, "switch", "-c", job.branch, config.base);
  await notify(config, state, `${name}: started`, `Project ${basename(config.repo)}, branch ${job.branch}`);
  try {
    const result = await work(config, state, job);
    if (result.kind === "pass") {
      close(config, state, job, result);
      state.setTicket(id, { status: "review", branch: job.branch, verdict: result.verdict, attempts: result.attempts });
      await notify(config, state, `${name}: ready to merge (${result.verdict})`, `Branch ${job.branch}, ${result.attempts} attempt(s). Files in ${workDir(id)}/`);
      return "review";
    }
    state.setTicket(id, { status: "blocked", branch: job.branch, reason: result.message, attempts: result.attempts });
    await notify(config, state, `${name}: blocked`, result.message);
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
    const id = nextId(config.repo);
    const body = readFileSync(join(folder, name), "utf8").trimEnd();
    const text = `${body}\n\n## Constraints\n- Do not edit gate or CI configuration.\n- Commit locally on the branch \`agent/${id}\`. Do not push.\n`;
    commitTicket(config.repo, id, text, `${id}: ${titleOf(body, "ticket")} (from mission control)`);
    rmSync(join(folder, name));
    await notify(config, state, `${id} ${titleOf(body, "")}: queued`, `Project ${basename(config.repo)}, from mission control`);
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
