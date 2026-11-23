#!/bin/sh
set -eu

name=${1:-agent}

if [ "$(id -u)" -ne 0 ]; then
  echo "run with sudo: sudo sh setup/agent-user/create-user.sh [name]" >&2
  exit 1
fi
if id "$name" >/dev/null 2>&1; then
  echo "user $name already exists; nothing created"
else
  echo "Creating standard (non-admin) user '$name'. You will be asked to choose its password."
  sysadminctl -addUser "$name" -fullName "Achentic Agent" -password -
fi

if dseditgroup -o checkmember -m "$name" admin >/dev/null 2>&1; then
  echo "WARNING: $name is in the admin group. Remove it: dseditgroup -o edit -d $name -t user admin" >&2
  exit 1
fi

home=$(dscl . -read "/Users/$name" NFSHomeDirectory | awk '{print $2}')
install -d -o "$name" -g staff -m 700 "$home/.achentic"
install -d -o "$name" -g staff -m 755 "$home/work"
if [ ! -f "$home/.achentic/env" ]; then
  install -o "$name" -g staff -m 600 /dev/null "$home/.achentic/env"
fi

echo
echo "user:  $name (standard, not admin)"
echo "home:  $home"
echo "clone app repositories into $home/work"
echo "secrets file (only $name can read it): $home/.achentic/env"
echo
echo "Check your own home folder is closed to other users:"
for other in /Users/*; do
  [ -d "$other" ] || continue
  case "$other" in "$home" | /Users/Shared | /Users/Guest) continue ;; esac
  mode=$(stat -f '%Lp' "$other")
  if [ "$mode" = "700" ]; then
    echo "  $other  $mode  ok"
  else
    echo "  $other  $mode  open to other users. To close it: chmod 700 $other"
  fi
done
