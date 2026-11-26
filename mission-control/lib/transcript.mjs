import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const SKILL_FILE = /\/(skills|playbooks)\/([^/]+?)(?:\/SKILL)?\.md$/;
const RECENT_MS = 10 * 60_000;

function lines(file) {
  const rows = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line === "") continue;
    try {
      rows.push(JSON.parse(line));
    } catch {}
  }
  return rows;
}

function toolUses(rows) {
  return rows.flatMap((row) => {
    const content = row.message?.content;
    if (row.type !== "assistant" || !Array.isArray(content)) return [];
    return content.filter((block) => block.type === "tool_use").map((block) => ({ ...block, at: row.timestamp }));
  });
}

function firstPrompt(rows) {
  for (const row of rows) {
    const content = row.message?.content;
    if (row.type !== "user") continue;
    if (typeof content === "string") return content;
    const text = Array.isArray(content) ? content.find((block) => block.type === "text")?.text : undefined;
    if (text) return text;
  }
  return "";
}

function short(text, limit = 90) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

function describe(use) {
  const input = use.input ?? {};
  if (use.name === "Bash") return short(input.command);
  if (use.name === "Agent" || use.name === "Task") return short(input.description);
  if (use.name === "Skill") return short(input.skill);
  return short(input.file_path ?? input.pattern ?? input.query ?? input.url ?? "");
}

function skillsUsed(rows, uses) {
  const found = new Set();
  const opening = firstPrompt(rows).slice(0, 600);
  const command = opening.match(/<command-name>\/?([\w:-]+)/)?.[1] ?? opening.match(/(?:^|\s)\/([a-z][\w-]*:[\w-]+)/)?.[1];
  if (command) found.add(command);
  for (const use of uses) {
    if (use.name === "Skill" && use.input?.skill) found.add(String(use.input.skill));
    const match = use.name === "Read" ? String(use.input?.file_path ?? "").match(SKILL_FILE) : null;
    if (match) found.add(match[1] === "playbooks" ? `playbook: ${match[2]}` : match[2]);
  }
  return [...found];
}

function count(values) {
  const totals = {};
  for (const value of values) totals[value] = (totals[value] ?? 0) + 1;
  return totals;
}

function summarise(rows, root) {
  const uses = toolUses(rows);
  const stamps = rows.map((row) => row.timestamp).filter(Boolean).sort();
  const edited = uses.filter((use) => use.name === "Edit" || use.name === "Write").map((use) => String(use.input?.file_path ?? ""));
  return {
    startedAt: stamps[0],
    endedAt: stamps.at(-1),
    models: Object.keys(count(rows.map((row) => row.message?.model).filter(Boolean))),
    tools: count(uses.map((use) => use.name)),
    skills: skillsUsed(rows, uses),
    files: [...new Set(edited)].map((path) => (root && path.startsWith(root) ? path.slice(root.length + 1) : path)),
    commands: uses.filter((use) => use.name === "Bash").map((use) => ({ at: use.at, text: describe(use) })),
    last: uses.length > 0 ? { at: uses.at(-1).at, tool: uses.at(-1).name, text: describe(uses.at(-1)) } : undefined,
  };
}

function subagents(dir, rows, root) {
  const asked = toolUses(rows).filter((use) => use.name === "Agent" || use.name === "Task");
  const folder = join(dir, "subagents");
  const files = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".jsonl")).sort() : [];
  const ran = files.map((name) => {
    const summary = summarise(lines(join(folder, name)), root);
    const metaFile = join(folder, name.replace(".jsonl", ".meta.json"));
    const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : {};
    return { ...summary, description: meta.description, kind: meta.agentType };
  });
  ran.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  return asked.map((use, index) => {
    const match = ran.find((item) => item.description === use.input?.description) ?? ran[index] ?? {};
    return {
      description: short(use.input?.description, 120),
      kind: use.input?.subagent_type ?? match.kind ?? "agent",
      askedModel: use.input?.model,
      models: match.models ?? [],
      tools: match.tools ?? {},
      skills: match.skills ?? [],
      files: match.files ?? [],
      startedAt: match.startedAt ?? use.at,
      endedAt: match.endedAt,
    };
  });
}

function projectDirs(claudeHome) {
  const base = join(claudeHome, "projects");
  return existsSync(base) ? readdirSync(base).map((name) => join(base, name)) : [];
}

export function activity(claudeHome, sessionId, root) {
  if (!sessionId) return undefined;
  for (const dir of projectDirs(claudeHome)) {
    const file = join(dir, `${sessionId}.jsonl`);
    if (!existsSync(file)) continue;
    try {
      const rows = lines(file);
      return { ...summarise(rows, root), subagents: subagents(join(dir, sessionId), rows, root) };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function liveAction(claudeHome, repo) {
  const dir = join(claudeHome, "projects", repo.replace(/[^a-zA-Z0-9]/g, "-"));
  if (!existsSync(dir)) return undefined;
  const newest = readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => ({ name, at: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.at - a.at)[0];
  if (newest === undefined || Date.now() - newest.at > RECENT_MS) return undefined;
  try {
    const session = basename(newest.name, ".jsonl");
    const summary = activity(claudeHome, session, repo);
    return summary?.last ? { ...summary.last, session, subagents: summary.subagents.filter((agent) => !agent.endedAt || Date.now() - Date.parse(agent.endedAt) < 60_000).length } : undefined;
  } catch {
    return undefined;
  }
}
