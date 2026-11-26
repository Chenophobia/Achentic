import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { activity, liveAction } from "./transcript.mjs";

const STATIONS = ["queued", "building", "checks", "gates", "browser", "verdict", "ready", "merged"];
const DAY = 864e5;

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
      else if (/^\d+-.*\.md$/.test(entry.name)) found[basename(entry.name, ".md")] = { file: join(dir, entry.name), place };
    }
  };
  walk(join(repo, "tickets"), "tickets");
  return found;
}

function title(text, id) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
}

function inbox(dir) {
  const folder = join(dir, "inbox");
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((name) => name.endsWith(".md")).sort().map((name) => {
    const text = read(join(folder, name));
    return { id: basename(name, ".md"), title: title(text, name), status: "waiting", station: 0, text, cost: 0, attempts: 0, updatedAt: undefined };
  });
}

function station(status, lines) {
  if (status === "merged" || status === "done") return 7;
  if (status === "review") return 6;
  if (status === "queued" || status === "waiting") return 0;
  const last = lines.at(-1)?.text ?? "";
  if (/verdict|verifier/.test(last)) return 5;
  if (/browser drive passed/.test(last)) return 5;
  if (/gates passed/.test(last)) return 4;
  if (/branch checks passed/.test(last)) return 3;
  if (/gates failed|browser drive failed|branch checks failed/.test(last)) return 1;
  return status === "blocked" ? Math.max(1, lines.length > 2 ? 3 : 1) : 1;
}

function mentions(lines, id) {
  return lines.filter((line) => line.text.includes(`${id}:`) || line.text.includes(`${id} `));
}

function statusOf(app, id, entry, place, running) {
  if (running === id) return "building";
  if (existsSync(join(app.repo, "docs/verdicts", `verdict-${id}.md`))) return "merged";
  if (entry?.status === "review") return "review";
  if (entry?.status === "blocked") return "blocked";
  if (place === "ready") return "queued";
  return "done";
}

function runningTicket(app, lines) {
  if (lockHolder(app.dir) === undefined) return undefined;
  const branch = git(app.repo, "branch", "--show-current");
  if (branch.startsWith("agent/")) return branch.slice("agent/".length);
  return lines.findLast((line) => /: started/.test(line.text))?.text.match(/(\d+-[\w-]+): started/)?.[1];
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
  const ids = [...new Set([...Object.keys(files), ...Object.keys(state.tickets)])].sort();
  const list = ids.map((id) => {
    const entry = state.tickets[id];
    const mine = runs.filter((run) => run.ticket === id);
    const said = mentions(lines, id);
    const status = statusOf(app, id, entry, files[id]?.place, running);
    return {
      id,
      title: files[id] ? title(read(files[id].file), id) : id,
      status,
      station: station(status, said),
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

export function ticket(app, claudeHome, id) {
  const waiting = inbox(app.dir).find((item) => item.id === id);
  if (waiting) return { ...waiting, timeline: [], runs: [] };
  const summary = tickets(app).find((item) => item.id === id);
  if (summary === undefined) return undefined;
  const file = ticketFiles(app.repo)[id]?.file;
  const verdictPath = `docs/verdicts/verdict-${id}.md`;
  const verdictText = read(join(app.repo, verdictPath)) || git(app.repo, "show", `agent/${id}:${verdictPath}`);
  const runs = jsonLines(join(app.dir, "runs.jsonl")).filter((run) => run.ticket === id).map((run) => runDetail(app, claudeHome, run));
  const full = json(join(app.dir, "state.json"), { tickets: {} }).tickets[id];
  return {
    ...summary,
    text: file ? read(file) : "",
    reason: full?.reason,
    verdictText,
    timeline: mentions(logLines(app.dir), id).map((line) => ({ at: line.at, text: line.text.replace(new RegExp(`^(${app.name} )?${id}:? ?`), "") })),
    runs,
    changed: summary.branch ? git(app.repo, "diff", "--stat", `${git(app.repo, "merge-base", "HEAD", summary.branch) || "HEAD"}..${summary.branch}`).split("\n").filter(Boolean) : [],
  };
}

function cost(runs, sinceMs) {
  const recent = runs.filter((run) => Date.now() - Date.parse(run.at) < sinceMs);
  return { runs: recent.length, usd: recent.reduce((total, run) => total + (run.costUsd ?? 0), 0) };
}

function now(app, claudeHome, lines) {
  const id = runningTicket(app, lines);
  if (id === undefined) return undefined;
  const said = mentions(lines, id);
  const started = said.findLast((line) => /started/.test(line.text));
  return {
    ticket: id,
    since: started?.at,
    step: said.at(-1)?.text.replace(new RegExp(`^(${app.name} )?${id}:? ?`), "") ?? "starting",
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
      now: now(app, claudeHome, lines),
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

export { STATIONS };
