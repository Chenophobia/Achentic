#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
file="$here/.env"

if [ -f "$file" ]; then
  echo "$file already exists; left as it is"
  exit 0
fi

umask 077
printf 'GLITCHTIP_SECRET_KEY=%s\n' "$(openssl rand -hex 32)" > "$file"
echo "wrote $file (a random secret key; keep it, do not commit it)"
