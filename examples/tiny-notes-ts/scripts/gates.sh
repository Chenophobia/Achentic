#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

step() { echo "gate: $1"; }

step "typecheck (strict)"
npx tsc --noEmit

step "lint and format"
npx biome ci .

step "no comments"
sh scripts/no-comments.sh

step "unused files, exports and dependencies"
npx knip

step "duplication"
npx jscpd src --min-lines 6 --min-tokens 50 --threshold 0 --reporters console --silent

step "tests"
npm test --silent

echo "gates: ok"
