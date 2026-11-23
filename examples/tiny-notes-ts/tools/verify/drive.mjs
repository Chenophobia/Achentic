#!/usr/bin/env node
// Drives one (or all) tiny-notes features end to end in a real headless
// browser (or, for "resilience", straight HTTP) and writes evidence under
// .verify-evidence/. Run from the repo root:
//
//   node tools/verify/drive.mjs <add-delete|dark-mode|length-limit|resilience|all>
//   VERIFY_BASE_URL=https://notes.example.com node tools/verify/drive.mjs live
//
// Each run starts its own server (on a free port, never 3000) and its own
// headless Chrome instance (for the browser features), and tears down only
// what it started. Evidence (screenshots + a text log per feature) is left
// in place after teardown.

import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CdpSession, waitFor } from "./lib/cdp.mjs";
import {
  findFreePort,
  startServer,
  stopServer,
  startChrome,
  stopChrome,
  openTab,
  closeTab,
} from "./lib/harness.mjs";

const FEATURES = ["add-delete", "dark-mode", "length-limit", "resilience"];
// Flows that are safe against a deployed app: they leave no data behind and
// send no malformed requests. Only these may run when VERIFY_BASE_URL is set.
const LIVE_FEATURES = ["add-delete", "dark-mode"];
const LIVE_URL = process.env.VERIFY_BASE_URL?.replace(/\/+$/, "");
const feature = process.argv[2];

if (!feature || (!["all", "live"].includes(feature) && !FEATURES.includes(feature))) {
  console.error(`usage: node tools/verify/drive.mjs <${FEATURES.join("|")}|all|live>`);
  process.exit(1);
}
if (feature === "live" && !LIVE_URL) {
  console.error("live needs VERIFY_BASE_URL, the address of the deployed app");
  process.exit(1);
}
if (LIVE_URL && feature !== "live" && !LIVE_FEATURES.includes(feature)) {
  console.error(`refusing to run "${feature}" against ${LIVE_URL}: only ${LIVE_FEATURES.join(", ")} are safe on a deployed app`);
  process.exit(1);
}

const repoRoot = process.cwd();
const evidenceDir = join(repoRoot, ".verify-evidence");
await mkdir(evidenceDir, { recursive: true });

function makeLogger(name) {
  const logPath = join(evidenceDir, `${name}.log`);
  return {
    logPath,
    async reset() {
      await writeFile(logPath, "");
    },
    async log(line) {
      const stamped = `[${new Date().toISOString()}] ${line}`;
      console.log(`[${name}] ${line}`);
      await appendFile(logPath, stamped + "\n");
    },
  };
}

// Against a deployed app (VERIFY_BASE_URL) nothing is started; otherwise this
// starts a private server on a free port.
async function startApp(log) {
  if (LIVE_URL) {
    await log(`target: deployed app at ${LIVE_URL}`);
    return { baseUrl: LIVE_URL, server: undefined };
  }
  const appPort = await findFreePort();
  const server = await startServer(appPort, repoRoot);
  await log(`server ready at http://localhost:${appPort}`);
  return { baseUrl: `http://localhost:${appPort}`, server };
}

async function runAddDelete({ cdp, log, baseUrl }) {
  const noteText = `verify-${Date.now()}`;
  await cdp.screenshot(join(evidenceDir, "add-delete-01-loaded.png"));

  await cdp.evalExpr(`
    (() => {
      const input = document.querySelector("#text");
      input.value = ${JSON.stringify(noteText)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#new-note").requestSubmit();
    })()
  `);
  await log(`submitted note "${noteText}" through the real form`);

  await waitFor(
    () =>
      cdp.evalExpr(
        `Array.from(document.querySelectorAll("#notes li span")).some(s => s.textContent === ${JSON.stringify(noteText)})`,
      ),
    { timeoutMs: 5000, label: "note appearing in the DOM" },
  );
  await log("note appeared in the DOM after render()");
  await cdp.screenshot(join(evidenceDir, "add-delete-02-added.png"));

  const listed = await (await fetch(`${baseUrl}/api/notes`)).json();
  const created = listed.find((n) => n.text === noteText);
  if (!created) throw new Error("note not present via GET /api/notes after add");
  await log(`verified via API: note id ${created.id} stored with text "${created.text}"`);

  await cdp.evalExpr(`
    (() => {
      const li = Array.from(document.querySelectorAll("#notes li")).find(
        (el) => el.querySelector("span").textContent === ${JSON.stringify(noteText)}
      );
      li.querySelector("button").click();
    })()
  `);
  await log("clicked Delete on the note");

  await waitFor(
    () =>
      cdp.evalExpr(
        `!Array.from(document.querySelectorAll("#notes li span")).some(s => s.textContent === ${JSON.stringify(noteText)})`,
      ),
    { timeoutMs: 5000, label: "note disappearing from the DOM" },
  );
  await cdp.screenshot(join(evidenceDir, "add-delete-03-deleted.png"));

  const after = await (await fetch(`${baseUrl}/api/notes`)).json();
  if (after.some((n) => n.id === created.id)) throw new Error("note still present via GET /api/notes after delete");
  await log(`verified via API: note id ${created.id} no longer stored`);
}

async function runDarkMode({ cdp, log, baseUrl }) {
  const initial = await cdp.evalExpr(`document.documentElement.dataset.theme`);
  await log(`initial theme: ${initial}`);
  await cdp.screenshot(join(evidenceDir, "dark-mode-01-initial.png"));

  await cdp.evalExpr(`document.querySelector("#theme-toggle").click()`);
  const toggled = await waitFor(
    () => cdp.evalExpr(`document.documentElement.dataset.theme`).then((t) => (t !== initial ? t : null)),
    { timeoutMs: 3000, label: "theme changing after click" },
  );
  await log(`toggled theme to: ${toggled}`);
  await cdp.screenshot(join(evidenceDir, "dark-mode-02-toggled.png"));

  const stored = await cdp.evalExpr(`localStorage.getItem("theme")`);
  if (stored !== toggled) throw new Error(`localStorage theme "${stored}" does not match applied theme "${toggled}"`);
  await log(`verified localStorage persisted "${stored}"`);

  await cdp.navigate(`${baseUrl}/`);
  const afterReload = await cdp.evalExpr(`document.documentElement.dataset.theme`);
  if (afterReload !== toggled) {
    throw new Error(`theme reverted on reload: expected "${toggled}", got "${afterReload}"`);
  }
  await log(`verified theme "${afterReload}" survives a reload`);
  await cdp.screenshot(join(evidenceDir, "dark-mode-03-after-reload.png"));

  await cdp.evalExpr(`document.querySelector("#theme-toggle").click()`);
  const reverted = await waitFor(
    () => cdp.evalExpr(`document.documentElement.dataset.theme`).then((t) => (t === initial ? t : null)),
    { timeoutMs: 3000, label: "theme reverting after second click" },
  );
  await log(`toggled back to original theme: ${reverted}`);
}

async function runLengthLimit({ cdp, log, baseUrl }) {
  await cdp.screenshot(join(evidenceDir, "length-limit-01-loaded.png"));

  const typed = await cdp.evalExpr(`
    (() => {
      const input = document.querySelector("#text");
      input.value = "a".repeat(281);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return {
        length: input.value.length,
        remaining: document.querySelector("#remaining").textContent,
      };
    })()
  `);
  await log(`set a 281-char value via the DOM; input clamped to ${typed.length}, counter reads "${typed.remaining}"`);
  if (typed.length !== 280) throw new Error(`expected the input to clamp to 280 chars, got ${typed.length}`);
  if (typed.remaining !== "0 characters left") {
    throw new Error(`expected the counter to read "0 characters left", got "${typed.remaining}"`);
  }
  await cdp.screenshot(join(evidenceDir, "length-limit-02-clamped.png"));

  const over = await fetch(`${baseUrl}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "b".repeat(281) }),
  });
  await log(`POST /api/notes with 281 chars -> ${over.status}`);
  if (over.status !== 400) throw new Error(`expected 400 for a 281-char note, got ${over.status}`);
  const overBody = await over.json();
  if (typeof overBody.error !== "string") {
    throw new Error(`expected a JSON error body, got ${JSON.stringify(overBody)}`);
  }
  await log(`rejection body: ${JSON.stringify(overBody)}`);

  const afterOver = await (await fetch(`${baseUrl}/api/notes`)).json();
  if (afterOver.some((n) => n.text.length > 280)) {
    throw new Error("a note longer than 280 chars was stored");
  }
  await log("verified via API: the 281-char note was not stored");

  const exact = "c".repeat(280);
  const ok = await fetch(`${baseUrl}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: exact }),
  });
  await log(`POST /api/notes with 280 chars -> ${ok.status}`);
  if (ok.status !== 201) throw new Error(`expected 201 for a 280-char note, got ${ok.status}`);

  const afterExact = await (await fetch(`${baseUrl}/api/notes`)).json();
  if (!afterExact.some((n) => n.text === exact)) {
    throw new Error("the 280-char note was not stored");
  }
  await log("verified via API: the 280-char note is stored");
}

async function runBrowserFeature(name) {
  const { log, reset } = makeLogger(name);
  await reset();
  await log(`starting feature "${name}"`);

  const cdpPort = await findFreePort();

  let server, baseUrl, chrome, tab, cdp;
  try {
    ({ server, baseUrl } = await startApp(log));

    chrome = await startChrome(cdpPort);
    await log(`headless chrome ready, devtools port ${cdpPort}`);

    // Open the tab blank, then navigate explicitly after Page.enable — opening
    // it with the target url directly races the loadEventFired listener,
    // since Chrome starts navigating before the websocket is even connected.
    tab = await openTab(cdpPort, "about:blank");
    cdp = new CdpSession(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.navigate(`${baseUrl}/`);
    await log("page loaded");

    if (name === "add-delete") await runAddDelete({ cdp, log, baseUrl });
    if (name === "dark-mode") await runDarkMode({ cdp, log, baseUrl });
    if (name === "length-limit") await runLengthLimit({ cdp, log, baseUrl });

    await log(`feature "${name}" PASSED`);
  } finally {
    if (tab) await closeTab(cdpPort, tab.id);
    cdp?.close();
    await stopChrome(chrome);
    stopServer(server);
    await log(`stopped everything this run started for "${name}"`);
  }
}

async function runResilience() {
  const name = "resilience";
  const { log, reset } = makeLogger(name);
  await reset();
  await log(`starting feature "${name}"`);

  let server, baseUrl;
  try {
    ({ server, baseUrl } = await startApp(log));

    const bad = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nope",
    });
    await log(`malformed POST /api/notes -> ${bad.status}`);
    if (bad.status !== 400) throw new Error(`expected 400 for malformed JSON, got ${bad.status}`);

    const after = await fetch(`${baseUrl}/api/notes`);
    await log(`follow-up GET /api/notes -> ${after.status}`);
    if (after.status !== 200) throw new Error(`server stopped serving after malformed POST, got ${after.status}`);

    const valid = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "still works after a bad request" }),
    });
    await log(`valid POST /api/notes after the malformed one -> ${valid.status}`);
    if (valid.status !== 201) throw new Error(`server rejected a valid POST after the malformed one, got ${valid.status}`);

    const doubleSlash = await fetch(`${baseUrl}//`);
    await log(`GET // -> ${doubleSlash.status}`);
    if (doubleSlash.status < 400 || doubleSlash.status >= 500) {
      throw new Error(`expected a 4xx for GET //, got ${doubleSlash.status}`);
    }

    const afterDoubleSlash = await fetch(`${baseUrl}/api/notes`);
    await log(`follow-up GET /api/notes -> ${afterDoubleSlash.status}`);
    if (afterDoubleSlash.status !== 200) throw new Error(`server stopped serving after GET //, got ${afterDoubleSlash.status}`);

    const nullBody = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });
    await log(`POST /api/notes with JSON null body -> ${nullBody.status}`);
    if (nullBody.status !== 400) throw new Error(`expected 400 for a JSON null body, got ${nullBody.status}`);

    const afterNullBody = await fetch(`${baseUrl}/api/notes`);
    await log(`follow-up GET /api/notes -> ${afterNullBody.status}`);
    if (afterNullBody.status !== 200) throw new Error(`server stopped serving after a JSON null body, got ${afterNullBody.status}`);

    const health = await fetch(`${baseUrl}/api/health`);
    const healthBody = await health.json();
    await log(`GET /api/health -> ${health.status} ${JSON.stringify(healthBody)}`);
    if (health.status !== 200) throw new Error(`expected 200 for GET /api/health, got ${health.status}`);
    if (healthBody.status !== "ok") throw new Error(`expected {"status":"ok"} from /api/health, got ${JSON.stringify(healthBody)}`);

    const healthWrongMethod = await fetch(`${baseUrl}/api/health`, { method: "POST" });
    await log(`POST /api/health -> ${healthWrongMethod.status}`);
    if (healthWrongMethod.status !== 404) throw new Error(`expected 404 for POST /api/health, got ${healthWrongMethod.status}`);

    await log(`feature "${name}" PASSED`);
  } finally {
    stopServer(server);
    await log(`stopped everything this run started for "${name}"`);
  }
}

const groups = { all: FEATURES, live: LIVE_FEATURES };
const toRun = groups[feature] ?? [feature];
let failed = false;
for (const name of toRun) {
  try {
    if (name === "resilience") await runResilience();
    else await runBrowserFeature(name);
  } catch (err) {
    failed = true;
    console.error(`[${name}] FAILED: ${err.stack ?? err}`);
  }
}
process.exit(failed ? 1 : 0);
