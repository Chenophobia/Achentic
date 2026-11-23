import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "../../orchestrator/lib/proc.mjs";

export function today() {
  return new Date().toLocaleDateString("sv-SE");
}

export function openMemory(dir, name, initial) {
  const file = join(dir, name);
  const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : initial;
  return { data, save: () => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`) };
}

function ticketNumbers(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return ticketNumbers(join(dir, entry.name));
    const number = Number(entry.name.match(/^(\d+)-/)?.[1]);
    return Number.isInteger(number) ? [number] : [];
  });
}

export function nextId(repo, slug) {
  const next = Math.max(0, ...ticketNumbers(join(repo, "tickets"))) + 1;
  return `${String(next).padStart(3, "0")}-${slug}`;
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
  return existsSync(join(repo, "docs/verdicts", `verdict-${id}.md`));
}

export function fenced(text) {
  return `\`\`\`text\n${text.replaceAll("```", "'''")}\n\`\`\``;
}
