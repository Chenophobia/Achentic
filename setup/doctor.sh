#!/bin/sh
set -u

here=$(cd "$(dirname "$0")/.." && pwd)
missing=0

ok() { printf '  ok       %s\n' "$1"; }
need() {
  printf '  MISSING  %s\n           fix: %s\n' "$1" "$2"
  missing=$((missing + 1))
}
warn() { printf '  warn     %s\n           %s\n' "$1" "$2"; }

echo "Achentic doctor: $(sw_vers -productName 2>/dev/null) $(sw_vers -productVersion 2>/dev/null), $(uname -m)"
echo
echo "Required to run the loop"

if command -v node >/dev/null 2>&1; then
  if node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 6) ? 0 : 1)'; then
    ok "Node $(node -v)"
  else
    need "Node 22.6 or newer (found $(node -v))" "brew install node@22"
  fi
else
  need "Node 22.6 or newer" "brew install node@22"
fi

if command -v git >/dev/null 2>&1; then
  ok "git"
else
  need "git" "xcode-select --install"
fi

if [ -n "$(git config --global user.name 2>/dev/null)" ] && [ -n "$(git config --global user.email 2>/dev/null)" ]; then
  ok "git identity"
else
  need "git identity (the orchestrator commits verdict files)" "git config --global user.name '<name>' && git config --global user.email '<email>'"
fi

if command -v claude >/dev/null 2>&1; then
  ok "Claude Code $(claude --version 2>/dev/null | head -1)"
  if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    ok "Claude login: token from the environment"
  elif claude auth status 2>/dev/null | grep -q '"loggedIn": *true'; then
    plan=$(claude auth status 2>/dev/null | sed -n 's/.*"subscriptionType": *"\([^"]*\)".*/\1/p')
    ok "Claude login: plan ${plan:-unknown}"
    warn "check it is the personal account" "claude auth status   (a work login would bill the wrong organization)"
  else
    need "Claude login" "claude auth login   (a person has to do this; on a server: claude setup-token)"
  fi
else
  need "Claude Code" "see https://code.claude.com/docs for the installer"
fi

chrome=${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
if [ -x "$chrome" ]; then
  ok "Google Chrome (browser checks)"
else
  need "Google Chrome" "brew install --cask google-chrome"
fi

if [ -d "$HOME/.claude/plugins/cache/cursor-plugins/pstack" ]; then
  ok "pstack plugin downloaded"
else
  warn "pstack plugin not downloaded yet" "setup/new-project.sh downloads and installs it for each project"
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  warn "ANTHROPIC_API_KEY is set in this shell" "headless runs would bill the API instead of the subscription. Unset it."
fi

echo
echo "Needed only for the uptime check and error collection"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ok "Docker is running"
else
  warn "Docker is not running" "install OrbStack or Docker Desktop when you want those two sensors"
fi

echo
echo "This checkout"
if node --test "$here"/orchestrator/test/*.test.mjs "$here"/sensors/test/*.test.mjs "$here"/intake/test/*.test.mjs "$here"/mission-control/test/*.test.mjs >/dev/null 2>&1; then
  ok "orchestrator and sensor tests pass"
else
  need "orchestrator and sensor tests" "node --test orchestrator/test/*.test.mjs sensors/test/*.test.mjs"
fi

echo
if [ "$missing" -eq 0 ]; then
  echo "Ready. Next: sh setup/new-project.sh <name>"
else
  echo "$missing thing(s) missing. Fix them and run this again."
  exit 1
fi
