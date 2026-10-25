#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP="$ROOT/.runtime/clipboard-linux-x64/start.sh"
if [ ! -x "$APP" ]; then
  mkdir -p "$ROOT/.runtime"
  cat "$ROOT"/deliverables/linux.part* > "$ROOT/.runtime/linux.tar.gz"
  printf '%s  %s\n' 'a8fc2054c0369e8b321bdb2a74b27d561def80b3a41b1a9a62eb1f899a7dac48' "$ROOT/.runtime/linux.tar.gz" | sha256sum -c -
  tar -xzf "$ROOT/.runtime/linux.tar.gz" -C "$ROOT/.runtime"
  rm "$ROOT/.runtime/linux.tar.gz"
fi
exec "$APP" "$@"
