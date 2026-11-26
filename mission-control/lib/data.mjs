import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { isJudged, ticketNumber, titleOf, verdictPaths, workDir } from "../../sensors/lib/tickets.mjs";
import { PHASES, skillsByPhase } from "./phases.mjs";
import { activity, liveAction } from "./transcript.mjs";

const DAY = 864e5;
const TESTING = /branch checks passed|gates|browser drive|verifier|verdict/;

function read(file, fallback = "") {
  return existsSync(file) ? readFileSync(file, "utf8") : fallback;
}

function json(file, fallback) {
  try {
    return JSON.parse(read(file));
  } catch {
    return fallback;
  }
}

function jsonLines(file) {
  return read(file).split("\n").filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function logLines(dir) {
  return read(join(dir, "orchestrator.log")).split("\n").filter(Boolean).map((line) => {
    const space = line.indexOf(" ");
    return { at: line.slice(0, space), text: line.slice(space + 1) };
  });
}

function git(repo, ...args) {
  try {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lockHolder(dir) {
  const pid = Number(read(join(dir, "lock/pid"), "0"));
  return pid > 0 && alive(pid) ? pid : undefined;
}

function ticketFiles(repo) {
  const found = {};
  const walk = (dir, place) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), entry.name);
      else if (ticketNumber(entry.name) !== undefined) found[basename(entry.name, ".md")] = { file: join(dir, entry.name), place };
    }
  };
  walk(join(repo, "tickets"), "tickets");
  return found;
}

function inbox(dir) {
  const folder = join(dir, "inbox");
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((name) => name.endsWith(".md")).sort().map((name) => {
    const text = read(join(folder, name));
    return { id: basename(name, ".md"), number: undefined, title: titleOf(text, name), status: "waiting", phase: 0, text, cost: 0, attempts: 0, updatedAt: undefined };
  });
}

function mentions(lines, id) {
  return lines.filter((line) => line.text.startsWith(`${id} `) || line.text.includes(` ${id}:`) || line.text.includes(` ${id} `) || line.text.startsWith(`${id}:`));
}

function saved(app, id, rel) {
  const path = `${workDir(id)}/${rel}`;
  return read(join(app.repo, path)) || git(app.repo, "show", `agent/${id}:${path}`);
}

function phaseOf(app, id, status, said) {
  if (status === "waiting" || status === "queued") return 0;
  if (status === "merged" || status === "done") return 5;
  if (status === "review") return 4;
  const sinceStart = said.slice(said.findLastIndex((line) => /started/.test(line.text)) + 1);
  if (sinceStart.some((line) => /branch checks stopped/.test(line.text))) return 2;
  if (sinceStart.some((line) => TESTING.test(line.text)) && !/sent back to the builder/.test(sinceStart.at(-1)?.text ?? "")) return 3;
  if (status === "blocked") return sinceStart.some((line) => TESTING.test(line.text)) ? 3 : 2;
  return saved(app, id, "2-design/design.md") ? 2 : 1;
}

function statusOf(app, id, entry, place, running) {
  if (running === id) return "building";
  if (isJudged(app.repo, id)) return "merged";
  if (entry?.status === "review") return "review";
  if (entry?.status === "blocked") return "blocked";
  if (place === "ready") return "queued";
  return "done";
}

function runningTicket(app, lines) {
  if (lockHolder(app.dir) === undefined) return undefined;
  const branch = git(app.repo, "branch", "--show-current");
  if (branch.startsWith("agent/")) return branch.slice("agent/".length);
  return lines.findLast((line) => /: started/.test(line.text))?.text.match(/^([\w-]+) .*: started/)?.[1];
}

export function listApps(home) {
  if (!existsSync(home)) return [];
  return readdirSync(home, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(home, entry.name, "repo")))
    .map((entry) => ({ name: entry.name, dir: join(home, entry.name), repo: read(join(home, entry.name, "repo")).trim() }))
    .filter((app) => existsSync(app.repo));
}

export function tickets(app) {
  const state = json(join(app.dir, "state.json"), { tickets: {}, days: {} });
  const runs = jsonLines(join(app.dir, "runs.jsonl"));
  const lines = logLines(app.dir);
  const files = ticketFiles(app.repo);
  const running = runningTicket(app, lines);
  const ids = [...new Set([...Object.keys(files), ...Object.keys(state.tickets)])].sort((a, b) => (ticketNumber(a) ?? 0) - (ticketNumber(b) ?? 0));
  const list = ids.map((id) => {
    const entry = state.tickets[id];
    const mine = runs.filter((run) => run.ticket === id);
    const said = mentions(lines, id);
    const status = statusOf(app, id, entry, files[id]?.place, running);
    return {
      id,
      number: ticketNumber(id),
      title: files[id] ? titleOf(read(files[id].file), id) : id,
      status,
      phase: phaseOf(app, id, status, said),
      verdict: entry?.verdict,
      reason: entry?.reason?.split("\n")[0],
      branch: entry?.branch,
      attempts: Math.max(0, ...mine.map((run) => run.attempt ?? 0)),
      cost: mine.reduce((total, run) => total + (run.costUsd ?? 0), 0),
      updatedAt: said.at(-1)?.at ?? entry?.updatedAt,
    };
  });
  return [...inbox(app.dir), ...list];
}

function runDetail(app, claudeHome, run) {
  const raw = json(join(app.dir, "logs", `${run.ticket}-${run.role}-${run.attempt}.json`), {});
  return { ...run, report: typeof raw.result === "string" ? raw.result : undefined, activity: activity(claudeHome, raw.session_id, app.repo) };
}

function origin(text) {
  if (/^#\s+Live check failing/m.test(text)) return "The scheduled live check";
  if (/^#\s+Live error/m.test(text)) return "The error tracker";
  const issue = text.match(/GitHub issue #(\d+)/)?.[1];
  return issue ? `GitHub issue #${issue}` : "You";
}

function merge(app, id, branch) {
  const found = git(app.repo, "log", "-1", "--merges", "--format=%h|%cI|%s", `--grep=agent/${id}`);
  if (found) {
    const [commit, at, subject] = found.split("|");
    return { commit, at, subject };
  }
  const landed = verdictPaths(id).map((path) => git(app.repo, "log", "-1", "--format=%h|%cI|%s", "--", path)).find(Boolean);
  if (!landed) return undefined;
  const [commit, at, subject] = landed.split("|");
  return { commit, at, subject, branch };
}

function usedSkills(runs) {
  return runs.flatMap((run) => [...(run.activity?.skills ?? []), ...(run.activity?.subagents ?? []).flatMap((agent) => agent.skills ?? [])]);
}

export function ticket(app, claudeHome, id) {
  const waiting = inbox(app.dir).find((item) => item.id === id);
  if (waiting) return { ...waiting, timeline: [], phases: { Plan: { text: waiting.text, origin: "You, in mission control" } }, skills: skillsByPhase([]) };
  const summary = tickets(app).find((item) => item.id === id);
  if (summary === undefined) return undefined;
  const lines = logLines(app.dir);
  const file = ticketFiles(app.repo)[id]?.file;
  const text = file ? read(file) : saved(app, id, "1-plan/ticket.md");
  const runs = jsonLines(join(app.dir, "runs.jsonl")).filter((run) => run.ticket === id).map((run) => runDetail(app, claudeHome, run));
  const builders = runs.filter((run) => run.role === "builder");
  const full = json(join(app.dir, "state.json"), { tickets: {} }).tickets[id];
  const verdictText = verdictPaths(id).map((path) => read(join(app.repo, path)) || git(app.repo, "show", `agent/${id}:${path}`)).find(Boolean) ?? "";
  const merged = summary.status === "merged" ? merge(app, id, summary.branch) : undefined;
  const base = summary.branch ? git(app.repo, "merge-base", "HEAD", summary.branch) : "";
  return {
    ...summary,
    reason: full?.reason,
    timeline: mentions(lines, id).map((line) => ({ at: line.at, text: line.text.replace(/^.*?: /, "") })),
    skills: skillsByPhase(usedSkills(runs)),
    phases: {
      Plan: { text, origin: origin(text) },
      Design: { note: saved(app, id, "2-design/design.md") },
      Build: {
        note: saved(app, id, "3-build/report.md") || builders.at(-1)?.report || "",
        runs: builders,
        changed: summary.branch && base ? git(app.repo, "diff", "--stat", `${base}..${summary.branch}`).split("\n").filter(Boolean) : [],
      },
      Test: {
        gates: saved(app, id, "4-test/gates.txt") || read(join(app.dir, "logs", `${id}-gates.txt`)),
        browser: saved(app, id, "4-test/browser.txt") || read(join(app.dir, "logs", `${id}-browser.txt`)),
        verdict: verdictText,
        runs: runs.filter((run) => run.role === "verifier"),
      },
      Deploy: { merged, branch: summary.branch, ready: summary.status === "review" },
      Maintain: { sensors: merged ? lines.filter((line) => /sensor|live check|live error/i.test(line.text) && line.at > merged.at).slice(-5) : [] },
    },
  };
}

function cost(runs, sinceMs) {
  const recent = runs.filter((run) => Date.now() - Date.parse(run.at) < sinceMs);
  return { runs: recent.length, usd: recent.reduce((total, run) => total + (run.costUsd ?? 0), 0) };
}

function now(app, claudeHome, lines, list) {
  const id = runningTicket(app, lines);
  if (id === undefined) return undefined;
  const said = mentions(lines, id);
  const found = list.find((item) => item.id === id);
  return {
    ticket: id,
    title: found?.title ?? id,
    phase: PHASES[found?.phase ?? 1],
    since: said.findLast((line) => /started/.test(line.text))?.at,
    step: said.at(-1)?.text.replace(/^.*?: /, "") ?? "starting",
    action: liveAction(claudeHome, app.repo),
  };
}

export function overview(home, claudeHome) {
  return listApps(home).map((app) => {
    const runs = jsonLines(join(app.dir, "runs.jsonl"));
    const lines = logLines(app.dir);
    const list = tickets(app);
    const tally = {};
    for (const item of list) tally[item.status] = (tally[item.status] ?? 0) + 1;
    return {
      name: app.name,
      repo: app.repo,
      now: now(app, claudeHome, lines, list),
      tally,
      today: cost(runs, DAY),
      week: cost(runs, 7 * DAY),
      lastLine: lines.at(-1),
      sensors: lines.filter((line) => /sensor|intake/.test(line.text)).slice(-3),
    };
  });
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "") || "ticket";
}

export function fileIdea(app, idea) {
  const name = `${Date.now()}-${slug(idea.title)}`;
  const section = (heading, text) => (text?.trim() ? `\n## ${heading}\n${text.trim()}\n` : "");
  const body = `# ${idea.title.trim()}\n${section("Goal", idea.goal)}${section("Done-check (must be able to pass or fail)", idea.doneCheck)}${section("Proof wanted", idea.proof)}${section("Known", idea.known)}`;
  mkdirSync(join(app.dir, "inbox"), { recursive: true });
  writeFileSync(join(app.dir, "inbox", `${name}.md`), body);
  return name;
}
