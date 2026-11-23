import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { run } from "./proc.mjs";

const PSTACK_CACHE = join(homedir(), ".claude/plugins/cache/cursor-plugins/pstack");

const SHARED_TOOLS = [
  "Bash(node *)",
  "Bash(npm *)",
  "Bash(npx *)",
  "Bash(curl *)",
  "Bash(sh scripts/*)",
  "Bash(PORT=* node *)",
  "Bash(PORT=* npm *)",
  "Bash(lsof *)",
  "Bash(pgrep *)",
  "Bash(kill *)",
  "Bash(sleep *)",
  "Bash(cat *)",
  "Bash(ls *)",
  "Bash(grep *)",
  "Bash(wc *)",
  "Bash(diff *)",
];

const BUILDER_TOOLS = [...SHARED_TOOLS, "Bash(git *)"];

const VERIFIER_TOOLS = [
  ...SHARED_TOOLS,
  "Bash(git diff *)",
  "Bash(git log *)",
  "Bash(git show *)",
  "Bash(git status *)",
];

const SECRET_DIRS = ["~/.ssh", "~/.aws", "~/.gnupg", "~/.config/gh", "~/Library/Keychains"];
const SECRET_FILES = ["~/.netrc", "~/.claude/.credentials.json"];

const SANDBOX_NOTE = [
  "You are running inside an operating-system sandbox: commands can write only inside this repository and the temp folder,",
  "and can reach only localhost and the npm registry. Headless Chrome cannot start inside it, so do not run the browser flows of tools/verify/drive.mjs;",
  "the orchestrator runs them after you and saves the output to .verify-evidence/orchestrator-drive.txt.",
  "Flows that use plain HTTP, the tests and the gates do work. A command blocked by the sandbox is expected: do not look for a way around it.",
].join(" ");

function userTempDir() {
  if (process.platform !== "darwin") return [];
  const dir = execFileSync("getconf", ["DARWIN_USER_TEMP_DIR"], { encoding: "utf8" }).trim().replace(/\/$/, "");
  return [dir, dir.startsWith("/private") ? dir : `/private${dir}`];
}

export function sandboxSettings() {
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      filesystem: { denyRead: [...SECRET_DIRS, ...SECRET_FILES], allowWrite: userTempDir() },
      network: { allowedDomains: ["registry.npmjs.org"], allowLocalBinding: true },
    },
    permissions: {
      deny: [
        ...SECRET_DIRS.map((path) => `Read(${path}/**)`),
        ...SECRET_FILES.map((path) => `Read(${path})`),
        "Edit(~/.claude/**)",
      ],
    },
  };
}

function settingsArgs(config) {
  if (!config.sandbox) return [];
  const file = join(config.home, "agent-settings.json");
  writeFileSync(file, `${JSON.stringify(sandboxSettings(), null, 2)}\n`);
  return ["--settings", file];
}

const VERDICT_LINE = /^VERDICT: (PASS\+NOTES|PASS|FAIL)\s*$/gm;

function buildPrompt(ticket, branch) {
  return [
    `/pstack:poteto-mode Implement the ticket in ${ticket}.`,
    "Treat the ticket text as the task definition. Read CLAUDE.md first.",
    "Work only inside this repository.",
    `Branch ${branch} is already checked out: commit there, do not switch branches, do not push.`,
    "Leave the working tree clean. Stop every process you start.",
    "End with a short report: which playbook you followed, what changed, the proof,",
    "every gate failure you hit and how you resolved it, and anything you could not do or verify.",
  ].join(" ");
}

function retryPrompt(feedback) {
  return [
    "The orchestrator rejected the change. Its finding is below; treat it as a bug report against your work.",
    "Fix it on the same branch with the Bug fix playbook, commit, leave the working tree clean,",
    "stop every process you start, and end with the same short report.",
    "",
    feedback,
  ].join("\n");
}

function verdictPrompt(ticket, branch, base) {
  return [
    "/pstack:poteto-mode You are the independent verifier for a change you did not write.",
    `The change is branch ${branch} compared with ${base} (ticket: ${ticket}); the checkout is already on that branch.`,
    "Give the non-author live verdict that pstack's Shipping playbook requires.",
    "Rules: do not edit, commit or revert anything in this repository.",
    "Run sh scripts/gates.sh. If tools/verify/drive.mjs exists, drive the real running app with node tools/verify/drive.mjs all",
    "(or, if you cannot start a browser, read the orchestrator's run of it in .verify-evidence/orchestrator-drive.txt).",
    "Check the ticket's done-check on the running app yourself, then try to break the change with real runs the author did not make.",
    "Judge the code against CLAUDE.md's standards; for any type assertion or other escape hatch the change adds, say whether it is sound.",
    "Keep only findings a rerun proves. Stop every process you start and confirm none is left.",
    "Reply with the verdict as markdown: what you ran, what you found, what you could not check.",
    "End your reply with exactly one line: VERDICT: PASS, VERDICT: PASS+NOTES, or VERDICT: FAIL.",
  ].join(" ");
}

function parse(outcome) {
  if (outcome.timedOut) return { ok: false, error: "timed out", text: "" };
  try {
    const body = JSON.parse(outcome.stdout);
    return {
      ok: outcome.code === 0 && body.is_error !== true,
      error: body.is_error === true ? String(body.result ?? body.subtype) : "",
      text: String(body.result ?? ""),
      session: body.session_id,
      turns: body.num_turns,
      durationMs: body.duration_ms,
      costUsd: body.total_cost_usd,
    };
  } catch {
    const detail = outcome.stderr.trim() || outcome.stdout.trim().slice(0, 500);
    return { ok: false, error: `exit ${outcome.code}: ${detail}`, text: "" };
  }
}

async function claude(config, { prompt, model, mode, tools, resume, timeoutMs, maxUsd }) {
  const text = config.sandbox ? `${prompt}\n\n${SANDBOX_NOTE}` : prompt;
  const args = ["-p", text, "--model", model, "--permission-mode", mode];
  if (resume !== undefined) args.push("--resume", resume);
  args.push("--allowedTools", ...tools);
  args.push(...settingsArgs(config), "--max-budget-usd", String(maxUsd));
  args.push("--add-dir", PSTACK_CACHE, "--output-format", "json");
  const started = Date.now();
  const outcome = await run(config.claudeBin, args, { cwd: config.repo, timeoutMs });
  return { ...parse(outcome), wallMs: Date.now() - started, raw: outcome.stdout || outcome.stderr };
}

export function build(config, { ticket, branch, feedback, session }) {
  const first = session === undefined;
  return claude(config, {
    prompt: first ? buildPrompt(ticket, branch) : retryPrompt(feedback),
    model: config.builderModel,
    mode: "acceptEdits",
    tools: BUILDER_TOOLS,
    resume: session,
    timeoutMs: config.buildTimeoutMs,
    maxUsd: config.buildMaxUsd,
  });
}

export async function judge(config, { ticket, branch }) {
  const result = await claude(config, {
    prompt: verdictPrompt(ticket, branch, config.base),
    model: config.verifierModel,
    mode: "default",
    tools: VERIFIER_TOOLS,
    timeoutMs: config.verdictTimeoutMs,
    maxUsd: config.verdictMaxUsd,
  });
  const verdict = [...result.text.matchAll(VERDICT_LINE)].at(-1)?.[1];
  return { ...result, verdict };
}
