import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { git } from "../../orchestrator/lib/proc.mjs";

export function today() {
  return new Date().toLocaleDateString("sv-SE");
}

export function openMemory(dir, name, initial) {
  const file = join(dir, name);
  const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : initial;
  return { data, save: () => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`) };
}

const TICKET_FILE = /^(?:(\d+)-.*|[A-Z][A-Z0-9]*-(\d+))\.md$/;

export function ticketNumber(name) {
  const match = name.endsWith(".md") ? name.match(TICKET_FILE) : `${name}.md`.match(TICKET_FILE);
  return match ? Number(match[1] ?? match[2]) : undefined;
}

function ticketNumbers(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return ticketNumbers(join(dir, entry.name));
    const number = ticketNumber(entry.name);
    return number === undefined ? [] : [number];
  });
}

export function projectKey(repo) {
  const words = basename(repo).split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((word) => word[0]).join("") : (words[0] ?? "T").slice(0, 3);
  return letters.toUpperCase().replace(/^[^A-Z]+/, "") || "T";
}

export function nextId(repo) {
  const next = Math.max(0, ...ticketNumbers(join(repo, "tickets"))) + 1;
  return `${projectKey(repo)}-${next}`;
}

export function workDir(id) {
  return `docs/work/${id}`;
}

export function verdictPaths(id) {
  return [`${workDir(id)}/4-test/verdict.md`, `docs/verdicts/verdict-${id}.md`];
}

export function titleOf(text, fallback) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;
}

export function commitTicket(repo, id, text, subject) {
  const path = join("tickets/ready", `${id}.md`);
  mkdirSync(join(repo, "tickets/ready"), { recursive: true });
  writeFileSync(join(repo, path), text);
  git(repo, "add", path);
  git(repo, "commit", "-m", subject);
}

export function isQueued(repo, id) {
  return existsSync(join(repo, "tickets/ready", `${id}.md`));
}

export function isJudged(repo, id) {
  return verdictPaths(id).some((path) => existsSync(join(repo, path)));
}

export function fenced(text) {
  return `\`\`\`text\n${text.replaceAll("```", "'''")}\n\`\`\``;
}
