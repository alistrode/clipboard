#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP="$ROOT/.runtime/clipboard-linux-x64/start.sh"
if [ ! -x "$APP" ]; then
  mkdir -p "$ROOT/.runtime"
  cat "$ROOT"/deliverables/linux.part* > "$ROOT/.runtime/linux.tar.gz"
  printf '%s  %s\n' '475e2c1c51967bc80d0784ecc81c8f720d3f5b4c460a1d8d87a12fd97ce5ca7f' "$ROOT/.runtime/linux.tar.gz" | sha256sum -c -
  tar -xzf "$ROOT/.runtime/linux.tar.gz" -C "$ROOT/.runtime"
  rm "$ROOT/.runtime/linux.tar.gz"
fi
exec "$APP" "$@"
