#!/usr/bin/env node
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { openState } from "../orchestrator/lib/state.mjs";
import { check } from "./lib/verify-live.mjs";

const USAGE = "usage: verify-live.mjs --repo <path> --url <address of the deployed app>";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function number(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const repo = option("--repo");
  const url = option("--url");
  if (repo === undefined || url === undefined) throw new Error(USAGE);
  const env = process.env;
  const config = {
    repo: resolve(repo),
    url: url.replace(/\/+$/, ""),
    base: env.ACHENTIC_BASE ?? "main",
    command: env.ACHENTIC_LIVE_CHECK ?? "node tools/verify/drive.mjs live",
    ntfyUrl: env.ACHENTIC_NTFY_URL,
    confirmations: number("ACHENTIC_SENSOR_CONFIRMATIONS", 2),
    dailyCap: number("ACHENTIC_SENSOR_DAILY_CAP", 2),
    timeoutMs: number("ACHENTIC_SENSOR_MINUTES", 5) * 60_000,
  };
  const home = join(env.ACHENTIC_HOME ?? join(homedir(), ".achentic"), basename(config.repo));
  const state = openState(home);
  state.log(`sensor: ${await check(config, state)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
