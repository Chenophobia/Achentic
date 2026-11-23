import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import type { Store } from "./store.ts";
import { createStore } from "./store.ts";

const indexPath = fileURLToPath(new URL("../public/index.html", import.meta.url));

const MAX_NOTE_LENGTH = 280;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += (chunk as Buffer).toString();
  return raw ? JSON.parse(raw) : {};
}

async function serveIndex(res: ServerResponse): Promise<void> {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(await readFile(indexPath));
}

async function createNote(req: IncomingMessage, res: ServerResponse, store: Store): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { error: "invalid JSON" });
    return;
  }
  const bodyObj =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const text = bodyObj.text;
  if (typeof text !== "string" || text.trim() === "") {
    json(res, 400, { error: "text is required" });
    return;
  }
  const trimmed = text.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    json(res, 400, { error: `text must be at most ${MAX_NOTE_LENGTH} characters` });
    return;
  }
  json(res, 201, store.add(trimmed));
}

async function route(req: IncomingMessage, res: ServerResponse, store: Store): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    await serveIndex(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { status: "ok" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/notes") {
    json(res, 200, store.list());
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/notes") {
    await createNote(req, res, store);
    return;
  }
  const id = url.pathname.match(/^\/api\/notes\/(\d+)$/)?.[1];
  if (req.method === "DELETE" && id !== undefined) {
    json(res, store.remove(Number(id)) ? 200 : 404, {});
    return;
  }
  json(res, 404, { error: "not found" });
}

export function createApp(store: Store = createStore()) {
  return createServer(async (req, res) => {
    try {
      await route(req, res, store);
    } catch {
      if (!res.headersSent) json(res, 400, { error: "bad request" });
    }
  });
}
