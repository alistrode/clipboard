import sys,json,base64,subprocess
from pathlib import Path
p=Path(sys.argv[1]); payload=base64.b64encode(p.read_bytes()).decode()
linux="printf '%s' '"+payload+"' | base64 -d | bash"
ps="& ssh.exe -i ($env:USERPROFILE+'/.ssh/version-c_ed25519') -p 45624 -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 versiona@127.0.0.1 \""+linux+"\"; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}"
req={'name':'ssh_execute','arguments':{'server':'device-2ec525ab-2340-4189-a4db-4d34b6d1e3bd','command':ps,'timeout':120000}}
subprocess.run(['node','/workspace/work/relay-call.cjs'],input=json.dumps(req),text=True,check=True)
