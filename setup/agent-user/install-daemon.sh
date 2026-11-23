#!/bin/sh
set -eu

if [ $# -lt 3 ]; then
  echo "usage: sudo sh install-daemon.sh <agent-user> <orchestrator|sensor|errors> <app-repo> [url] [org] [project]" >&2
  exit 1
fi

user=$1
job=$2
repo=$3
url=${4:-}
org=${5:-}
project=${6:-}
here=$(cd "$(dirname "$0")" && pwd)
app=$(basename "$repo")
home=$(dscl . -read "/Users/$user" NFSHomeDirectory | awk '{print $2}')
node_dir=${NODE_DIR:-/opt/homebrew/bin}
claude_dir=${CLAUDE_DIR:-$home/.local/bin}
dest=${DEST:-/Library/LaunchDaemons}
label="com.achentic.$job.$app"
target="$dest/$label.plist"

case "$job" in
  orchestrator) interval=1800 ;;
  sensor) interval=3600; [ -n "$url" ] || { echo "sensor needs the app's address" >&2; exit 1; } ;;
  errors) interval=3600; [ -n "$project" ] || { echo "errors needs the tracker address, org slug and project slug" >&2; exit 1; } ;;
  *) echo "unknown job: $job" >&2; exit 1 ;;
esac

cat > "$target" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>UserName</key>
  <string>$user</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$here/run-as-agent.sh</string>
    <string>$job</string>
    <string>$repo</string>
    <string>$url</string>
    <string>$org</string>
    <string>$project</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>$home</string>
    <key>PATH</key>
    <string>$node_dir:$claude_dir:/usr/bin:/bin</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>$home</string>
  <key>StartInterval</key>
  <integer>$interval</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$home/.achentic/$job-$app.log</string>
  <key>StandardErrorPath</key>
  <string>$home/.achentic/$job-$app.log</string>
</dict>
</plist>
PLIST

plutil -lint "$target"
echo "wrote $target"
echo "start:   sudo launchctl bootstrap system $target"
echo "stop:    sudo launchctl bootout system/$label"
echo "run now: sudo launchctl kickstart system/$label"
