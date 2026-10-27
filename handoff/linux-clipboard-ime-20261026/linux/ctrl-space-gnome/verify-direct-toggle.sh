#!/bin/bash
set -u
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
printf '\nEXTENSION (READ ONLY)\n'
gdbus call --session --dest org.gnome.Shell --object-path /org/local/DirectInputToggle --method org.local.DirectInputToggle.GetStatus
gnome-extensions info direct-input-toggle@local
printf '\nEXTENSION ERRORS\n'
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Extensions.GetExtensionErrors direct-input-toggle@local
printf '\nCURRENT BACKEND (NOT AN INPUT TEST)\n'
ctime=$(date -Iseconds); echo "$ctime"; ibus engine
printf '\nCUSTOM BINDING RELEASED\n'
gsettings get org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/direct-input-toggle/ binding
printf '\nIM CONFIGURATION\n'
gsettings get org.gnome.desktop.interface gtk-im-module
cat /home/versiona/.xinputrc
cat /home/versiona/.config/environment.d/60-ibus.conf
printf '\nACTIVATION IM ENV ONLY\n'
systemctl --user show-environment | grep -E '^(GTK_IM_MODULE|QT_IM_MODULE|XMODIFIERS)='
printf '\nSOURCE COPY AGREEMENT\n'
for f in extension.js metadata.json schemas/org.gnome.shell.extensions.direct-input-toggle.gschema.xml schemas/gschemas.compiled; do
 cmp "/home/versiona/xxm/chinese-input/dev/direct-toggle-gnome/direct-input-toggle@local/$f" "/home/versiona/.local/share/gnome-shell/extensions/direct-input-toggle@local/$f" && echo "identical: $f"
done
printf '\nRELEVANT COMPONENT LOG ONLY\n'
journalctl --user -u org.gnome.Shell@x11.service --since '-8 minutes' --no-pager -o cat | grep 'direct-input-toggle' | tail -15
