import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";

const indexPath = fileURLToPath(new URL("./public/index.html", import.meta.url));

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function createApp(store = createStore()) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(await readFile(indexPath));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/notes") {
        json(res, 200, store.list());
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/notes") {
        let body;
        try {
          body = await readBody(req);
        } catch {
          json(res, 400, { error: "invalid JSON" });
          return;
        }
        const { text } = body ?? {};
        if (typeof text !== "string" || text.trim() === "") {
          json(res, 400, { error: "text is required" });
          return;
        }
        json(res, 201, store.add(text.trim()));
        return;
      }
      const match = url.pathname.match(/^\/api\/notes\/(\d+)$/);
      if (req.method === "DELETE" && match) {
        json(res, store.remove(Number(match[1])) ? 200 : 404, {});
        return;
      }
      json(res, 404, { error: "not found" });
    } catch {
      if (!res.headersSent) json(res, 400, { error: "bad request" });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`tiny-notes on http://localhost:${port}`));
}
