const pptxgen = require("pptxgenjs");
const SKILL = process.env.PPTX_SKILL_DIR;
if (!SKILL) throw new Error("set PPTX_SKILL_DIR to the folder of the pptx skill (it holds scripts/apply_theme.js)");
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");
const OUT = require("node:path").join(__dirname, "../..", "Deploy on Mac mini.pptx");

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
pres.title = "Deploy on Mac mini";
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


function stage(num, title, steps, checks, logs) {
  const s = content("Stages", title);
  dot(s, num, 12.0, 0.6, GREEN, 0.6, 20);
  card(s, 0.6, 1.6, 7.4, 5.1, MIST);
  txt(s, "Do", { x: 0.9, y: 1.75, w: 3, h: 0.35, fontSize: 16, bold: true });
  const rowH = Math.min(0.92, 4.4 / steps.length);
  steps.forEach(([who, label, cmd], i) => {
    const y = 2.2 + i * rowH;
    dot(s, who === "you" ? "Y" : "C", 0.9, y + 0.04, who === "you" ? AMBER : PURPLE, 0.34, 11);
    txt(s, label, { x: 1.4, y, w: 6.4, h: 0.36, fontSize: 14, bold: true, valign: "middle" });
    if (cmd) mono(s, cmd, { x: 1.4, y: y + 0.38, w: 6.4, h: 0.32, fontSize: 11, color: SLATE, valign: "middle" });
  });
  card(s, 8.3, 1.6, 4.4, 2.45, MIST);
  txt(s, "Done when", { x: 8.6, y: 1.75, w: 3.8, h: 0.35, fontSize: 16, bold: true, color: GREEN });
  txt(s, checks.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < checks.length - 1 } })), { x: 8.6, y: 2.15, w: 3.85, h: 1.8, fontSize: 14, color: INK, paraSpaceAfter: 4 });
  card(s, 8.3, 4.25, 4.4, 2.45, INK);
  txt(s, "Look here", { x: 8.6, y: 4.4, w: 3.8, h: 0.35, fontSize: 16, bold: true, color: WHITE });
  mono(s, logs.map((t, i) => ({ text: t, options: { breakLine: i < logs.length - 1 } })), { x: 8.6, y: 4.8, w: 3.85, h: 1.8, fontSize: 11, color: MIST, paraSpaceAfter: 5 });
  return s;
}

// ───────── 1 Title
pres.addSection({ title: "Overview" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Overview" });
  s.addText("From an empty Mac mini to running 24/7", { placeholder: "title" });
  s.addText("Six stages. What to run, how to know it worked, and where to look when it does not.", { placeholder: "body" });
  dot(s, "✓", 0.8, 1.2, GREEN, 0.8, 30);
  txt(s, "Achentic deployment guide  ·  2026-11-23  ·  companion to setup/SETUP.md", { x: 0.8, y: 6.5, w: 11.7, h: 0.4, fontSize: 12, color: MIST });
}

// ───────── 2 What lives where
{
  const s = content("Overview", "What lives where");
  node(s, "GitHub", "issues in, from anywhere\nCI runs the gates", 0.6, 1.6, 2.3, 1.25, BLUE);
  node(s, "Discord", "every step of\nevery ticket", 0.6, 3.1, 2.3, 1.25, PURPLE);
  node(s, "Internet", "visitors, through\nCloudflare Tunnel", 0.6, 4.6, 2.3, 1.25, BLUE);

  card(s, 3.2, 1.6, 9.5, 5.2, MIST);
  txt(s, "MAC MINI  ·  always on", { x: 3.45, y: 1.7, w: 6, h: 0.3, fontSize: 12, bold: true, color: GRAY });

  card(s, 3.45, 2.1, 4.5, 2.6, WHITE);
  txt(s, "User: agent  (no admin, no keys)", { x: 3.65, y: 2.2, w: 4.1, h: 0.35, fontSize: 14, bold: true, color: PURPLE });
  mono(s, [
    { text: "~/work/Achentic      this repo", options: { breakLine: true } },
    { text: "~/work/<app>         agent's clone", options: { breakLine: true } },
    { text: "~/.achentic/env      login token", options: { breakLine: true } },
    { text: "~/.achentic/<app>/   state + logs", options: { breakLine: true } },
    { text: "launchd jobs         every 30/60 min", options: { breakLine: true } },
    { text: "mission control      localhost:4400", options: {} },
  ], { x: 3.65, y: 2.65, w: 4.2, h: 1.95, fontSize: 12, color: INK, paraSpaceAfter: 5 });

  card(s, 8.15, 2.1, 4.3, 2.6, WHITE);
  txt(s, "User: you  (admin)", { x: 8.35, y: 2.2, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: AMBER });
  mono(s, [
    { text: "~/work/<app>     your clone", options: { breakLine: true } },
    { text: "git fetch from the agent's clone", options: { breakLine: true } },
    { text: "merge, push, deploy", options: { breakLine: true } },
    { text: "sudo, accounts, tokens", options: {} },
  ], { x: 8.35, y: 2.65, w: 4.0, h: 1.95, fontSize: 12, color: INK, paraSpaceAfter: 5 });

  card(s, 3.45, 4.9, 9.0, 1.7, WHITE);
  txt(s, "Docker  (always running)", { x: 3.65, y: 5.0, w: 5, h: 0.35, fontSize: 14, bold: true, color: GREEN });
  const boxes = [["Your apps", "one compose\nproject each"], ["cloudflared", "the tunnel"], ["Uptime Kuma", "localhost:3001"], ["GlitchTip", "localhost:8000"]];
  boxes.forEach(([t, d], i) => {
    const x = 3.65 + i * 2.2;
    card(s, x, 5.42, 2.05, 1.05, MIST);
    txt(s, t, { x: x + 0.1, y: 5.47, w: 1.85, h: 0.3, fontSize: 13, bold: true, align: "center" });
    txt(s, d, { x: x + 0.1, y: 5.8, w: 1.85, h: 0.6, fontSize: 11, color: SLATE, align: "center" });
  });
}

// ───────── 3 Where each agent lives
{
  const s = content("Overview", "No agent is always on. Each one is a process that ends");
  table(s, ["What", "Kind", "Started by", "Lives", "Runs as / where"], [
    ["Orchestrator", "Script", "launchd, every 30 min", "Seconds; longer with a ticket", "agent · the app's clone"],
    ["Builder", "claude -p, pstack", "Orchestrator", "1 to 60 min, then exits", "agent · sandboxed in the clone"],
    ["Verifier", "claude -p, Opus", "Orchestrator", "1 to 30 min, then exits", "agent · sandboxed, cannot edit"],
    ["Live check", "Script + Chrome", "launchd, hourly", "About 20 seconds", "agent · against the live address"],
    ["Errors sensor", "Script", "launchd, hourly", "About 1 second", "agent · asks GlitchTip"],
    ["Uptime Kuma", "Container", "Docker, restarts itself", "Always", "you · Docker"],
    ["GlitchTip", "2 containers", "Docker, restarts itself", "Always", "you · Docker"],
    ["Your apps", "Containers", "Docker, restarts itself", "Always", "you · Docker, behind the tunnel"],
  ], { x: 0.6, y: 1.6, w: 12.1, colW: [1.9, 2.0, 2.7, 2.9, 2.6], rowH: 0.5 }, (i, j) => (j === 0 ? { color: i === 1 || i === 2 ? PURPLE : i > 4 ? GREEN : INK } : { bold: false }));
  dot(s, "", 0.6, 6.33, PURPLE, 0.26);
  txt(s, "uses tokens, only while it runs", { x: 0.98, y: 6.3, w: 3.6, h: 0.32, fontSize: 14, valign: "middle" });
  dot(s, "", 4.8, 6.33, GREEN, 0.26);
  txt(s, "always on, no tokens", { x: 5.18, y: 6.3, w: 3.0, h: 0.32, fontSize: 14, valign: "middle" });
  txt(s, "Agents keep nothing in memory between runs: everything is in files.", { x: 0.6, y: 6.75, w: 11.4, h: 0.3, fontSize: 14, color: GRAY, italic: true });
}

// ───────── 4 Stages overview
{
  const s = content("Overview", "Six stages. Stop after any of them and it still works");
  const stages = [
    ["Prepare", "Clone, run the doctor, fix what it lists", "Doctor says Ready"],
    ["Agent user", "Separate account, long-lived login token", "Doctor says Ready as that user"],
    ["First project", "Template, one ticket, one run by hand", "A verdict file exists"],
    ["Schedule", "Orchestrator every 30 minutes", "Status shows the job loaded"],
    ["Host + sensors", "App live, three sensors watching", "Monitors green, checks ok"],
    ["Anywhere + locks", "Issues in, Discord out, branch protection", "An issue shows up in Discord as queued"],
  ];
  const w = 3.83, h = 2.2, gx = 0.3, gy = 0.25;
  stages.forEach(([t, d, done], i) => {
    const x = 0.6 + (i % 3) * (w + gx), y = 1.6 + Math.floor(i / 3) * (h + gy);
    card(s, x, y, w, h, MIST);
    dot(s, i, x + 0.3, y + 0.25, GREEN, 0.55, 18);
    txt(s, t, { x: x + 1.05, y: y + 0.25, w: w - 1.3, h: 0.55, fontSize: 20, bold: true, valign: "middle" });
    txt(s, d, { x: x + 0.3, y: y + 1.0, w: w - 0.6, h: 0.6, fontSize: 14, color: SLATE });
    txt(s, "Done when: " + done, { x: x + 0.3, y: y + 1.7, w: w - 0.6, h: 0.4, fontSize: 13, bold: true, color: GREEN });
  });
  dot(s, "Y", 0.6, 6.62, AMBER, 0.32, 11);
  txt(s, "you do it (password, sudo, browser)", { x: 1.05, y: 6.6, w: 4.3, h: 0.35, fontSize: 14, valign: "middle" });
  dot(s, "C", 5.6, 6.62, PURPLE, 0.32, 11);
  txt(s, "Claude Code can do it when you say \"set this machine up\"", { x: 6.05, y: 6.6, w: 6.5, h: 0.35, fontSize: 14, valign: "middle" });
}

// ───────── 5..10 Stages
pres.addSection({ title: "Stages" });
stage(0, "Stage 0: prepare the Mac", [
  ["you", "Install Node 22, Claude Code, Chrome, Docker", "brew install node@22 && brew install --cask google-chrome orbstack"],
  ["you", "Log Claude Code in with the personal account", "claude auth login"],
  ["claude", "Get the repository", "git clone git@github.com:Chenophobia/Achentic.git ~/work/Achentic"],
  ["claude", "Ask Claude: \"set this machine up\", or run the doctor", "sh setup/doctor.sh"],
  ["you", "Keep the Mac awake", "sudo pmset -a sleep 0"],
], ["Doctor ends with \"Ready\"", "Every line says ok or warn", "Its own tests pass on this Mac"], ["sh setup/doctor.sh", "claude auth status", "node --version"]);

stage(1, "Stage 1: the agent user and its login", [
  ["you", "Create the account (you choose its password)", "sudo sh setup/agent-user/create-user.sh agent"],
  ["you", "Close your own home folder if it says \"open\"", "chmod 700 ~"],
  ["you", "Become the agent; install Node and Claude Code; clone", "sudo -u agent -i"],
  ["you", "Make a one-year login token", "claude setup-token"],
  ["you", "Paste it into the secrets file yourself", "~/.achentic/env   CLAUDE_CODE_OAUTH_TOKEN=…"],
], ["Doctor says Ready as the agent user", "Only that user can read ~/.achentic/env", "The agent user is not an admin"], ["sudo -u agent sh setup/doctor.sh", "ls -l /Users/agent/.achentic/env", "id agent"]);

stage(2, "Stage 2: first project, first ticket by hand", [
  ["claude", "Create the project from the template", "sh setup/new-project.sh my-app"],
  ["you", "Create the empty GitHub repository, push main", "git remote add origin … && git push -u origin main"],
  ["claude", "Write a ticket, commit it on main", "tickets/ready/001-first-thing.md"],
  ["you", "As the agent: clone the app, run one ticket", "sh setup/agent-user/run-as-agent.sh orchestrator ~/work/my-app"],
  ["you", "Read the verdict, fetch the branch, merge, push", "git fetch /Users/agent/work/my-app 'refs/heads/agent/*:refs/remotes/agent/*'"],
], ["The run ends in review or blocked, not an error", "docs/verdicts/verdict-001-….md exists on the branch", "GitHub Actions is green after your push"], ["orchestrator.mjs status --repo <app>", "~/.achentic/<app>/orchestrator.log", "~/.achentic/<app>/logs/*.json", "<app>/.verify-evidence/"]);

stage(3, "Stage 3: schedule the orchestrator", [
  ["you", "Install the job (runs as agent, no login needed)", "sudo sh setup/agent-user/install-daemon.sh agent orchestrator /Users/agent/work/my-app"],
  ["you", "Start it with the command it prints", "sudo launchctl bootstrap system /Library/LaunchDaemons/com.achentic.orchestrator.my-app.plist"],
  ["you", "Do not wait 30 minutes: run it now", "sudo launchctl kickstart system/com.achentic.orchestrator.my-app"],
  ["you", "Keep mission control running", "sudo sh setup/agent-user/install-daemon.sh agent mission-control /Users/agent/work/Achentic"],
  ["claude", "Queue a second ticket from mission control", "localhost:4400 → New ticket"],
], ["Status shows the job loaded, last exit 0", "The log gains a line every 30 minutes", "A ticket filed in mission control gets built by itself"], ["sudo -u agent sh setup/status.sh", "/Users/agent/.achentic/orchestrator-my-app.log", "launchctl print system/com.achentic.orchestrator.my-app"]);

stage(4, "Stage 4: host the app and switch on the sensors", [
  ["you", "Run the app in Docker from main; publish it through your tunnel", "docker compose up -d   (in the app's folder)"],
  ["you", "Live check, hourly", "sudo sh …/install-daemon.sh agent sensor <app> https://my-app.example.com"],
  ["you", "Uptime Kuma: start, create admin, add monitors", "docker compose -f sensors/uptime-kuma/compose.yml up -d"],
  ["you", "GlitchTip: start, register, project, token, ERROR_DSN", "sh sensors/glitchtip/init.sh && docker compose -f sensors/glitchtip/compose.yml up -d"],
  ["you", "Errors sensor, hourly", "sudo sh …/install-daemon.sh agent errors <app> http://localhost:8000 <org> <project>"],
], ["The public address answers", "Live check logs ok", "Kuma monitors are green", "A test error appears in GlitchTip"], ["localhost:3001   Uptime Kuma", "localhost:8000   GlitchTip", "/Users/agent/.achentic/sensor-my-app.log", "docker ps  ·  docker logs <name>"]);

stage(5, "Stage 5: work from anywhere, and locks", [
  ["you", "Discord: channel settings → Integrations → new webhook; paste its URL into the agent's env", "ACHENTIC_DISCORD_WEBHOOK_URL=…"],
  ["you", "Issues: name the repository in the same file; create the label \"agent\" on GitHub", "ACHENTIC_GITHUB_REPO=<owner>/<name>"],
  ["you", "Heartbeats: paste Kuma's two push addresses into the same file", "ACHENTIC_HEARTBEAT_URL=…   ACHENTIC_SENSOR_HEARTBEAT_URL=…"],
  ["you", "One outside check for \"the whole house is down\"", "a free pinger on one public health address"],
  ["you", "GitHub: protect main, require the gates check", "repository settings → branches"],
], ["An issue you open appears in Discord as queued, then step by step", "Kuma's push monitors turn green after a run", "A direct push to main is refused"], ["your Discord channel", "~/.achentic/<app>/intake-issues.json", "Kuma: push monitors", "GitHub: branch protection page"]);

// ───────── 11 Monitor
pres.addSection({ title: "Operate" });
{
  const s = content("Operate", "Monitoring: mission control first, then the file behind it");
  card(s, 0.6, 1.6, 4.3, 5.1, INK);
  txt(s, "Mission control", { x: 0.9, y: 1.8, w: 3.7, h: 0.35, fontSize: 16, bold: true, color: WHITE });
  mono(s, "http://localhost:4400", { x: 0.9, y: 2.25, w: 3.7, h: 0.35, fontSize: 14, color: WHITE, bold: true });
  txt(s, [
    { text: "What is running now, in every project", options: { bullet: true, breakLine: true } },
    { text: "Every ticket on a line of eight stations; blocked ones with the reason", options: { bullet: true, breakLine: true } },
    { text: "Per ticket: each agent, its skills, helper agents, commands, report, cost", options: { bullet: true, breakLine: true } },
    { text: "A form to file a new ticket", options: { bullet: true, breakLine: true } },
    { text: "Runs and cost, today and seven days", options: { bullet: true } },
  ], { x: 0.9, y: 2.8, w: 3.7, h: 2.9, fontSize: 14, color: MIST, paraSpaceAfter: 5 });
  txt(s, "In a terminal: sudo -u agent sh setup/status.sh (also shows jobs and containers)", { x: 0.9, y: 5.85, w: 3.7, h: 0.7, fontSize: 12, color: MIST });
  table(s, ["Question", "Look at"], [
    ["What happened, step by step", "~/.achentic/<app>/orchestrator.log"],
    ["What did the agent say", "~/.achentic/<app>/logs/<ticket>-builder-1.json"],
    ["What did it cost", "~/.achentic/<app>/runs.jsonl"],
    ["Why is a ticket blocked", "orchestrator.mjs status --repo <app>"],
    ["Did the job run at all", "/Users/agent/.achentic/<job>-<app>.log"],
    ["Proof from the browser", "<app>/.verify-evidence/"],
    ["Is the app up; any errors", "localhost:3001  ·  localhost:8000"],
  ], { x: 5.2, y: 1.6, w: 7.5, colW: [2.9, 4.6], rowH: 0.62 }, (i, j) => (j === 1 ? { fontFace: "Courier New", fontSize: 11, bold: false } : { bold: true }));
  txt(s, "~/.achentic means the home of whoever runs the jobs: /Users/agent once stage 1 is done.", { x: 5.2, y: 6.7, w: 7.0, h: 0.3, fontSize: 12, color: GRAY });
}

// ───────── 12 Daily workflow
{
  const s = content("Operate", "A normal day: file a ticket, watch it move, merge");
  const chain = [
    ["New ticket", "mission control,\nfrom anywhere", AMBER],
    ["Inbox", "numbered, queued\nwithin 30 min", GREEN],
    ["Build", "builder, gates,\nbrowser, verdict", PURPLE],
    ["Discord", "each step, then\nready to merge", GREEN],
    ["Merge", "fetch branch,\nread verdict, push", AMBER],
    ["CI", "GitHub Actions\nruns the gates", GREEN],
    ["Deploy", "pull, rebuild,\nrestart", AMBER],
  ];
  const w = 1.45, gap = 0.325, y = 1.75, h = 1.35;
  chain.forEach(([t, d, col], i) => {
    const x = 0.6 + i * (w + gap);
    node(s, t, d, x, y, w, h, col);
    if (i < chain.length - 1) arrow(s, x + w + 0.04, y + 0.53);
  });
  txt(s, "Deploy is by hand today. Nothing in this repository restarts your app.", { x: 0.6, y: 3.25, w: 12.1, h: 0.35, fontSize: 14, color: SLATE, italic: true });

  card(s, 0.6, 3.9, 5.9, 2.8, MIST);
  txt(s, "Without you", { x: 0.9, y: 4.05, w: 5.3, h: 0.35, fontSize: 16, bold: true, color: GREEN });
  txt(s, [
    { text: "Live check finds the app broken → ticket → same loop", options: { bullet: true, breakLine: true } },
    { text: "GlitchTip collects a new error → ticket → same loop", options: { bullet: true, breakLine: true } },
    { text: "App down → Discord alert only", options: { bullet: true, breakLine: true } },
    { text: "A job stops running → Kuma alerts", options: { bullet: true } },
  ], { x: 0.9, y: 4.5, w: 5.3, h: 2.1, fontSize: 14, color: INK, paraSpaceAfter: 5 });
  card(s, 6.8, 3.9, 5.9, 2.8, MIST);
  txt(s, "The limits it keeps by itself", { x: 7.1, y: 4.05, w: 5.3, h: 0.35, fontSize: 16, bold: true, color: AMBER });
  txt(s, [
    { text: "3 tickets a day, one at a time", options: { bullet: true, breakLine: true } },
    { text: "3 attempts per ticket, then blocked", options: { bullet: true, breakLine: true } },
    { text: "$25 / $8 guard per agent run", options: { bullet: true, breakLine: true } },
    { text: "Never pushes, merges or deploys", options: { bullet: true } },
  ], { x: 7.1, y: 4.5, w: 5.3, h: 2.1, fontSize: 14, color: INK, paraSpaceAfter: 5 });
}

// ───────── 13 Trouble
{
  const s = content("Operate", "When something is wrong");
  table(s, ["You see", "Likely cause", "Do"], [
    ["blocked: Builder run failed, login", "Token expired or wrong account", "claude setup-token as agent, update env, retry"],
    ["blocked: error_max_budget_usd", "One run went over the guard", "Raise ACHENTIC_BUILD_MAX_USD or split the ticket"],
    ["blocked: protected files", "Agent tried to change a gate", "Read its report; change the gate yourself if it is wrong"],
    ["blocked: after 3 attempts", "Ticket too big or unclear", "Rewrite it smaller, retry"],
    ["skipped: tree not clean", "Changes left in the agent's clone", "Commit or stash them there"],
    ["Nothing ran for hours", "Job not loaded, or the Mac slept", "status.sh; sudo pmset -a sleep 0"],
    ["Live check says down", "App or tunnel unreachable", "Hosting, not code: check the container and cloudflared"],
  ], { x: 0.6, y: 1.6, w: 12.1, colW: [3.9, 3.5, 4.7], rowH: 0.6 }, (i, j) => (j === 0 ? { bold: true } : { bold: false }));
  mono(s, "node orchestrator/orchestrator.mjs retry <ticket-id> --repo <app>", { x: 0.6, y: 6.62, w: 8.5, h: 0.3, fontSize: 12, color: INK });
  txt(s, "keeps the old branch as stale/…", { x: 9.2, y: 6.62, w: 3.5, h: 0.3, fontSize: 12, color: GRAY });
}

// ───────── 14 Another Mac, another project
{
  const s = content("Operate", "Another Mac, another project: three lines", "DARK_CONTENT");
  const rows = [
    ["Any Mac", "git clone git@github.com:Chenophobia/Achentic.git && cd Achentic && claude", "then say: set this machine up"],
    ["New project", "sh setup/new-project.sh <name>", "template, plugins, gates, first commit"],
    ["How is it going", "http://localhost:4400", "mission control; or sh setup/status.sh in a terminal"],
  ];
  rows.forEach(([t, cmd, note], i) => {
    const y = 1.75 + i * 1.5;
    card(s, 0.6, y, 12.1, 1.25, SLATE);
    txt(s, t, { x: 0.9, y: y + 0.15, w: 2.6, h: 0.95, fontSize: 20, bold: true, color: WHITE, valign: "middle" });
    mono(s, cmd, { x: 3.6, y: y + 0.18, w: 8.9, h: 0.45, fontSize: 13, color: WHITE, bold: true, valign: "middle" });
    txt(s, note, { x: 3.6, y: y + 0.68, w: 8.9, h: 0.4, fontSize: 14, color: MIST, valign: "middle" });
  });
  txt(s, "CLAUDE.md in the repository tells Claude what to run and what it must leave to you: passwords, tokens, sudo, pushing.", { x: 0.6, y: 6.4, w: 11.6, h: 0.6, fontSize: 14, color: MIST });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
