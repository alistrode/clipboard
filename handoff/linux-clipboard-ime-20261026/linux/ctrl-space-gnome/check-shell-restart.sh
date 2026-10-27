#!/bin/sh
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
printf '\nSHELL SERVICE\n'
systemctl --user show org.gnome.Shell@x11.service -p ActiveState -p ExecStart -p Restart -p PartOf -p BindsTo -p FragmentPath
printf '\nSHELL RESOURCE FILES\n'
dpkg -L libgnome-shell-0 2>/dev/null | head -25
find /usr/lib -maxdepth 4 -name 'libgnome-shell*.so*' -o -name '*shell*.typelib' 2>/dev/null | head -20
printf '\nMETADATA FOR KEYBINDING FLAG\n'
grep -A70 'name="KeyBindingFlags"' /usr/share/gir-1.0/Meta-14.gir 2>/dev/null | head -70
printf '\nSHELL AND ORIGINAL BROWSER IM ENV\n'
for p in 2153 5619 9583 10515; do
 [ -r /proc/$p/environ ] || continue
 ps -p "$p" -o pid,comm --no-headers
 tr '\0' '\n' </proc/$p/environ | grep -E '^(GTK_IM_MODULE|QT_IM_MODULE|XMODIFIERS|XDG_SESSION_TYPE)=' || true
done
