"""Authorized remote Win10 acceptance. Credentials arrive RSA-OAEP encrypted.
The private RSA and SSH keys exist only in RUNNER_TEMP, never in artifacts.
"""
import base64
import hashlib
import json
import ntpath
import os
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'acceptance'
TMP = Path(os.environ['RUNNER_TEMP'])
HOST = 'moment-everyone-basin-mobiles.trycloudflare.com'
USER = 'Acer'
HANDOFF = 'https://filebin.net/clipboard-win10-relay-1792834034-c72e3c40/connection.bin'
KEY = TMP / 'clipboard-identity'
ENDPOINT_PORT = 22022
proxy = None
report = {'passed': [], 'scope': 'authorized Acer Windows computer; actual OS build recorded'}


def psquote(value):
    return "'" + str(value).replace("'", "''") + "'"


def run(argv, **kwargs):
    return subprocess.run(argv, check=True, capture_output=True, **kwargs)


def ssh(command, timeout=180, input_data=None):
    argv = ['ssh', '-F', '/dev/null', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
            '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4',
            '-o', 'ControlMaster=auto', '-o', 'ControlPersist=120', '-o', 'ControlPath='+str(TMP/'clipboard-master'),
            '-o', 'StrictHostKeyChecking=accept-new', '-o', 'UserKnownHostsFile=' + str(TMP / 'clipboard-known-hosts'),
            '-o', 'HostKeyAlias=' + HOST, '-i', str(KEY), '-p', str(ENDPOINT_PORT), USER + '@127.0.0.1', command]
    p = subprocess.run(argv, capture_output=True, timeout=timeout, input=input_data)
    if p.returncode:
        raise RuntimeError('SSH failed: ' + p.stderr.decode('utf8', errors='replace')[-2500:])
    return p.stdout


def powershell(code, timeout=180, input_data=None):
    prefix = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; "
    encoded = base64.b64encode((prefix + code).encode('utf-16le')).decode()
    data = ssh('powershell.exe -NoProfile -NonInteractive -EncodedCommand ' + encoded, timeout, input_data)
    text = data.decode('utf-8-sig', errors='replace').strip()
    return json.loads(text) if text else None


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    report['passed'].append(name)
    print('PASS', name, flush=True)


def get_file(remote, local):
    run(['scp', '-F', '/dev/null', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
         '-o', 'UserKnownHostsFile=' + str(TMP / 'clipboard-known-hosts'), '-o', 'HostKeyAlias=' + HOST,
         '-i', str(KEY), '-P', str(ENDPOINT_PORT), USER + '@127.0.0.1:' + remote.replace('\\', '/'), str(local)], timeout=120)


try:
    print('Waiting for RSA-OAEP encrypted connection handoff', flush=True)
    deadline = time.monotonic() + 600
    attempt = 0
    while time.monotonic() < deadline:
        try:
            handoff = HANDOFF.replace('connection.bin', 'connection-' + os.environ['GITHUB_RUN_ID'] + '.bin')
            fetched = subprocess.run(['curl', '-fLsS', '--max-time', '15', handoff, '-o', str(TMP / 'connection.bin')], capture_output=True)
            size = (TMP / 'connection.bin').stat().st_size if (TMP / 'connection.bin').exists() else 0
            if fetched.returncode == 0 and size == 512:
                break
            attempt += 1
            if attempt % 10 == 0:
                print('Encrypted handoff pending; HTTP client exit', fetched.returncode, 'bytes', size, flush=True)
        except Exception:
            pass
        time.sleep(3)
    else:
        raise RuntimeError('Encrypted connection handoff did not arrive')
    run(['openssl', 'pkeyutl', '-decrypt', '-inkey', str(TMP / 'clipboard-relay.pem'),
         '-in', str(TMP / 'connection.bin'), '-out', str(KEY), '-pkeyopt', 'rsa_padding_mode:oaep', '-pkeyopt', 'rsa_oaep_md:sha256'])
    KEY.chmod(0o600)
    cloud = TMP / 'cloudflared'
    run(['curl', '-fLsS', '--max-time', '120', '--speed-limit', '819200', '--speed-time', '15',
         'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64', '-o', str(cloud)])
    cloud.chmod(0o700)
    proxy_log = (OUT / 'cloudflare-client.log').open('wb')
    proxy = subprocess.Popen([str(cloud), 'access', 'tcp', '--hostname', HOST, '--url', '127.0.0.1:22022'], stdout=proxy_log, stderr=proxy_log)
    time.sleep(2)
    identity=powershell("[pscustomobject]@{Host=$env:COMPUTERNAME;User=[Security.Principal.WindowsIdentity]::GetCurrent().Name;Session=[Diagnostics.Process]::GetCurrentProcess().SessionId}|ConvertTo-Json -Compress")
    check('authorized Acer laptop',identity['Host']=='LAPTOP-MCMQHDN4' and identity['User'].split(chr(92))[-1].lower()=='acer')
    result=powershell(r"""
    $run=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue
    $entries=@();if($run){foreach($p in $run.PSObject.Properties){if($p.Name -notmatch '^PS' -and ($p.Value -match 'clipboard|electron' -or $p.Name -match 'clipboard|electron')){$entries+=[pscustomobject]@{Name=$p.Name;Value=$p.Value}}}}
    $approved=@();foreach($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run','HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder')){$k=Get-ItemProperty $key -ErrorAction SilentlyContinue;if($k){foreach($p in $k.PSObject.Properties){if($p.Name -notmatch '^PS' -and $p.Name -match 'clipboard|electron'){$approved+=[pscustomobject]@{Name=$p.Name;State=@($p.Value)}}}}}
    $processes=@(Get-CimInstance Win32_Process -Filter "Name='Clipboard.exe' OR Name='electron.exe'"|Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,CreationDate)
    $files=@();foreach($v in $entries){if($v.Value -match '^"([^"\r\n]+)"'){$files+=[pscustomobject]@{Path=$Matches[1];Exists=[IO.File]::Exists($Matches[1])}}}
    $startup=[Environment]::GetFolderPath('Startup');$links=@(Get-ChildItem $startup -ErrorAction SilentlyContinue|Where-Object {$_.Name -match 'clipboard|electron'}|Select-Object Name,FullName)
    [pscustomobject]@{Run=$entries;StartupApproved=$approved;Processes=$processes;Paths=$files;StartupLinks=$links;Boot=(Get-CimInstance Win32_OperatingSystem).LastBootUpTime}|ConvertTo-Json -Depth 6 -Compress
    """)
    report.update({'status':'diagnosed','startup':result})
    print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
except Exception as exc:
    report.update({'status':'failed','error':str(exc)})
    raise
finally:
    (OUT/'hotkey-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    try:subprocess.run(['ssh','-S',str(TMP/'clipboard-master'),'-O','exit','-p','22022',USER+'@127.0.0.1'],capture_output=True,timeout=10)
    except Exception:pass
    if proxy and proxy.poll() is None:proxy.terminate()
