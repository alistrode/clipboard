#!/bin/sh
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
printf '\nCURRENT ACTIVATION IM ENV\n'
systemctl --user show-environment | grep -E '^(GTK_IM_MODULE|QT_IM_MODULE|XMODIFIERS|DISPLAY|XDG_SESSION_TYPE)='
printf '\nAPPLICATION EXECUTABLES\n'
for p in 9275 9583 10515; do readlink /proc/$p/exe; done
printf '\nRELEVANT LAUNCHERS\n'
find /home/versiona/.local/share/applications /usr/share/applications -maxdepth 1 -iname '*v2ray*' -o -iname '*browser*' -o -iname '*chrome*' 2>/dev/null | head -15
printf '\nGNOME SHELL SERVICE RESTART SCOPE\n'
systemctl --user cat org.gnome.Shell@x11.service | head -70
printf '\nSUDO READINESS\n'
sudo -n true >/dev/null 2>&1; echo "sudo_n_exit=$?"
