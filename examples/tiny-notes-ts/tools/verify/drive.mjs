#!/usr/bin/env node
// Drives one (or all) tiny-notes features end to end in a real headless
// browser (or, for "resilience", straight HTTP) and writes evidence under
// .verify-evidence/. Run from the repo root:
//
//   node tools/verify/drive.mjs <add-delete|dark-mode|resilience|all>
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

const FEATURES = ["add-delete", "dark-mode", "resilience"];
const feature = process.argv[2];

if (!feature || (feature !== "all" && !FEATURES.includes(feature))) {
  console.error(`usage: node tools/verify/drive.mjs <${FEATURES.join("|")}|all>`);
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

async function runAddDelete({ cdp, log, appPort }) {
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

  const listed = await (await fetch(`http://localhost:${appPort}/api/notes`)).json();
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

  const after = await (await fetch(`http://localhost:${appPort}/api/notes`)).json();
  if (after.some((n) => n.id === created.id)) throw new Error("note still present via GET /api/notes after delete");
  await log(`verified via API: note id ${created.id} no longer stored`);
}

async function runDarkMode({ cdp, log, appPort }) {
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

  await cdp.send("Page.navigate", { url: `http://localhost:${appPort}/` });
  await cdp.waitForEvent("Page.loadEventFired", 10000);
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

async function runBrowserFeature(name) {
  const { log, reset } = makeLogger(name);
  await reset();
  await log(`starting feature "${name}"`);

  const appPort = await findFreePort();
  const cdpPort = await findFreePort();
  await log(`app port ${appPort}, chrome devtools port ${cdpPort}`);

  let server, chrome, tab, cdp;
  try {
    server = await startServer(appPort, repoRoot);
    await log(`server ready at http://localhost:${appPort}`);

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
    await cdp.send("Page.navigate", { url: `http://localhost:${appPort}/` });
    await cdp.waitForEvent("Page.loadEventFired", 10000);
    await log("page loaded");

    if (name === "add-delete") await runAddDelete({ cdp, log, appPort });
    if (name === "dark-mode") await runDarkMode({ cdp, log, appPort });

    await log(`feature "${name}" PASSED`);
  } finally {
    if (tab) await closeTab(cdpPort, tab.id);
    cdp?.close();
    await stopChrome(chrome);
    stopServer(server);
    await log(`torn down server (port ${appPort}) and chrome (port ${cdpPort}) for "${name}"`);
  }
}

async function runResilience() {
  const name = "resilience";
  const { log, reset } = makeLogger(name);
  await reset();
  await log(`starting feature "${name}"`);

  const appPort = await findFreePort();
  let server;
  try {
    server = await startServer(appPort, repoRoot);
    await log(`server ready at http://localhost:${appPort}`);

    const bad = await fetch(`http://localhost:${appPort}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nope",
    });
    await log(`malformed POST /api/notes -> ${bad.status}`);
    if (bad.status !== 400) throw new Error(`expected 400 for malformed JSON, got ${bad.status}`);

    const after = await fetch(`http://localhost:${appPort}/api/notes`);
    await log(`follow-up GET /api/notes -> ${after.status}`);
    if (after.status !== 200) throw new Error(`server stopped serving after malformed POST, got ${after.status}`);

    const valid = await fetch(`http://localhost:${appPort}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "still works after a bad request" }),
    });
    await log(`valid POST /api/notes after the malformed one -> ${valid.status}`);
    if (valid.status !== 201) throw new Error(`server rejected a valid POST after the malformed one, got ${valid.status}`);

    const doubleSlash = await fetch(`http://localhost:${appPort}//`);
    await log(`GET // -> ${doubleSlash.status}`);
    if (doubleSlash.status < 400 || doubleSlash.status >= 500) {
      throw new Error(`expected a 4xx for GET //, got ${doubleSlash.status}`);
    }

    const afterDoubleSlash = await fetch(`http://localhost:${appPort}/api/notes`);
    await log(`follow-up GET /api/notes -> ${afterDoubleSlash.status}`);
    if (afterDoubleSlash.status !== 200) throw new Error(`server stopped serving after GET //, got ${afterDoubleSlash.status}`);

    const nullBody = await fetch(`http://localhost:${appPort}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });
    await log(`POST /api/notes with JSON null body -> ${nullBody.status}`);
    if (nullBody.status !== 400) throw new Error(`expected 400 for a JSON null body, got ${nullBody.status}`);

    const afterNullBody = await fetch(`http://localhost:${appPort}/api/notes`);
    await log(`follow-up GET /api/notes -> ${afterNullBody.status}`);
    if (afterNullBody.status !== 200) throw new Error(`server stopped serving after a JSON null body, got ${afterNullBody.status}`);

    await log(`feature "${name}" PASSED`);
  } finally {
    stopServer(server);
    await log(`torn down server (port ${appPort}) for "${name}"`);
  }
}

const toRun = feature === "all" ? FEATURES : [feature];
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
