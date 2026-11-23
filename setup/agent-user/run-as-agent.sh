#!/bin/sh
set -eu

if [ $# -lt 2 ]; then
  echo "usage: run-as-agent.sh <orchestrator|sensor|errors> <app-repo> [url] [org] [project]" >&2
  exit 1
fi

job=$1
repo=$2
here=$(cd "$(dirname "$0")/../.." && pwd)

set -a
. "$HOME/.achentic/env"
set +a

unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "CLAUDE_CODE_OAUTH_TOKEN is not set in $HOME/.achentic/env" >&2
  exit 1
fi

export ACHENTIC_SANDBOX=${ACHENTIC_SANDBOX:-1}

if git -C "$repo" remote get-url origin >/dev/null 2>&1; then
  git -C "$repo" pull -q --rebase || echo "could not pull $repo; running with what is here" >&2
fi

case "$job" in
  orchestrator)
    exec node "$here/orchestrator/orchestrator.mjs" run --repo "$repo"
    ;;
  sensor)
    exec node "$here/sensors/verify-live.mjs" --repo "$repo" --url "$3"
    ;;
  errors)
    exec node "$here/sensors/errors.mjs" --repo "$repo" --url "$3" --org "$4" --project "$5"
    ;;
  *)
    echo "unknown job: $job" >&2
    exit 1
    ;;
esac
