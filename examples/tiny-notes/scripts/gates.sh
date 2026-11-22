#!/bin/sh
# Deterministic gates. Exit code is decided only by these tools.
set -eu
cd "$(dirname "$0")/.."

for f in server.js store.js test/*.js; do node --check "$f"; done

# Comment budget: source files may not gain comments beyond licence headers.
if grep -nE '^\s*//' server.js store.js; then
  echo "gate: comments found in source" >&2
  exit 1
fi

# Size budget: fail when the app grows past a deliberate ceiling.
lines=$(cat server.js store.js public/index.html | wc -l | tr -d ' ')
max=$(cat scripts/size-budget)
if [ "$lines" -gt "$max" ]; then
  echo "gate: $lines lines > budget $max (raise scripts/size-budget on purpose, not by accident)" >&2
  exit 1
fi

node --test
echo "gates: ok ($lines/$max lines)"
