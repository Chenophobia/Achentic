#!/usr/bin/env node
import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileIdea, listApps, overview, ticket, tickets } from "./lib/data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BODY_LIMIT = 20_000;
const FIELDS = ["title", "goal", "doneCheck", "proof", "known"];

function send(res, status, body, type = "application/json") {
  const text = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY" });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = "";
    req.on("data", (chunk) => {
      text += chunk;
      if (text.length > BODY_LIMIT) reject(new Error("too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(text || "{}"));
      } catch {
        reject(new Error("not JSON"));
      }
    });
  });
}

function same(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookie(req, name) {
  const found = String(req.headers.cookie ?? "").split(";").map((part) => part.trim().split("=")).find(([key]) => key === name);
  return found ? decodeURIComponent(found[1] ?? "") : "";
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  return origin === undefined || new URL(origin).host === req.headers.host;
}

function idea(input) {
  const clean = {};
  for (const field of FIELDS) clean[field] = typeof input[field] === "string" ? input[field].slice(0, 4000) : "";
  if (clean.title.trim() === "" || clean.goal.trim() === "" || clean.doneCheck.trim() === "") return undefined;
  return clean;
}

function retry(config, app, id) {
  return new Promise((resolve) => {
    const script = join(here, "../orchestrator/orchestrator.mjs");
    execFile(process.execPath, [script, "retry", id, "--repo", app.repo], { env: { ...process.env, ACHENTIC_HOME: config.home } }, (error, stdout, stderr) => {
      resolve(error ? { ok: false, message: (stderr || error.message).trim() } : { ok: true, message: stdout.trim() });
    });
  });
}

async function post(config, req, res, app, parts) {
  if (!sameOrigin(req) || !String(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 403, { error: "This request did not come from the page." });
  const input = await readBody(req);
  if (parts.length === 1 && parts[0] === "tickets") {
    const clean = idea(input);
    if (clean === undefined) return send(res, 400, { error: "A ticket needs a title, a goal and a done-check." });
    return send(res, 201, { id: fileIdea(app, clean) });
  }
  if (parts.length === 3 && parts[0] === "tickets" && parts[2] === "retry") {
    if (existsSync(join(app.dir, "lock"))) return send(res, 409, { error: "The orchestrator is working on this project. Try again when it has finished." });
    const result = await retry(config, app, parts[1]);
    return send(res, result.ok ? 200 : 400, result.ok ? { message: result.message } : { error: result.message });
  }
  return send(res, 404, { error: "No such action." });
}

function get(config, res, app, parts) {
  if (parts.length === 1 && parts[0] === "tickets") return send(res, 200, tickets(app));
  if (parts.length === 2 && parts[0] === "tickets") {
    const found = ticket(app, config.claudeHome, parts[1]);
    return found ? send(res, 200, found) : send(res, 404, { error: "No such ticket." });
  }
  return send(res, 404, { error: "Nothing here." });
}

async function api(config, req, res, path) {
  if (path === "/api/overview") return send(res, 200, overview(config.home, config.claudeHome));
  const [, , kind, name, ...parts] = path.split("/").map(decodeURIComponent);
  const app = kind === "apps" ? listApps(config.home).find((item) => item.name === name) : undefined;
  if (app === undefined) return send(res, 404, { error: "No such project." });
  if (parts.some((part) => !/^[\w.-]+$/.test(part))) return send(res, 400, { error: "Bad name." });
  return req.method === "POST" ? post(config, req, res, app, parts) : get(config, res, app, parts);
}

async function login(config, req, res) {
  if (!sameOrigin(req)) return send(res, 403, { error: "This request did not come from the page." });
  const input = await readBody(req);
  if (!same(input.token ?? "", config.token)) return send(res, 401, { error: "That is not the access word." });
  res.setHeader("set-cookie", `mc=${encodeURIComponent(config.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
  return send(res, 200, { ok: true });
}

export function createMissionControl(config) {
  const page = () => readFileSync(join(here, "public/index.html"), "utf8");
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "POST" && path === "/login" && config.token) return await login(config, req, res);
      if (path === "/") return send(res, 200, page(), "text/html");
      if (!path.startsWith("/api/")) return send(res, 404, { error: "Nothing here." });
      if (config.token && !same(cookie(req, "mc"), config.token)) return send(res, 401, { error: "Sign in first." });
      return await api(config, req, res, path);
    } catch (error) {
      if (!res.headersSent) send(res, 400, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const config = {
    home: env.ACHENTIC_HOME ?? join(homedir(), ".achentic"),
    claudeHome: env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
    token: env.ACHENTIC_MC_TOKEN ?? "",
  };
  const host = env.ACHENTIC_MC_HOST ?? "127.0.0.1";
  const port = Number(env.ACHENTIC_MC_PORT ?? 4400);
  createMissionControl(config).listen(port, host, () => console.log(`mission control on http://${host}:${port}  (projects from ${config.home})`));
}
