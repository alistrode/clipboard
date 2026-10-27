#!/bin/bash
# Passive observer: reads only this extension's status; never reads text or keys.
set -u
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
previous=
for i in $(seq 1 20); do
 current=$(timeout 3 gdbus call --session --dest org.gnome.Shell --object-path /org/local/DirectInputToggle --method org.local.DirectInputToggle.GetStatus 2>&1)
 if [ "$current" != "$previous" ]; then date -Iseconds; printf '%s\n' "$current"; previous=$current; fi
 sleep 2
done
ibus engine
