import { execFileSync, spawn } from "node:child_process";

const DRAIN_MS = 2000;

function killGroup(pid, signal) {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {}
}

export function run(command, args, { cwd, timeoutMs, env = process.env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const settle = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid, "SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      stderr += String(error);
      settle(127);
    });
    child.on("exit", (code) => {
      killGroup(child.pid, "SIGTERM");
      setTimeout(() => settle(code ?? 1), DRAIN_MS).unref();
    });
    child.on("close", (code) => settle(code ?? 1));
  });
}

export function git(repo, ...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

export function tail(text, lines) {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}
