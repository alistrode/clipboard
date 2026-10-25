#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP="$ROOT/.runtime/clipboard-linux-x64/start.sh"
if [ ! -x "$APP" ]; then
  mkdir -p "$ROOT/.runtime"
  cat "$ROOT"/deliverables/linux.part* > "$ROOT/.runtime/linux.tar.gz"
  printf '%s  %s\n' 'e45dcacdada0370efcc08bb6885cf5e1e35089f00d6af06942ddd59e9d36dd1e' "$ROOT/.runtime/linux.tar.gz" | sha256sum -c -
  tar -xzf "$ROOT/.runtime/linux.tar.gz" -C "$ROOT/.runtime"
  rm "$ROOT/.runtime/linux.tar.gz"
fi
exec "$APP" "$@"
