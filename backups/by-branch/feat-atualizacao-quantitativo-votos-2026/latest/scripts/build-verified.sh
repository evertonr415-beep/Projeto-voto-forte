#!/usr/bin/env bash
set -euo pipefail

if [ -f "./node_modules/.bin/next" ]; then
  ./node_modules/.bin/next build
elif command -v next >/dev/null 2>&1; then
  next build
else
  npx next build
fi

