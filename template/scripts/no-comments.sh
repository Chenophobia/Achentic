#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

npx tsc --noEmit false --outDir "$tmp/with" >/dev/null
npx tsc --noEmit false --removeComments --outDir "$tmp/without" >/dev/null

allowed='https?://|biome-ignore|@ts-expect-error|SPDX-License-Identifier'
found=$(diff -r "$tmp/with" "$tmp/without" | grep '^<' | grep -v -E "$allowed" || true)

if [ -n "$found" ]; then
  echo "gate: comments found. Rename or restructure so the code explains itself." >&2
  echo "Allowed: a line carrying a link, a biome-ignore or @ts-expect-error directive, or an SPDX header." >&2
  echo "$found" >&2
  exit 1
fi
