#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP="$ROOT/.runtime/clipboard-linux-x64/start.sh"
if [ ! -x "$APP" ]; then
  mkdir -p "$ROOT/.runtime"
  cat "$ROOT"/deliverables/linux.part* > "$ROOT/.runtime/linux.tar.gz"
  printf '%s  %s\n' 'ee1d1db83c41243a7d70cdc8306316e445540650ad0f9af0406e9215b7479b98' "$ROOT/.runtime/linux.tar.gz" | sha256sum -c -
  tar -xzf "$ROOT/.runtime/linux.tar.gz" -C "$ROOT/.runtime"
  rm "$ROOT/.runtime/linux.tar.gz"
fi
exec "$APP" "$@"
