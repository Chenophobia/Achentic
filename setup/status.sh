#!/bin/sh
set -u

here=$(cd "$(dirname "$0")/.." && pwd)
home=${ACHENTIC_HOME:-$HOME/.achentic}

echo "== Scheduled jobs"
found=0
for plist in "$HOME"/Library/LaunchAgents/com.achentic.*.plist /Library/LaunchDaemons/com.achentic.*.plist; do
  [ -f "$plist" ] || continue
  found=1
  label=$(basename "$plist" .plist)
  case "$plist" in
    /Library/*) domain=system ;;
    *) domain="gui/$(id -u)" ;;
  esac
  info=$(launchctl print "$domain/$label" 2>/dev/null)
  if [ -n "$info" ]; then
    runs=$(printf '%s\n' "$info" | sed -n 's/^[[:space:]]*runs = //p' | head -1)
    code=$(printf '%s\n' "$info" | sed -n 's/^[[:space:]]*last exit code = //p' | head -1)
    echo "  loaded      $label   runs: ${runs:-?}   last exit: ${code:-?}"
  else
    echo "  NOT LOADED  $label   ($plist)"
  fi
done
if [ "$found" -eq 0 ]; then echo "  none installed"; fi

echo
echo "== Apps"
any=0
for dir in "$home"/*/; do
  [ -f "${dir}orchestrator.log" ] || continue
  any=1
  app=$(basename "$dir")
  echo "-- $app   (state: $dir)"
  if [ -f "${dir}repo" ] && [ -d "$(cat "${dir}repo")" ]; then
    ACHENTIC_HOME="$home" node "$here/orchestrator/orchestrator.mjs" status --repo "$(cat "${dir}repo")" 2>&1 | sed 's/^/   /'
  fi
  if [ -f "${dir}runs.jsonl" ]; then
    node -e '
const rows = require("node:fs").readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const day = new Date().toISOString().slice(0, 10);
const sum = (list) => list.reduce((total, row) => total + (row.costUsd || 0), 0).toFixed(2);
const today = rows.filter((row) => row.at.startsWith(day));
const week = rows.filter((row) => Date.now() - Date.parse(row.at) < 7 * 864e5);
console.log("   agent runs today: " + today.length + " ($" + sum(today) + ")   last 7 days: " + week.length + " ($" + sum(week) + ")   API-equivalent");' "${dir}runs.jsonl"
  fi
  echo "   last lines of the log:"
  tail -5 "${dir}orchestrator.log" | cut -c1-200 | sed 's/^/     /'
  if [ -d "${dir}lock" ]; then
    echo "   a run is in progress (lock held by process $(cat "${dir}lock/pid" 2>/dev/null))"
  fi
done
if [ "$any" -eq 0 ]; then echo "  no app has run yet (looked in $home)"; fi

echo
echo "== Containers"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  out=$(docker ps -a --filter name=achentic --format '  {{.Names}}   {{.Status}}')
  if [ -n "$out" ]; then echo "$out"; else echo "  none"; fi
else
  echo "  Docker is not running"
fi
