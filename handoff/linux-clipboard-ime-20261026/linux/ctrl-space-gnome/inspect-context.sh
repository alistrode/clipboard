#!/bin/sh
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
printf '\nACTIVE ENVIRONMENT (IM ONLY)\n'
w=$(xprop -root _NET_ACTIVE_WINDOW | awk '{print $NF}')
p=$(xprop -id "$w" _NET_WM_PID 2>/dev/null | awk '{print $NF}')
case "$p" in *[!0-9]*|'') ;; *) ps -p "$p" -o pid,ppid,comm; tr '\0' '\n' <"/proc/$p/environ" | grep -E '^(GTK_IM_MODULE|QT_IM_MODULE|XMODIFIERS|DISPLAY|DBUS_SESSION_BUS_ADDRESS|XDG_SESSION_TYPE)=';; esac
printf '\nIBUS DAEMON IM-ONLY OPTIONS\n'
for p in $(pgrep -x ibus-daemon); do tr '\0' ' ' <"/proc/$p/cmdline"; echo; done
printf '\nSHELL EXTENSIONS\n'
gnome-extensions list --enabled
printf '\nIBUS PRIVATE BUS\n'
a=$(ibus address)
gdbus introspect --address "$a" --dest org.freedesktop.IBus --object-path /org/freedesktop/IBus | head -110
printf '\nIBUS PANEL SERVICE\n'
busctl --user list --no-pager | grep -E 'IBus|gnome.Shell|SettingsDaemon.MediaKeys'
printf '\nINPUT MODULE PACKAGES\n'
dpkg-query -W ibus ibus-gtk ibus-gtk3 ibus-gtk4 ibus-libpinyin 2>/dev/null
gsettings get org.gnome.desktop.interface gtk-im-module
printf '\nRELEVANT XKB\n'
gsettings get org.gnome.desktop.input-sources xkb-options
