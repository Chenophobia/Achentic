import { basename } from "node:path";
import { notify } from "../../orchestrator/lib/notify.mjs";
import { git } from "../../orchestrator/lib/proc.mjs";
import { commitTicket, nextId, openMemory } from "../../sensors/lib/tickets.mjs";

const PER_RUN = 5;

async function openIssues(config) {
  const query = new URLSearchParams({ labels: config.label, state: "open", per_page: "50", sort: "created", direction: "asc" });
  const headers = { accept: "application/vnd.github+json", "user-agent": "achentic-intake" };
  if (config.token) headers.authorization = `Bearer ${config.token}`;
  const response = await fetch(`${config.api}/repos/${config.github}/issues?${query}`, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return response.json();
}

function slug(title) {
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return words.slice(0, 40).replace(/-+$/, "") || "issue";
}

function ticketText(id, issue) {
  const body = String(issue.body ?? "").trim() || "No description was given. Ask for one in the report instead of guessing.";
  return `# ${issue.title}

${body}

## Source
GitHub issue #${issue.number} by ${issue.user.login}: ${issue.html_url}

## Constraints
- Do not edit gate or CI configuration.
- Commit locally on the branch \`agent/${id}\`. Do not push.
`;
}

function accepted(config, memory, issue) {
  if (issue.pull_request !== undefined) return false;
  if (memory.data.seen[issue.number] !== undefined) return false;
  return config.authors.includes(issue.user.login.toLowerCase());
}

function refused(config, memory, issue) {
  if (issue.pull_request !== undefined || memory.data.refused[issue.number]) return false;
  return !config.authors.includes(issue.user.login.toLowerCase());
}

export async function intake(config, state) {
  if (!state.lock()) return "locked";
  const memory = openMemory(state.dir, "intake-issues.json", { seen: {}, refused: {} });
  const name = basename(config.repo);
  try {
    const issues = await openIssues(config);
    for (const issue of issues.filter((item) => refused(config, memory, item))) {
      memory.data.refused[issue.number] = issue.user.login;
      await notify(config, state, `${name}: issue #${issue.number} ignored`, `Opened by ${issue.user.login}, who is not on the allowed list.`);
    }
    const fresh = issues.filter((item) => accepted(config, memory, item)).slice(0, PER_RUN);
    if (fresh.length === 0) return "ok";
    if (git(config.repo, "branch", "--show-current") !== config.base) return "deferred";
    for (const issue of fresh) {
      const id = nextId(config.repo, slug(issue.title));
      commitTicket(config.repo, id, ticketText(id, issue), `Ticket ${id} from issue #${issue.number}`);
      memory.data.seen[issue.number] = id;
      await notify(config, state, `${name} ${id}: queued`, `From issue #${issue.number}: ${issue.title}`);
    }
    return "ticket";
  } catch (error) {
    state.log(`intake: ${error.message}`);
    return "down";
  } finally {
    memory.save();
    state.unlock();
  }
}
