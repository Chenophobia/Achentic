#!/bin/sh
set -eu

if [ $# -lt 1 ]; then
  echo "usage: new-project.sh <name> [parent-folder]   (default parent: ~/work)" >&2
  exit 1
fi

name=$1
parent=${2:-$HOME/work}
here=$(cd "$(dirname "$0")/.." && pwd)
target="$parent/$name"

case "$name" in
  *[!a-z0-9-]* | "")
    echo "name must be lowercase letters, digits and dashes" >&2
    exit 1
    ;;
esac
if [ -e "$target" ]; then
  echo "$target already exists; nothing changed" >&2
  exit 1
fi

mkdir -p "$target"
git -C "$here" archive HEAD template | tar -x --strip-components=1 -C "$target"
cd "$target"

node -e '
const fs = require("node:fs");
for (const file of ["package.json", "package-lock.json"]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.name = process.argv[1];
  if (data.packages && data.packages[""]) data.packages[""].name = process.argv[1];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}' "$name"

mkdir -p tickets/ready
: > tickets/ready/.gitkeep

git init -q -b main
echo "installing plugins for this project"
claude plugin marketplace add cursor/plugins >/dev/null 2>&1 || true
claude plugin install pstack@cursor-plugins --scope project
claude plugin install mattpocock-skills@claude-plugins-official --scope project

echo "installing dependencies and running the gates"
npm ci --silent
npm run --silent gates

git add -A
git commit -q -m "Start $name from the Achentic template"

cat <<NEXT

Created $target, gates green, first commit made.

Next:
  1. Write a ticket:   node $here/mission-control/server.mjs, open http://localhost:4400, New ticket
                       (the project appears there after its first orchestrator run; before that,
                       copy tickets/TEMPLATE.md to tickets/ready/<INITIALS>-1.md and commit)
  2. Run the loop:     ACHENTIC_SANDBOX=1 node $here/orchestrator/orchestrator.mjs run --repo $target
  3. See the result:   node $here/orchestrator/orchestrator.mjs status --repo $target
  4. Publish:          create an empty repository on GitHub, then
                       git remote add origin <url> && git push -u origin main
  5. Once the app has a page: in Claude Code inside the project, /pstack:create-verification-skill
NEXT
