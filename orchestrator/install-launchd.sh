#!/bin/sh
set -eu

if [ $# -ne 1 ]; then
  echo "usage: install-launchd.sh <path-to-app-repo>" >&2
  exit 1
fi

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$1" && pwd)
app=$(basename "$repo")
node_bin=$(command -v node)
claude_bin=$(command -v claude)
target="$HOME/Library/LaunchAgents/com.achentic.orchestrator.$app.plist"

mkdir -p "$HOME/Library/LaunchAgents"
sed \
  -e "s|NODE_BIN|$node_bin|" \
  -e "s|NODE_DIR|$(dirname "$node_bin")|" \
  -e "s|CLAUDE_DIR|$(dirname "$claude_bin")|" \
  -e "s|ACHENTIC_DIR|$(dirname "$here")|" \
  -e "s|APP_REPO|$repo|" \
  -e "s|HOME_DIR|$HOME|g" \
  -e "s|APP|$app|g" \
  "$here/launchd/com.achentic.orchestrator.plist" > "$target"

plutil -lint "$target"
echo "wrote $target"
echo "start:  launchctl bootstrap gui/$(id -u) $target"
echo "stop:   launchctl bootout gui/$(id -u)/com.achentic.orchestrator.$app"
echo "run now: launchctl kickstart gui/$(id -u)/com.achentic.orchestrator.$app"
