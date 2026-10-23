#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"
if command -v node >/dev/null 2>&1; then
  exec node scripts/dev.cjs "$@"
fi
ELECTRON_RUN_AS_NODE=1 exec "$SCRIPT_DIR/node_modules/electron/dist/electron" "$SCRIPT_DIR/scripts/dev.cjs" "$@"
