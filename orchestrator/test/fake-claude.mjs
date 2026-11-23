#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const planFile = process.env.FAKE_PLAN;
const plan = JSON.parse(readFileSync(planFile, "utf8"));
const counter = `${planFile}.n`;
const index = existsSync(counter) ? Number(readFileSync(counter, "utf8")) : 0;
writeFileSync(counter, String(index + 1));
appendFileSync(`${planFile}.calls`, `${JSON.stringify(process.argv.slice(2))}\n`);

const step = plan[index] ?? { result: "no step planned", error: true };
for (const [path, content] of Object.entries(step.write ?? {})) writeFileSync(path, content);
for (const path of step.remove ?? []) rmSync(path);
if (step.commit) {
  execFileSync("git", ["add", "-A"]);
  execFileSync("git", ["commit", "-q", "-m", `step ${index}`]);
}
console.log(
  JSON.stringify({
    result: step.result ?? "done",
    is_error: step.error === true,
    session_id: "session-1",
    num_turns: 1,
    duration_ms: 1,
    total_cost_usd: 0,
  }),
);
