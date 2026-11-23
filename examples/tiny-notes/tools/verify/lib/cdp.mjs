// Minimal Chrome DevTools Protocol client. Node 22's global WebSocket and fetch
// are enough to drive headless Chrome with zero npm dependencies.

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHttp(url, timeoutMs = 10000, intervalMs = 150) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(500, intervalMs * 2)) });
      if (res.ok) return res;
      lastError = new Error(`${url} -> HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting for ${url}: ${lastError?.message ?? "no response"}`);
}

// Polls `fn` until it returns a truthy value, or throws after `timeoutMs`.
// Used to wait for DOM/app state to settle after a simulated user action.
export async function waitFor(fn, { timeoutMs = 5000, intervalMs = 100, label = "condition" } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`${label} not met within ${timeoutMs}ms (last value: ${JSON.stringify(last)})`);
}

export class CdpSession {
  constructor(webSocketDebuggerUrl) {
    this.wsUrl = webSocketDebuggerUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", (err) => reject(new Error(`CDP websocket error: ${err.message ?? err}`)), {
        once: true,
      });
    });
    this.ws.addEventListener("message", (event) => this._onMessage(event));
  }

  _onMessage(event) {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      const waiters = this.listeners.get(msg.method);
      if (waiters) for (const handler of [...waiters]) handler(msg.params);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url, timeoutMs = 10000) {
    const loaded = this.waitForEvent("Page.loadEventFired", timeoutMs);
    await this.send("Page.navigate", { url });
    await loaded;
  }

  waitForEvent(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.get(method)?.delete(handler);
        reject(new Error(`timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      const handler = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      if (!this.listeners.has(method)) this.listeners.set(method, new Set());
      this.listeners.get(method).add(handler);
    });
  }

  // Runs `expression` in the page. Use for driving the real UI (set an input's
  // value and dispatch events, click a button) and for reading back DOM/storage
  // state — never for calling a test-only setter the app doesn't expose to users.
  async evalExpr(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const desc = result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails);
      throw new Error(`page threw: ${desc}`);
    }
    return result.result.value;
  }

  async screenshot(path) {
    const { writeFile } = await import("node:fs/promises");
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path, Buffer.from(data, "base64"));
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // already closed
    }
  }
}
