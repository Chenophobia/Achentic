const pptxgen = require("pptxgenjs");
const SKILL = process.env.PPTX_SKILL_DIR;
if (!SKILL) throw new Error("set PPTX_SKILL_DIR to the folder of the pptx skill (it holds scripts/apply_theme.js)");
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");
const OUT = require("node:path").join(__dirname, "../..", "Agentic dev cycle.pptx");

const THEME = {
  name: "Gate Green",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B1F23", lt1: "FFFFFF", dk2: "30363D", lt2: "F1F4F6",
    accent1: "1F883D", accent2: "BF8700", accent3: "0969DA",
    accent4: "CF222E", accent5: "57606A", accent6: "8250DF",
    hlink: "0969DA", folHlink: "8250DF",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Agentic dev cycle";
const C = pres.SchemeColor;
const INK = C.text1, WHITE = C.background1, SLATE = C.text2, MIST = C.background2;
const GREEN = C.accent1, AMBER = C.accent2, BLUE = C.accent3, RED = C.accent4, GRAY = C.accent5;

pres.defineSlideMaster({
  title: "DARK",
  background: { color: THEME.colors.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.2, w: 11.7, h: 1.6, fontSize: 48, bold: true, color: WHITE, align: "left", valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.0, w: 11.7, h: 1.2, fontSize: 20, color: MIST, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: THEME.colors.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 1.0, fontSize: 36, bold: true, color: INK, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: GRAY, align: "right" },
});
pres.defineSlideMaster({
  title: "DARK_CONTENT",
  background: { color: THEME.colors.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 1.0, fontSize: 36, bold: true, color: WHITE, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: MIST, align: "right" },
});

let n = 0;
const name = (p) => `${p}-${++n}`;
function card(s, x, y, w, h, fill) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.08, objectName: name("card") });
}
function txt(s, t, o) {
  s.addText(t, Object.assign({ isTextBox: true, margin: 0, valign: "top", color: INK, fontSize: 14, objectName: name("text") }, o));
}
function dot(s, label, x, y, fill, d = 0.5, fs = 16) {
  s.addText(String(label), { shape: pres.ShapeType.ellipse, x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, color: WHITE, bold: true, fontSize: fs, align: "center", valign: "middle", margin: 0, objectName: name("dot") });
}
function content(section, title, master = "CONTENT") {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}

const PURPLE = C.accent6;
function mono(s, t, o) {
  txt(s, t, Object.assign({ fontFace: "Courier New", fontSize: 12 }, o));
}
function arrow(s, x, y, w = 0.25, col = GRAY) {
  s.addShape(pres.ShapeType.rightArrow, { x, y, w, h: 0.28, fill: { color: col }, line: { color: col, width: 0 }, objectName: name("arrow") });
}
function node(s, title, sub, x, y, w, h, fill, fg = WHITE) {
  card(s, x, y, w, h, fill);
  txt(s, title, { x: x + 0.1, y: y + 0.12, w: w - 0.2, h: 0.4, fontSize: 15, bold: true, color: fg, align: "center", valign: "middle" });
  txt(s, sub, { x: x + 0.1, y: y + 0.55, w: w - 0.2, h: h - 0.65, fontSize: 12, color: fg, align: "center" });
}
const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: THEME.colors.dk1 }, fontSize: 14 } });
function table(s, head, rows, o, style = () => ({})) {
  const body = rows.map((r, i) => r.map((t, j) => ({
    text: t,
    options: Object.assign({ fontSize: 14, color: INK, bold: j === 0, fill: { color: i % 2 ? THEME.colors.lt2 : THEME.colors.lt1 } }, style(i, j)),
  })));
  s.addTable([head.map(hdr), ...body], Object.assign({ valign: "middle", margin: [0, 8, 0, 8], border: { type: "none" }, objectName: name("table") }, o));
}

// ───────── 1 Title
pres.addSection({ title: "Overview" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Overview" });
  s.addText("Write a ticket. Press merge.", { placeholder: "title" });
  s.addText("A personal agentic dev cycle. pstack builds, scripts check, a second agent judges, sensors watch the live app.", { placeholder: "body" });
  dot(s, "✓", 0.8, 1.2, GREEN, 0.8, 30);
  txt(s, "Status 2026-11-23  ·  loop proven on 4 real tickets, started by hand  ·  nothing scheduled yet", { x: 0.8, y: 6.5, w: 11.7, h: 0.4, fontSize: 12, color: MIST });
}

// ───────── 2 Loop
{
  const s = content("Overview", "One ticket, six steps, two of them yours");
  const steps = [
    ["Ticket", "Open a GitHub issue from anywhere: goal, done-check, proof", AMBER],
    ["Build", "Builder agent follows a pstack playbook", PURPLE],
    ["Gates", "Six scripts. Exit code decides", GREEN],
    ["Browser", "Real clicks in headless Chrome", GREEN],
    ["Verdict", "A second agent tries to break it", PURPLE],
    ["Merge", "You read the verdict and merge", AMBER],
  ];
  const w = 1.85, gap = 0.2, y = 1.9, h = 3.1;
  steps.forEach(([t, d, col], i) => {
    const x = 0.6 + i * (w + gap);
    card(s, x, y, w, h, MIST);
    dot(s, i + 1, x + 0.25, y + 0.3, col, 0.6, 20);
    txt(s, t, { x: x + 0.25, y: y + 1.15, w: w - 0.4, h: 0.45, fontSize: 20, bold: true });
    txt(s, d, { x: x + 0.25, y: y + 1.7, w: w - 0.4, h: 1.3, fontSize: 14, color: SLATE });
  });
  const legend = [["You", AMBER], ["Agent: uses tokens", PURPLE], ["Script: no tokens", GREEN]];
  legend.forEach(([t, col], i) => {
    dot(s, "", 0.6 + i * 3.6, 5.45, col, 0.3);
    txt(s, t, { x: 1.05 + i * 3.6, y: 5.45, w: 3, h: 0.3, fontSize: 14, valign: "middle" });
  });
  txt(s, "A failure at steps 3 to 5 goes back to the builder, up to three attempts. Then the ticket is blocked and you are told.", { x: 0.6, y: 6.15, w: 11.6, h: 0.6, fontSize: 14, color: GRAY, italic: true });
}

// ───────── 3 Parts
{
  const s = content("Overview", "Six parts, each small enough to read");
  const parts = [
    ["Template", "template/", "Start of every app: strict TypeScript, six gates, CI file, agent rules", "Proven", GREEN],
    ["Orchestrator", "orchestrator/", "Script that walks one ticket through build, checks and verdict", "Proven on 3 tickets", GREEN],
    ["Sandbox mode", "ACHENTIC_SANDBOX=1", "Confines every command the agents run", "Proven", GREEN],
    ["Live check", "sensors/", "Hourly: does the live app work for a user? Files a ticket if not", "Built, tested locally", BLUE],
    ["Uptime check", "sensors/uptime-kuma/", "Every minute: is it up, are the jobs alive? Alerts only", "Built, setup is yours", BLUE],
    ["Agent user", "setup/agent-user/", "Separate macOS account that owns nothing valuable", "Written, not run", AMBER],
  ];
  const w = 3.83, h = 2.3, gx = 0.3, gy = 0.3;
  parts.forEach(([t, where, d, state, col], i) => {
    const x = 0.6 + (i % 3) * (w + gx), y = 1.7 + Math.floor(i / 3) * (h + gy);
    card(s, x, y, w, h, MIST);
    txt(s, t, { x: x + 0.3, y: y + 0.2, w: w - 0.6, h: 0.4, fontSize: 20, bold: true });
    mono(s, where, { x: x + 0.3, y: y + 0.62, w: w - 0.6, h: 0.3, color: GRAY });
    txt(s, d, { x: x + 0.3, y: y + 1.0, w: w - 0.6, h: 0.75, fontSize: 14, color: SLATE });
    txt(s, state, { x: x + 0.3, y: y + 1.8, w: w - 0.6, h: 0.3, fontSize: 14, bold: true, color: col });
  });
}

// ───────── 4 What talks to what
pres.addSection({ title: "How it works" });
{
  const s = content("How it works", "What talks to what");
  txt(s, "BUILD LOOP  ·  every 30 minutes, one ticket", { x: 0.6, y: 1.45, w: 8, h: 0.3, fontSize: 12, bold: true, color: GRAY });
  const chain = [
    ["You", "GitHub issue\nor ticket file", AMBER],
    ["Orchestrator", "script\nmakes a branch", GREEN],
    ["Builder", "claude -p\nSonnet + pstack", PURPLE],
    ["Gates", "gates.sh\nsix checks", GREEN],
    ["Browser drive", "drive.mjs\nheadless Chrome", GREEN],
    ["Verifier", "claude -p\nOpus, new process", PURPLE],
    ["You", "read verdict\nmerge, push", AMBER],
  ];
  const w = 1.45, gap = 0.325, y = 1.85, h = 1.35;
  chain.forEach(([t, d, col], i) => {
    const x = 0.6 + i * (w + gap);
    node(s, t, d, x, y, w, h, col);
    if (i < chain.length - 1) arrow(s, x + w + 0.04, y + 0.53);
  });
  txt(s, "Fail at any check → the finding goes back to the builder's same session. Three attempts, then blocked.", { x: 0.6, y: 3.35, w: 12.1, h: 0.35, fontSize: 14, color: SLATE, italic: true });

  txt(s, "WATCH LOOP  ·  the live app", { x: 0.6, y: 4.0, w: 8, h: 0.3, fontSize: 12, bold: true, color: GRAY });
  const y2 = 4.4, h2 = 1.05, w2 = 2.3;
  node(s, "Live check", "hourly, clicks through the live app", 0.6, y2, w2, h2, GREEN);
  arrow(s, 2.98, y2 + 0.38);
  node(s, "Broken twice", "writes a ticket → build loop", 3.3, y2, w2, h2, MIST, INK);
  node(s, "Uptime Kuma", "every minute, health address", 0.6, y2 + 1.25, w2, h2, GREEN);
  arrow(s, 2.98, y2 + 1.63);
  node(s, "Down", "Discord alert only, never a ticket", 3.3, y2 + 1.25, w2, h2, MIST, INK);

  card(s, 6.2, 4.4, 6.5, 2.3, MIST);
  txt(s, "Three rules", { x: 6.5, y: 4.55, w: 5.9, h: 0.35, fontSize: 16, bold: true });
  txt(s, [
    { text: "Agents never talk to each other. The script starts each one and reads what it prints", options: { bullet: true, breakLine: true } },
    { text: "State lives in files: tickets, verdicts, a small state folder", options: { bullet: true, breakLine: true } },
    { text: "Every step is posted to your Discord channel", options: { bullet: true, breakLine: true } },
    { text: "Only you push, merge or deploy", options: { bullet: true } },
  ], { x: 6.5, y: 4.95, w: 5.9, h: 1.65, fontSize: 14, color: SLATE, paraSpaceAfter: 4 });
}

// ───────── 5 How an agent is called
{
  const s = content("How it works", "How an agent is called: one command, no chat");
  card(s, 0.6, 1.7, 6.2, 4.3, INK);
  mono(s, [
    { text: 'claude -p "/pstack:poteto-mode', options: { breakLine: true, color: WHITE, bold: true } },
    { text: '   Implement the ticket in', options: { breakLine: true } },
    { text: '   tickets/ready/TN-4.md …"', options: { breakLine: true } },
    { text: "  --model sonnet", options: { breakLine: true } },
    { text: "  --permission-mode acceptEdits", options: { breakLine: true } },
    { text: '  --allowedTools "Bash(node *)" …', options: { breakLine: true } },
    { text: "  --settings agent-settings.json", options: { breakLine: true } },
    { text: "  --add-dir <pstack plugin folder>", options: { breakLine: true } },
    { text: "  --output-format json", options: {} },
  ], { x: 0.9, y: 1.95, w: 5.6, h: 3.8, fontSize: 14, color: MIST, paraSpaceAfter: 5 });
  table(s, ["", "Builder", "Verifier"], [
    ["Model", "Sonnet", "Opus"],
    ["Session", "One; a retry resumes it", "Always new"],
    ["May edit", "Yes, in the repo", "No"],
    ["Ends with", "A report", "VERDICT: PASS / FAIL"],
  ], { x: 7.1, y: 1.7, w: 5.6, colW: [1.3, 2.15, 2.15], rowH: 0.55 });
  txt(s, [
    { text: "-p means headless: run, print, exit", options: { bullet: true, breakLine: true } },
    { text: "The prompt's first word loads pstack, which picks Feature, Bug fix or Refactoring", options: { bullet: true, breakLine: true } },
    { text: "The orchestrator reads result, cost and session id from the JSON", options: { bullet: true } },
  ], { x: 7.1, y: 4.65, w: 5.6, h: 1.6, fontSize: 14, color: SLATE, paraSpaceAfter: 4 });
  txt(s, "Pocock's skills are never called by the script. You type them when an idea is too vague for a ticket: grill-with-docs → to-spec → to-tickets.", { x: 0.6, y: 6.3, w: 11.6, h: 0.55, fontSize: 14, color: GRAY });
}

// ───────── 6 Tokens
{
  const s = content("How it works", "Only two steps spend tokens");
  card(s, 0.6, 1.7, 3.6, 4.6, INK);
  txt(s, "$3–4", { x: 0.9, y: 1.95, w: 3.0, h: 1.2, fontSize: 60, bold: true, color: WHITE });
  txt(s, "per simple ticket, API-equivalent; a hard one up to $15. On Max it is not billed: it comes out of the weekly limit.", { x: 0.9, y: 3.25, w: 3.0, h: 1.2, fontSize: 14, color: MIST });
  txt(s, "≈ $47", { x: 0.9, y: 4.55, w: 3.0, h: 0.6, fontSize: 28, bold: true, color: WHITE });
  txt(s, "for all ~26 runs so far, one of them $15", { x: 0.9, y: 5.2, w: 3.0, h: 0.6, fontSize: 14, color: MIST });
  table(s, ["Uses Claude Max quota", "Measured"], [
    ["Builder (pstack defaults)", "$1–2.50; once $13.60"],
    ["Verifier (Opus)", "$1.20–1.70, 1–2 min"],
    ["A retry", "about $1 more"],
  ], { x: 4.5, y: 1.7, w: 4.2, colW: [2.2, 2.0], rowH: 0.55 }, (i, j) => (j === 0 ? { color: PURPLE } : {}));
  txt(s, "Brakes", { x: 4.5, y: 4.15, w: 4.2, h: 0.35, fontSize: 16, bold: true });
  txt(s, [
    { text: "3 tickets a day", options: { bullet: true, breakLine: true } },
    { text: "3 attempts a ticket", options: { bullet: true, breakLine: true } },
    { text: "One ticket at a time", options: { bullet: true, breakLine: true } },
    { text: "2 sensor tickets a day", options: { bullet: true, breakLine: true } },
    { text: "$25 / $8 runaway guard per run", options: { bullet: true } },
  ], { x: 4.5, y: 4.55, w: 4.2, h: 1.7, fontSize: 14, color: SLATE, paraSpaceAfter: 3 });
  card(s, 9.0, 1.7, 3.7, 4.6, MIST);
  txt(s, "Zero tokens", { x: 9.3, y: 1.9, w: 3.1, h: 0.4, fontSize: 18, bold: true, color: GREEN });
  txt(s, [
    { text: "Orchestrator", options: { bullet: true, breakLine: true } },
    { text: "Six gates", options: { bullet: true, breakLine: true } },
    { text: "Browser drive", options: { bullet: true, breakLine: true } },
    { text: "GitHub Actions", options: { bullet: true, breakLine: true } },
    { text: "Live check", options: { bullet: true, breakLine: true } },
    { text: "Uptime Kuma, heartbeats", options: { bullet: true, breakLine: true } },
    { text: "Issue intake, Discord posts", options: { bullet: true } },
  ], { x: 9.3, y: 2.4, w: 3.1, h: 3.7, fontSize: 15, color: INK, paraSpaceAfter: 6 });
  txt(s, "pstack runs at its defaults and may add larger models on hard tickets. The $20 API budget is used by nothing built so far.", { x: 0.6, y: 6.5, w: 11.6, h: 0.35, fontSize: 14, color: GRAY });
}

// ───────── 7 Standards
pres.addSection({ title: "Quality and safety" });
{
  const s = content("Quality and safety", "pstack advises the standards. Six gates enforce them");
  const gates = [
    ["Typecheck", "tsc, strict", "Any type error, unused local, unchecked index"],
    ["Lint + format", "Biome", "any, non-null !, tangled functions, unformatted code"],
    ["No comments", "compiler diff", "Any comment that is not a link or tool directive"],
    ["Dead code", "knip", "Unused files, exports, dependencies"],
    ["Duplication", "jscpd", "Any copied block of six lines or more"],
    ["Tests", "node --test", "A failing test"],
  ];
  const w = 3.83, h = 1.75, gx = 0.3, gy = 0.25;
  gates.forEach(([t, tool, d], i) => {
    const x = 0.6 + (i % 3) * (w + gx), y = 1.7 + Math.floor(i / 3) * (h + gy);
    card(s, x, y, w, h, MIST);
    dot(s, i + 1, x + 0.25, y + 0.25, GREEN, 0.5, 16);
    txt(s, t, { x: x + 0.95, y: y + 0.2, w: w - 1.2, h: 0.35, fontSize: 18, bold: true });
    mono(s, tool, { x: x + 0.95, y: y + 0.57, w: w - 1.2, h: 0.3, color: GRAY });
    txt(s, d, { x: x + 0.25, y: y + 1.0, w: w - 0.5, h: 0.65, fontSize: 14, color: SLATE });
  });
  txt(s, "Each gate was proven to fail on a seeded bad change. They run locally, inside the loop, and again on GitHub Actions.", { x: 0.6, y: 5.85, w: 12.1, h: 0.35, fontSize: 14, color: INK });
  txt(s, "An agent that edits a gate file, .github/, .claude/ or package.json scripts gets its ticket blocked at once.", { x: 0.6, y: 6.3, w: 12.1, h: 0.35, fontSize: 14, color: GRAY });
}

// ───────── 8 Safety
{
  const s = content("Quality and safety", "Two layers keep an agent away from your machine");
  card(s, 0.6, 1.7, 5.9, 2.2, MIST);
  dot(s, 1, 0.9, 1.95, GREEN, 0.55, 18);
  txt(s, "Sandbox", { x: 1.65, y: 1.95, w: 3.0, h: 0.55, fontSize: 20, bold: true, valign: "middle" });
  txt(s, "Proven", { x: 4.6, y: 1.95, w: 1.6, h: 0.55, fontSize: 14, bold: true, color: GREEN, align: "right", valign: "middle" });
  txt(s, "Limits every command the agents run. Does not cover the gates and browser drive, which run agent-written code outside it.", { x: 0.9, y: 2.65, w: 5.3, h: 1.1, fontSize: 14, color: SLATE });
  card(s, 0.6, 4.15, 5.9, 2.2, MIST);
  dot(s, 2, 0.9, 4.4, AMBER, 0.55, 18);
  txt(s, "Separate macOS user", { x: 1.65, y: 4.4, w: 3.0, h: 0.55, fontSize: 20, bold: true, valign: "middle" });
  txt(s, "Not run yet", { x: 4.6, y: 4.4, w: 1.6, h: 0.55, fontSize: 14, bold: true, color: AMBER, align: "right", valign: "middle" });
  txt(s, "Everything runs as an account with no keys, no personal files, no admin rights, no GitHub credentials.", { x: 0.9, y: 5.1, w: 5.3, h: 1.1, fontSize: 14, color: SLATE });
  table(s, ["Tried inside the sandbox", "Result"], [
    ["Write inside the repo", "Allowed"],
    ["Write to home folder", "Blocked"],
    ["Read ~/.ssh, keychain", "Blocked"],
    ["Reach github.com", "Blocked"],
    ["npm registry, localhost", "Allowed"],
    ["Six gates", "Pass"],
    ["Start Chrome", "Fails"],
  ], { x: 6.8, y: 1.7, w: 5.9, colW: [3.9, 2.0], rowH: 0.5 }, (i, j) => (j === 1 ? { bold: true, color: ["Blocked", "Fails"].includes(["Allowed", "Blocked", "Blocked", "Blocked", "Allowed", "Pass", "Fails"][i]) ? RED : GREEN } : { bold: false }));
  txt(s, "Chrome cannot start in the sandbox, so the orchestrator runs the browser drive and hands the agents its output.", { x: 6.8, y: 5.85, w: 5.9, h: 0.7, fontSize: 14, color: GRAY });
}

// ───────── 9 Bug catching
{
  const s = content("Quality and safety", "Seven nets, from first commit to live app");
  const cols = [
    ["Before merge", GREEN, [["Six gates", "types, lint, dead code, tests"], ["Browser drive", "real clicks, screenshots"], ["Verifier", "inputs the author skipped"]]],
    ["After merge", BLUE, [["GitHub Actions", "same gates on a clean machine"]]],
    ["Live", AMBER, [["Uptime check", "down → Discord alert"], ["Live check", "broken → ticket"], ["Error collection", "new error → ticket"]]],
  ];
  const w = 3.83, gap = 0.3, y = 1.7, h = 4.6;
  cols.forEach(([t, col, items], i) => {
    const x = 0.6 + i * (w + gap);
    card(s, x, y, w, h, MIST);
    card(s, x + 0.3, y + 0.3, 2.2, 0.55, col);
    txt(s, t, { x: x + 0.3, y: y + 0.3, w: 2.2, h: 0.55, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle" });
    items.forEach(([a, b], j) => {
      const yy = y + 1.2 + j * 1.05;
      txt(s, a, { x: x + 0.3, y: yy, w: w - 0.6, h: 0.35, fontSize: 18, bold: true });
      txt(s, b, { x: x + 0.3, y: yy + 0.4, w: w - 0.6, h: 0.4, fontSize: 14, color: SLATE });
    });
  });
  txt(s, "Outages alert you. Bugs become tickets. An agent editing code cannot fix a dead tunnel.", { x: 0.6, y: 6.5, w: 12.1, h: 0.35, fontSize: 14, color: GRAY, italic: true });
}

// ───────── 10 Run by hand
pres.addSection({ title: "Run it" });
{
  const s = content("Run it", "Run it by hand: five commands");
  const steps = [
    ["Write a ticket", "mission control → New ticket   (or a file: tickets/ready/MA-1.md)"],
    ["Run the loop once", "node orchestrator/orchestrator.mjs run --repo ~/work/my-app"],
    ["See where things stand", "node orchestrator/orchestrator.mjs status --repo ~/work/my-app"],
    ["Accept the result", "git merge agent/MA-1   (then push)"],
    ["Retry a blocked ticket", "node orchestrator/orchestrator.mjs retry MA-1 --repo ~/work/my-app"],
  ];
  steps.forEach(([t, cmd], i) => {
    const y = 1.65 + i * 0.92;
    card(s, 0.6, y, 12.1, 0.78, MIST);
    dot(s, i + 1, 0.8, y + 0.14, i === 0 || i === 3 ? AMBER : GREEN, 0.5, 16);
    txt(s, t, { x: 1.55, y, w: 3.0, h: 0.78, fontSize: 16, bold: true, valign: "middle" });
    mono(s, cmd, { x: 4.6, y, w: 7.9, h: 0.78, fontSize: 12, valign: "middle" });
  });
  txt(s, "New app first: copy template/, run both `claude plugin install … --scope project` commands in it, then npm ci.", { x: 0.6, y: 6.3, w: 12.1, h: 0.3, fontSize: 14, color: INK });
  txt(s, "Put ACHENTIC_SANDBOX=1 in front of the run command to confine the agents.", { x: 0.6, y: 6.65, w: 11.4, h: 0.3, fontSize: 14, color: GRAY });
}

// ───────── 11 Run 24/7
{
  const s = content("Run it", "Run it 24/7 on the Mac mini: nine steps, all yours");
  table(s, ["#", "Step", "Command"], [
    ["1", "Create the agent user", "sudo sh setup/agent-user/create-user.sh agent"],
    ["2", "Become it; install Node, Claude Code; clone repos", "sudo -u agent -i"],
    ["3", "Make a login token, save it in ~/.achentic/env", "claude setup-token"],
    ["4", "One ticket by hand as that user", "sh setup/agent-user/run-as-agent.sh orchestrator <app>"],
    ["5", "Schedule the orchestrator (30 min)", "sudo sh …/install-daemon.sh agent orchestrator <app>"],
    ["6", "Schedule the live check (hourly)", "sudo sh …/install-daemon.sh agent sensor <app> <url>"],
    ["7", "Start the uptime check, set it up in its page", "docker compose -f sensors/uptime-kuma/compose.yml up -d"],
    ["8", "Issues in, Discord out: two lines in ~/.achentic/env", "ACHENTIC_DISCORD_WEBHOOK_URL=…  ACHENTIC_GITHUB_REPO=…"],
    ["9", "GitHub: protect main, require the gates check", "repository settings"],
  ], { x: 0.6, y: 1.6, w: 12.1, colW: [0.5, 5.0, 6.6], rowH: 0.47 }, (i, j) => (j === 2 ? { fontFace: "Courier New", fontSize: 12, bold: false } : j === 1 ? { bold: false } : {}));
  txt(s, "Nothing starts by itself: steps 5 and 6 print the start command. Passwords, tokens and accounts are created by you, never by an agent.", { x: 0.6, y: 6.45, w: 11.6, h: 0.5, fontSize: 14, color: GRAY });
}

// ───────── 12 Proven / not yet
{
  const s = content("Run it", "Proven on a small app. Not yet running by itself", "DARK_CONTENT");
  card(s, 0.6, 1.7, 5.9, 4.9, SLATE);
  txt(s, "Proven", { x: 0.9, y: 1.9, w: 5.3, h: 0.4, fontSize: 20, bold: true, color: WHITE });
  txt(s, [
    { text: "Agent builds strict TypeScript under the gates", options: { bullet: true, breakLine: true } },
    { text: "Queue to mergeable branch with no hand steps, three tickets", options: { bullet: true, breakLine: true } },
    { text: "A failure goes back and gets fixed on the second attempt", options: { bullet: true, breakLine: true } },
    { text: "Sandbox blocks escapes; the loop still works inside it", options: { bullet: true, breakLine: true } },
    { text: "Verifier found two crashes the author missed", options: { bullet: true, breakLine: true } },
    { text: "Live check: healthy, broken and stopped app handled", options: { bullet: true } },
  ], { x: 0.9, y: 2.45, w: 5.3, h: 4.0, fontSize: 15, color: MIST, paraSpaceAfter: 8 });
  card(s, 6.8, 1.7, 5.9, 4.9, SLATE);
  txt(s, "Not yet", { x: 7.1, y: 1.9, w: 5.3, h: 0.4, fontSize: 20, bold: true, color: WHITE });
  txt(s, [
    { text: "Anything scheduled: installers written, none loaded", options: { bullet: true, breakLine: true } },
    { text: "The agent user: needs sudo on the Mac mini", options: { bullet: true, breakLine: true } },
    { text: "A real app with database, login, dependencies", options: { bullet: true, breakLine: true } },
    { text: "Share of the weekly limit per ticket", options: { bullet: true, breakLine: true } },
    { text: "Uptime monitors, Discord channel: need your accounts", options: { bullet: true, breakLine: true } },
    { text: "A real verifier FAIL sent back through the loop", options: { bullet: true } },
  ], { x: 7.1, y: 2.45, w: 5.3, h: 4.0, fontSize: 15, color: MIST, paraSpaceAfter: 8 });
  txt(s, "Next: steps 1 to 4 on the Mac mini. Step 4 answers the two biggest unknowns.", { x: 0.6, y: 6.8, w: 11.4, h: 0.35, fontSize: 14, color: MIST });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
