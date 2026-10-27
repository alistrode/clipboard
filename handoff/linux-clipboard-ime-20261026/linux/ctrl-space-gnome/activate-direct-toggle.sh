#!/bin/bash
set -euo pipefail
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
unit=org.gnome.Shell@x11.service
[ "$(systemctl --user show "$unit" -p Restart --value)" = always ]
[ "$(systemctl --user show "$unit" -p ActiveState --value)" = active ]
before=$(systemctl --user show "$unit" -p MainPID --value)
printf 'Shell before: %s\n' "$before"
# Ask the user's service manager to terminate only the managed Shell main process.
# The existing Restart=always restarts that service; no session target is stopped.
systemctl --user kill --signal=SIGTERM --kill-whom=main "$unit"
for i in $(seq 1 20); do
 sleep 1
 if gdbus call --session --dest org.gnome.Shell --object-path /org/local/DirectInputToggle --method org.local.DirectInputToggle.GetStatus 2>/dev/null; then
  printf 'Shell after: %s\n' "$(systemctl --user show "$unit" -p MainPID --value)"
  ps -p 9275,9583,10515 -o pid,comm
  gnome-extensions info direct-input-toggle@local
  echo 'Extension loaded; no key was generated. Physical application input remains unverified.'
  exit 0
 fi
done
# Retain previous behavior if the new component failed to load.
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/direct-input-toggle/ binding '<Control>space'
gnome-extensions info direct-input-toggle@local || true
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Extensions.GetExtensionErrors direct-input-toggle@local || true
exit 1
