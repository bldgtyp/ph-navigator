#!/usr/bin/env bash
# Resolve the triggering ref and require it to be the current tip of main.
#
# Manual production workflows must be dispatched from main. Tag-triggered
# workflows may proceed only when the tag resolves to the same commit as main.

set -euo pipefail

if [ "${GITHUB_EVENT_NAME:-}" = "workflow_dispatch" ] && [ "${GITHUB_REF:-}" != "refs/heads/main" ]; then
  echo "::error::Dispatch this workflow from main (got ${GITHUB_REF:-unset})." >&2
  exit 1
fi

refs=$(git ls-remote "https://github.com/$GITHUB_REPOSITORY" refs/heads/main "$GITHUB_REF" "$GITHUB_REF^{}")
main_sha=$(echo "$refs" | awk '$2 == "refs/heads/main" {print $1}')
# For annotated tags the peeled (^{}) line has the commit; otherwise the
# plain ref line already does.
ref_sha=$(echo "$refs" | awk -v r="$GITHUB_REF" '$2 == r "^{}" {p = $1} $2 == r {t = $1} END {print (p != "" ? p : t)}')
if [ -z "$main_sha" ] || [ "$ref_sha" != "$main_sha" ]; then
  echo "::error::$GITHUB_REF (${ref_sha:-unknown}) is not the tip of main (${main_sha:-unknown})." >&2
  exit 1
fi

printf '%s\n' "$main_sha"
