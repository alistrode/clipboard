#!/bin/sh
set -u
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
id; hostname; date -Iseconds
printf '\nSESSION\n'
loginctl list-sessions --no-legend
printf '\nINPUT SETTINGS\n'
gsettings get org.gnome.desktop.input-sources sources
gsettings get org.gnome.desktop.input-sources current
gsettings get org.gnome.desktop.input-sources per-window
gsettings get org.gnome.desktop.wm.keybindings switch-input-source
gsettings get org.gnome.desktop.wm.keybindings switch-input-source-backward
gsettings get org.freedesktop.ibus.general.hotkey triggers
ibus engine
printf '\nCUSTOM BINDINGS\n'
dconf dump /org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/
printf '\nACTIVE WINDOW PROCESS\n'
w=$(xprop -root _NET_ACTIVE_WINDOW 2>/dev/null | awk '{print $NF}')
xprop -id "$w" _NET_WM_PID WM_CLASS 2>/dev/null || true
printf '\nIBUS PROCESSES\n'
ps -eo pid,ppid,lstart,comm | grep -E 'ibus|gsd-media|gnome-shell'
printf '\nTOGGLE SCRIPT\n'
cat /home/versiona/.local/bin/toggle-chinese-input
printf '\nRECENT TOGGLE EVENTS\n'
tail -25 /home/versiona/xxm/chinese-input/dev/direct-toggle.log
printf '\nIM CONFIG\n'
cat /home/versiona/.xinputrc 2>/dev/null || true
im-config -m 2>/dev/null || true
printf '\nIBUS BUS OBJECTS\n'
gdbus introspect --session --dest org.freedesktop.IBus --object-path /org/freedesktop/IBus 2>/dev/null | head -85
