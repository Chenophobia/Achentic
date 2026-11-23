#!/bin/sh
set -eu

if [ $# -ne 2 ]; then
  echo "usage: install-launchd.sh <path-to-app-repo> <address of the deployed app>" >&2
  exit 1
fi

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$1" && pwd)
url=$2
app=$(basename "$repo")
node_bin=$(command -v node)
label="com.achentic.sensor.verify.$app"
target="$HOME/Library/LaunchAgents/$label.plist"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$target" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$node_bin</string>
    <string>$here/verify-live.mjs</string>
    <string>--repo</string>
    <string>$repo</string>
    <string>--url</string>
    <string>$url</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "$node_bin"):/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/achentic-sensor-$app.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/achentic-sensor-$app.log</string>
</dict>
</plist>
PLIST

plutil -lint "$target"
echo "wrote $target"
echo "start:  launchctl bootstrap gui/$(id -u) $target"
echo "stop:   launchctl bootout gui/$(id -u)/$label"
echo "run now: launchctl kickstart gui/$(id -u)/$label"
