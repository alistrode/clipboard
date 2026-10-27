#!/bin/bash
set -euo pipefail
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
[ "$(id -un)" = versiona ]
[ "$(hostname)" = version-c-build ]
[ "$(gnome-shell --version)" = 'GNOME Shell 46.0' ]
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/home/versiona/xxm/beifen/chinese-input/ctrl-space-$stamp
mkdir -p "$backup" /home/versiona/xxm/chinese-input/dev/direct-toggle-gnome
chmod 700 "$backup"
export IME_BACKUP="$backup"
python3 - <<'BACKUP'
import os,zipfile,json,subprocess
from pathlib import Path
home=Path('/home/versiona'); b=Path(os.environ['IME_BACKUP'])
files=[home/'.local/bin/toggle-chinese-input',home/'.xinputrc',home/'.config/environment.d/60-ibus.conf']
e=home/'.local/share/gnome-shell/extensions/direct-input-toggle@local'
if e.exists(): files+=list(e.rglob('*'))
with zipfile.ZipFile(b/'source-before-change.zip','x',zipfile.ZIP_DEFLATED) as z:
 for p in files:
  if p.is_file():z.write(p,str(p.relative_to(home)))
settings=[('org.gnome.shell','enabled-extensions'),('org.gnome.shell','disabled-extensions'),('org.gnome.desktop.interface','gtk-im-module'),('org.gnome.desktop.wm.keybindings','switch-input-source'),('org.gnome.desktop.wm.keybindings','switch-input-source-backward'),('org.freedesktop.ibus.general.hotkey','triggers')]
snapshot={s+'/'+k:subprocess.check_output(['gsettings','get',s,k],text=True).strip() for s,k in settings}
custom='/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/direct-input-toggle/'
snapshot['custom-binding']=subprocess.check_output(['gsettings','get','org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:'+custom,'binding'],text=True).strip()
snapshot['existing-environment-file']=(home/'.config/environment.d/60-ibus.conf').exists()
snapshot['existing-xinputrc']=(home/'.xinputrc').exists()
(b/'settings-before.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2))
BACKUP
printf '%s' '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' | base64 -d | tar -xz -C /home/versiona/xxm/chinese-input/dev/direct-toggle-gnome
src=/home/versiona/xxm/chinese-input/dev/direct-toggle-gnome/direct-input-toggle@local
glib-compile-schemas --strict "$src/schemas"
mkdir -p /home/versiona/.local/share/gnome-shell/extensions
cp -a "$src" /home/versiona/.local/share/gnome-shell/extensions/
# Release the old binding before the new Shell owner registers Ctrl+Space.
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/direct-input-toggle/ binding ''
# GNOME's ordinary source switcher remains disabled; no chooser.
gsettings set org.gnome.desktop.wm.keybindings switch-input-source '[]'
gsettings set org.gnome.desktop.wm.keybindings switch-input-source-backward '[]'
python3 - <<'ENABLE'
from gi.repository import Gio
s=Gio.Settings.new('org.gnome.shell'); u='direct-input-toggle@local'
enabled=list(s.get_strv('enabled-extensions'))
if u not in enabled:s.set_strv('enabled-extensions',enabled+[u])
disabled=list(s.get_strv('disabled-extensions'))
if u in disabled:s.set_strv('disabled-extensions',[x for x in disabled if x!=u])
Gio.Settings.sync()
ENABLE
# Make native GTK and future activated applications use IBus.
gsettings set org.gnome.desktop.interface gtk-im-module ibus
mkdir -p /home/versiona/.config/environment.d
printf '%s\n' 'GTK_IM_MODULE=ibus' 'QT_IM_MODULE=ibus' 'XMODIFIERS=@im=ibus' >/home/versiona/.config/environment.d/60-ibus.conf
export GTK_IM_MODULE=ibus QT_IM_MODULE=ibus XMODIFIERS=@im=ibus
dbus-update-activation-environment --systemd GTK_IM_MODULE QT_IM_MODULE XMODIFIERS
im-config -n ibus
printf '%s\n' "$backup" > /home/versiona/xxm/chinese-input/dev/direct-toggle-gnome/last-backup-path
printf 'Backup: %s\n' "$backup"
printf 'Prepared extension and configuration; physical Ctrl+Space remains unverified.\n'
[ "$(systemctl --user show org.gnome.Shell@x11.service -p Restart --value)" = always ]
systemctl --user kill --signal=SIGTERM --kill-whom=main org.gnome.Shell@x11.service
for i in $(seq 1 15); do
 if gdbus call --session --dest org.gnome.Shell --object-path /org/local/DirectInputToggle --method org.local.DirectInputToggle.GetStatus 2>/dev/null; then
  echo 'Extension API ready (component check only, not a keyboard test).'
  exit 0
 fi
 sleep 1
done
echo 'Extension not ready; restoring the old shortcut binding to retain prior behavior.' >&2
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/direct-input-toggle/ binding '<Control>space'
gnome-extensions info direct-input-toggle@local || true
exit 1
