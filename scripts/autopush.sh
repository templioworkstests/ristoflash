#!/bin/sh

set -e

if [ -z "$1" ]; then
  echo "Usage: $(basename "$0") \"commit message\"" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_DIR"

git status --short

git add -A

git commit -m "$1"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

git push origin "$CURRENT_BRANCH"

