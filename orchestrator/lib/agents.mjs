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
    "Run sh scripts/gates.sh. If tools/verify/drive.mjs exists, drive the real running app with node tools/verify/drive.mjs all.",
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
      error: body.is_error === true ? String(body.result) : "",
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

async function claude(config, { prompt, model, mode, tools, resume, timeoutMs }) {
  const args = ["-p", prompt, "--model", model, "--permission-mode", mode];
  if (resume !== undefined) args.push("--resume", resume);
  args.push("--allowedTools", ...tools);
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
  });
}

export async function judge(config, { ticket, branch }) {
  const result = await claude(config, {
    prompt: verdictPrompt(ticket, branch, config.base),
    model: config.verifierModel,
    mode: "default",
    tools: VERIFIER_TOOLS,
    timeoutMs: config.verdictTimeoutMs,
  });
  const verdict = [...result.text.matchAll(VERDICT_LINE)].at(-1)?.[1];
  return { ...result, verdict };
}
