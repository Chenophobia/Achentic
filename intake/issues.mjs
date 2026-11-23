#!/usr/bin/env node
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { openState } from "../orchestrator/lib/state.mjs";
import { intake } from "./lib/issues.mjs";

const USAGE = "usage: issues.mjs --repo <path> --github <owner/name> [--authors login,login]";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const env = process.env;
  const repo = option("--repo");
  const github = option("--github");
  if (repo === undefined || github === undefined || !github.includes("/")) throw new Error(USAGE);
  const owner = github.split("/")[0];
  const config = {
    repo: resolve(repo),
    github,
    authors: (option("--authors") ?? env.ACHENTIC_ISSUE_AUTHORS ?? owner).toLowerCase().split(",").map((login) => login.trim()),
    label: env.ACHENTIC_ISSUE_LABEL ?? "agent",
    token: env.ACHENTIC_GITHUB_TOKEN,
    api: env.ACHENTIC_GITHUB_API ?? "https://api.github.com",
    base: env.ACHENTIC_BASE ?? "main",
    discordUrl: env.ACHENTIC_DISCORD_WEBHOOK_URL,
  };
  const home = join(env.ACHENTIC_HOME ?? join(homedir(), ".achentic"), basename(config.repo));
  const state = openState(home);
  state.log(`intake: ${await intake(config, state)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
