#!/bin/bash
set -euo pipefail
export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
: "${1:?Usage: rollback-direct-toggle.sh /home/versiona/xxm/beifen/chinese-input/ctrl-space-TIMESTAMP}"
export IME_BACKUP="$1"
[ -f "$IME_BACKUP/settings-before.json" ]
gnome-extensions disable direct-input-toggle@local || true
python3 - <<'PY'
import json,os,zipfile,subprocess
from pathlib import Path
b=Path(os.environ['IME_BACKUP']);home=Path('/home/versiona')
s=json.loads((b/'settings-before.json').read_text())
for k,v in s.items():
 if '/' in k:
  schema,key=k.split('/',1);subprocess.run(['gsettings','set',schema,key,v],check=True)
custom='org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/direct-input-toggle/'
subprocess.run(['gsettings','set',custom,'binding',s['custom-binding']],check=True)
with zipfile.ZipFile(b/'source-before-change.zip') as z:
 for member in z.infolist():
  p=home/member.filename
  if '..' in Path(member.filename).parts or Path(member.filename).is_absolute():raise ValueError('Invalid backup entry')
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(member))
  mode=member.external_attr>>16
  if mode:p.chmod(mode&0o777)
for key,path in [('existing-environment-file','.config/environment.d/60-ibus.conf'),('existing-xinputrc','.xinputrc')]:
 if not s.get(key):(home/path).unlink(missing_ok=True)
PY
# This deployment added GTK_IM_MODULE to activation environment; the original
# snapshot showed QT_IM_MODULE=ibus, XMODIFIERS=@im=ibus and GTK_IM_MODULE absent.
systemctl --user unset-environment GTK_IM_MODULE
env GTK_IM_MODULE= dbus-update-activation-environment GTK_IM_MODULE
printf 'Previous settings restored; application text entry has not been tested.\n'
