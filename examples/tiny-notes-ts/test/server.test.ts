import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createServer } from "node:http";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createErrorReporter } from "../src/error-reporter.ts";
import { createApp } from "../src/server.ts";
import type { Note, Store } from "../src/store.ts";
import { createStore } from "../src/store.ts";

function listeningPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("expected a network address");
  return address.port;
}

async function withServer(server: Server, run: (base: string) => Promise<void>): Promise<void> {
  server.listen(0);
  const base = `http://localhost:${listeningPort(server)}`;
  try {
    await run(base);
  } finally {
    server.close();
  }
}

function withApp(run: (base: string) => Promise<void>): Promise<void> {
  return withServer(createApp(), run);
}

const post = (base: string, body: unknown) =>
  fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

type TrackerRequest = { pathname: string; auth: string; body: string };

function startTracker(delayMs = 0) {
  const requests: TrackerRequest[] = [];
  const waiters: Array<(received: TrackerRequest) => void> = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += (chunk as Buffer).toString();
    const received: TrackerRequest = {
      pathname: new URL(req.url ?? "/", "http://localhost").pathname,
      auth: String(req.headers["x-sentry-auth"] ?? ""),
      body: raw,
    };
    requests.push(received);
    for (const wake of waiters.splice(0)) wake(received);
    setTimeout(() => {
      if (res.destroyed) return;
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    }, delayMs).unref();
  });
  server.listen(0);
  return {
    dsn: `http://testkey@localhost:${listeningPort(server)}/42`,
    requests,
    nextRequest: () =>
      new Promise<TrackerRequest>((resolve) => {
        const first = requests[0];
        if (first === undefined) waiters.push(resolve);
        else resolve(first);
      }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

function explodingStore(message: string): Store {
  const explode = (): never => {
    throw new Error(message);
  };
  return { list: explode, add: explode, remove: explode };
}

type ReportedFrame = { filename: string; function: string; lineno: number };

type ReportedEvent = {
  event_id: string;
  timestamp: string;
  platform: string;
  level: string;
  request: { method: string; url: string };
  exception: {
    values: Array<{ type: string; value: string; stacktrace: { frames: ReportedFrame[] } }>;
  };
};

test("adds, lists and deletes a note", async () => {
  await withApp(async (base) => {
    const created = (await (await post(base, { text: "buy milk" })).json()) as Note;
    assert.equal(created.text, "buy milk");

    const listed = (await (await fetch(`${base}/api/notes`)).json()) as Note[];
    assert.deepEqual(
      listed.map((note) => note.text),
      ["buy milk"],
    );

    const removed = await fetch(`${base}/api/notes/${created.id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/notes`)).json(), []);
  });
});

test("rejects an empty note", async () => {
  await withApp(async (base) => {
    assert.equal((await post(base, { text: "   " })).status, 400);
  });
});

test("rejects a note longer than 280 characters", async () => {
  await withApp(async (base) => {
    const res = await post(base, { text: "a".repeat(281) });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(typeof body.error, "string");

    const listed = (await (await fetch(`${base}/api/notes`)).json()) as Note[];
    assert.deepEqual(listed, []);
  });
});

test("accepts a note of exactly 280 characters", async () => {
  await withApp(async (base) => {
    const res = await post(base, { text: "a".repeat(280) });
    assert.equal(res.status, 201);
    const created = (await res.json()) as Note;
    assert.equal(created.text.length, 280);
  });
});

test("responds 400 to invalid JSON and keeps serving after", async () => {
  await withApp(async (base) => {
    const bad = await fetch(`${base}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nope",
    });
    assert.equal(bad.status, 400);

    const after = await fetch(`${base}/api/notes`);
    assert.equal(after.status, 200);
  });
});

test("responds 4xx to GET // and keeps serving after", async () => {
  await withApp(async (base) => {
    const bad = await fetch(`${base}//`);
    assert.equal(bad.status >= 400 && bad.status < 500, true);

    const after = await fetch(`${base}/api/notes`);
    assert.equal(after.status, 200);
  });
});

test("responds 400 to a JSON null body and keeps serving after", async () => {
  await withApp(async (base) => {
    const bad = await post(base, null);
    assert.equal(bad.status, 400);

    const after = await fetch(`${base}/api/notes`);
    assert.equal(after.status, 200);
  });
});

test("responds ok to a health check", async () => {
  await withApp(async (base) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
  });
});

test("responds 404 to an unsupported method on the health path", async () => {
  await withApp(async (base) => {
    const bad = await fetch(`${base}/api/health`, { method: "POST" });
    assert.equal(bad.status, 404);
  });
});

test("serves the page", async () => {
  await withApp(async (base) => {
    const html = await (await fetch(base)).text();
    assert.match(html, /Tiny Notes/);
  });
});

test("posts exactly one Sentry event for an unexpected error", async () => {
  const tracker = startTracker();
  try {
    const app = createApp(explodingStore("store exploded"), createErrorReporter(tracker.dsn));
    await withServer(app, async (base) => {
      const failing = await fetch(`${base}/api/notes?debug=1`);
      assert.equal(failing.status, 400);
      assert.deepEqual(await failing.json(), { error: "bad request" });

      const received = await tracker.nextRequest();
      assert.equal(received.pathname, "/api/42/store/");
      assert.equal(
        received.auth,
        "Sentry sentry_version=7, sentry_key=testkey, sentry_client=tiny-notes/1.0",
      );
      assert.equal(received.body.includes("debug=1"), false);

      const event = JSON.parse(received.body) as ReportedEvent;
      assert.match(event.event_id, /^[0-9a-f]{32}$/);
      assert.equal(new Date(event.timestamp).toISOString(), event.timestamp);
      assert.equal(event.platform, "node");
      assert.equal(event.level, "error");
      assert.equal(event.request.method, "GET");
      assert.equal(event.request.url, "/api/notes");
      assert.equal(event.exception.values.length, 1);
      const details = event.exception.values[0];
      assert.ok(details);
      assert.equal(details.type, "Error");
      assert.equal(details.value, "store exploded");
      const frames = details.stacktrace.frames;
      assert.ok(frames.length >= 2);
      for (const frame of frames) {
        assert.equal(typeof frame.filename, "string");
        assert.equal(typeof frame.function, "string");
        assert.equal(typeof frame.lineno, "number");
      }
      const innermost = frames[frames.length - 1];
      assert.ok(innermost);
      assert.ok(innermost.function.includes("explode"));
      assert.ok(innermost.filename.includes("server.test"));

      assert.equal((await fetch(`${base}/api/health`)).status, 200);
      await delay(50);
      assert.equal(tracker.requests.length, 1);
    });
  } finally {
    await tracker.close();
  }
});

test("reports the method and path but never the note text", async () => {
  const tracker = startTracker();
  try {
    const app = createApp(explodingStore("add failed"), createErrorReporter(tracker.dsn));
    await withServer(app, async (base) => {
      const failing = await post(base, { text: "super secret note" });
      assert.equal(failing.status, 400);

      const received = await tracker.nextRequest();
      const event = JSON.parse(received.body) as ReportedEvent;
      assert.equal(event.request.method, "POST");
      assert.equal(event.request.url, "/api/notes");
      assert.equal(received.body.includes("super secret"), false);
      assert.equal(received.body.includes("content-type"), false);
    });
  } finally {
    await tracker.close();
  }
});

test("sends nothing when ERROR_DSN is unset", async () => {
  assert.equal(process.env.ERROR_DSN, undefined);
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (input, init) => {
    fetched.push(String(input));
    return originalFetch(input, init);
  };
  try {
    await withServer(createApp(explodingStore("boom")), async (base) => {
      const failing = await fetch(`${base}/api/notes`);
      assert.equal(failing.status, 400);
      assert.deepEqual(await failing.json(), { error: "bad request" });
      assert.equal((await fetch(`${base}/api/health`)).status, 200);
      await delay(50);
      assert.deepEqual(fetched, [`${base}/api/notes`, `${base}/api/health`]);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not report purposeful rejections", async () => {
  const tracker = startTracker();
  try {
    const app = createApp(createStore(), createErrorReporter(tracker.dsn));
    await withServer(app, async (base) => {
      const malformed = await fetch(`${base}/api/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{nope",
      });
      assert.equal(malformed.status, 400);
      assert.equal((await post(base, { text: "   " })).status, 400);
      assert.equal((await post(base, { text: "a".repeat(281) })).status, 400);
      assert.equal((await fetch(`${base}/api/nope`)).status, 404);
      assert.equal((await fetch(`${base}//`)).status, 400);
      await delay(50);
      assert.equal(tracker.requests.length, 0);
    });
  } finally {
    await tracker.close();
  }
});

test("responds in normal time while the tracker is slow", async () => {
  const tracker = startTracker(1000);
  try {
    const app = createApp(explodingStore("slow tracker"), createErrorReporter(tracker.dsn));
    await withServer(app, async (base) => {
      const started = Date.now();
      const failing = await fetch(`${base}/api/notes`);
      const elapsed = Date.now() - started;
      assert.equal(failing.status, 400);
      assert.ok(elapsed < 500);
      await tracker.nextRequest();
      assert.equal((await fetch(`${base}/api/health`)).status, 200);
    });
  } finally {
    await tracker.close();
  }
});

test("responds normally when the tracker is down", async () => {
  const tracker = startTracker();
  await tracker.close();
  const app = createApp(explodingStore("tracker down"), createErrorReporter(tracker.dsn));
  await withServer(app, async (base) => {
    const failing = await fetch(`${base}/api/notes`);
    assert.equal(failing.status, 400);
    assert.deepEqual(await failing.json(), { error: "bad request" });
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  });
});
