// Starts and stops the one app instance and the one headless Chrome instance
// a drive needs. Everything here is started by the caller and stopped by the
// caller — never kill by process name, only by the handle returned below.

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForHttp, sleep } from "./cdp.mjs";

const CHROME_BIN =
  process.env.CHROME_BIN ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");
const CI_FLAGS = process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : [];

// Picks an OS-assigned free port, never 3000 (tiny-notes' documented default,
// reserved so a verify run can never collide with a dev server a human left running).
export async function findFreePort() {
  for (;;) {
    const port = await new Promise((resolve, reject) => {
      const srv = createServer();
      srv.unref();
      srv.on("error", reject);
      srv.listen(0, "127.0.0.1", () => {
        const { port } = srv.address();
        srv.close(() => resolve(port));
      });
    });
    if (port !== 3000) return port;
  }
}

export async function startServer(appPort, repoRoot) {
  const proc = spawn(process.execPath, ["--experimental-strip-types", "src/main.ts"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(appPort) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  proc.stdout.on("data", (d) => (out += d));
  proc.stderr.on("data", (d) => (out += d));
  proc.on("error", (err) => {
    out += `\n[spawn error] ${err.message}\n`;
  });
  try {
    await waitForHttp(`http://localhost:${appPort}/api/notes`, 10000);
  } catch (err) {
    proc.kill();
    throw new Error(`server on port ${appPort} never answered: ${err.message}\n--- server output ---\n${out}`);
  }
  return { proc, getOutput: () => out };
}

export function stopServer(handle) {
  if (!handle) return;
  handle.proc.kill();
}

// Chrome's cold start on a busy machine sometimes misses the devtools
// deadline. That is the machine, not the app, so try once more before failing.
export async function startChrome(cdpPort) {
  try {
    return await launchChrome(cdpPort);
  } catch (err) {
    console.error(`chrome did not start, retrying once: ${err.message}`);
    return launchChrome(cdpPort);
  }
}

async function launchChrome(cdpPort) {
  const userDataDir = await mkdtemp(join(tmpdir(), "tiny-notes-verify-"));
  const proc = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      ...CI_FLAGS,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      `--remote-debugging-port=${cdpPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let spawnError = "";
  proc.on("error", (err) => {
    spawnError = ` (${err.message})`;
  });
  try {
    await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`, 15000);
  } catch (err) {
    proc.kill();
    await rm(userDataDir, { recursive: true, force: true });
    throw new Error(`chrome devtools on port ${cdpPort} never answered: ${err.message}${spawnError}`);
  }
  return { proc, userDataDir };
}

export async function stopChrome(handle) {
  if (!handle) return;
  const exited = new Promise((resolve) => handle.proc.once("exit", resolve));
  handle.proc.kill();
  await Promise.race([exited, sleep(2000)]);
  // Chrome's helper processes can outlive the main one and keep writing to
  // the profile dir, so removal is retried. A leftover temp dir says nothing
  // about the app: warn and move on rather than fail the flow.
  try {
    await rm(handle.userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.error(`warning: could not remove chrome profile ${handle.userDataDir}: ${err.message}`);
  }
}

export async function openTab(cdpPort, url) {
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!res.ok) throw new Error(`failed to open tab for ${url}: HTTP ${res.status}`);
  return res.json();
}

export async function closeTab(cdpPort, tabId) {
  try {
    await fetch(`http://127.0.0.1:${cdpPort}/json/close/${tabId}`);
  } catch {
    // best effort; the chrome process is about to be killed anyway
  }
}
