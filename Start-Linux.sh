#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP="$ROOT/.runtime/clipboard-linux-x64/start.sh"
if [ ! -x "$APP" ]; then
  mkdir -p "$ROOT/.runtime"
  cat "$ROOT"/deliverables/linux.part* > "$ROOT/.runtime/linux.tar.gz"
  printf '%s  %s\n' '86c2978059acefc2918d309cea11ca7fa7753942d88ec348b13c764a45cf63d4' "$ROOT/.runtime/linux.tar.gz" | sha256sum -c -
  tar -xzf "$ROOT/.runtime/linux.tar.gz" -C "$ROOT/.runtime"
  rm "$ROOT/.runtime/linux.tar.gz"
fi
exec "$APP" "$@"
