#!/usr/bin/env node
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { beat } from "../orchestrator/lib/heartbeat.mjs";
import { openState } from "../orchestrator/lib/state.mjs";
import { collect } from "./lib/errors.mjs";

const USAGE = "usage: errors.mjs --repo <path> --url <error tracker address> --org <slug> --project <slug>\n       (API token in ACHENTIC_GLITCHTIP_TOKEN)";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function number(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const env = process.env;
  const config = {
    repo: option("--repo"),
    url: option("--url")?.replace(/\/+$/, ""),
    org: option("--org"),
    project: option("--project"),
    token: env.ACHENTIC_GLITCHTIP_TOKEN,
    base: env.ACHENTIC_BASE ?? "main",
    ntfyUrl: env.ACHENTIC_NTFY_URL,
    minEvents: number("ACHENTIC_ERRORS_MIN_EVENTS", 1),
    dailyCap: number("ACHENTIC_SENSOR_DAILY_CAP", 2),
  };
  if (Object.values({ ...config, ntfyUrl: "" }).includes(undefined)) throw new Error(USAGE);
  config.repo = resolve(config.repo);
  const home = join(env.ACHENTIC_HOME ?? join(homedir(), ".achentic"), basename(config.repo));
  const state = openState(home);
  const result = await collect(config, state);
  state.log(`sensor errors: ${result}`);
  await beat(env.ACHENTIC_ERRORS_HEARTBEAT_URL, result);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
