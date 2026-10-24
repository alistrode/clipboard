"""Authorized remote Win10 acceptance. Credentials arrive RSA-OAEP encrypted.
The private RSA and SSH keys exist only in RUNNER_TEMP, never in artifacts.
"""
import base64
import hashlib
import json
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
report = {'passed': [], 'scope': 'authorized real Windows 10 computer'}


def psquote(value):
    return "'" + str(value).replace("'", "''") + "'"


def run(argv, **kwargs):
    return subprocess.run(argv, check=True, capture_output=True, **kwargs)


def ssh(command, timeout=180, input_data=None):
    argv = ['ssh', '-F', '/dev/null', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
            '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4',
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
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        try:
            handoff = HANDOFF.replace('connection.bin', 'connection-' + os.environ['GITHUB_RUN_ID'] + '.bin')
            with urllib.request.urlopen(handoff, timeout=15) as response:
                encrypted = response.read()
            if len(encrypted) == 512:
                (TMP / 'connection.bin').write_bytes(encrypted)
                break
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
    raw = ssh('whoami & hostname & ver')
    print('SSH authentication succeeded', flush=True)
    identity = powershell(r"""
    $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $drives=@([IO.DriveInfo]::GetDrives() | Where-Object {$_.IsReady -and $_.DriveType -eq 'Fixed'} | ForEach-Object {
      [pscustomobject]@{Root=$_.RootDirectory.FullName;Free=$_.AvailableFreeSpace;ExistingXxm=[IO.Directory]::Exists((Join-Path $_.RootDirectory.FullName 'xxm'))}
    })
    [pscustomobject]@{User=[Security.Principal.WindowsIdentity]::GetCurrent().Name;Host=$env:COMPUTERNAME;Profile=$env:USERPROFILE;SystemDrive=$env:SystemDrive;Product=$os.ProductName;Build=$os.CurrentBuild;Session=[Diagnostics.Process]::GetCurrentProcess().SessionId;ExplorerSessions=@([Diagnostics.Process]::GetProcessesByName('explorer') | ForEach-Object {$_.SessionId});Drives=$drives} | ConvertTo-Json -Depth 6 -Compress
    """)
    report['identity'] = identity
    (OUT / 'identity.json').write_text(json.dumps(identity, ensure_ascii=False, indent=2))
    check('authenticated account is Acer', identity['User'].lower().endswith('\\acer'))
    check('actual target is Windows 10', 'Windows 10' in identity['Product'] and 10240 <= int(identity['Build']) < 22000)
    print('Verified target:', identity['Host'], identity['Product'], 'build', identity['Build'], flush=True)

    drives = sorted(identity['Drives'], key=lambda d: d['Free'], reverse=True)
    candidates = [d['Root'] + 'xxm' for d in drives if d['ExistingXxm']]
    candidates += [d['Root'] + 'xxm' for d in drives if d['Root'].rstrip('\\').lower() != identity['SystemDrive'].lower() and not d['ExistingXxm']]
    candidates.append(identity['Profile'] + '\\Documents\\Codex\\xxm')
    workspace = None
    for candidate in candidates:
        try:
            ok = powershell("$p=" + psquote(candidate) + ";[IO.Directory]::CreateDirectory($p)|Out-Null;$f=Join-Path $p '.clipboard-write-probe';[IO.File]::WriteAllText($f,'');[IO.File]::Delete($f);$true|ConvertTo-Json")
            if ok:
                workspace = candidate
                break
        except Exception:
            pass
    check('writable xxm workspace selected', bool(workspace))
    project = workspace + '\\clipboard'
    suffix = str(os.environ.get('GITHUB_RUN_ID', int(time.time())))
    dev = project + '\\dev\\validation-' + suffix
    release = project + '\\release\\win10-' + suffix
    archive = dev + '\\clipboard-windows-x64.zip'
    profile = dev + '\\profile'
    report.update({'workspace': workspace, 'project': project, 'release': release, 'validation_profile': profile})
    powershell("foreach($p in @(" + ','.join(psquote(p) for p in [dev, release, project + '\\backups']) + ")){[IO.Directory]::CreateDirectory($p)|Out-Null};$true|ConvertTo-Json")

    download_script = r"""
    $archive=ARCHIVE
    $timer=[Diagnostics.Stopwatch]::StartNew()
    $wc=New-Object Net.WebClient
    try {$wc.DownloadFile('https://filebin.net/clipboard-1792827258-e3e0dca2/clipboard-windows-x64.zip',$archive)} finally {$wc.Dispose()}
    $h=[Security.Cryptography.SHA256]::Create();$f=[IO.File]::OpenRead($archive)
    try {$digest=[BitConverter]::ToString($h.ComputeHash($f)).Replace('-','').ToLowerInvariant()} finally {$f.Dispose();$h.Dispose()}
    [pscustomobject]@{Sha256=$digest;Bytes=(New-Object IO.FileInfo($archive)).Length;Seconds=$timer.Elapsed.TotalSeconds}|ConvertTo-Json -Compress
    """.replace('ARCHIVE', psquote(archive))
    try:
        downloaded = powershell(download_script, timeout=240)
        check('remote Windows archive hash', downloaded['Sha256'] == '40b974b3b093b3fe4976ca66091f62a466b36303440fbf81a578f0bce05c2b6a')
        report['download'] = downloaded
        print('Remote download bytes/sec:', int(downloaded['Bytes'] / max(downloaded['Seconds'], .01)), flush=True)
        slow = downloaded['Bytes'] / max(downloaded['Seconds'], .01) < 819200
    except Exception as exc:
        print('Switching package source to repository SFTP transfer:', str(exc)[:160], flush=True)
        slow = True
    if slow:
        assembled = TMP / 'windows.zip'
        with assembled.open('wb') as output:
            for part in sorted((ROOT / 'deliverables').glob('windows.part*')):
                output.write(part.read_bytes())
        run(['scp', '-F', '/dev/null', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
             '-o', 'UserKnownHostsFile=' + str(TMP / 'clipboard-known-hosts'), '-o', 'HostKeyAlias=' + HOST,
             '-i', str(KEY), '-P', str(ENDPOINT_PORT), str(assembled), USER + '@127.0.0.1:' + archive.replace('\\', '/')], timeout=600)
        digest = powershell("$h=[Security.Cryptography.SHA256]::Create();$f=[IO.File]::OpenRead("+psquote(archive)+");try{[BitConverter]::ToString($h.ComputeHash($f)).Replace('-','').ToLowerInvariant()|ConvertTo-Json}finally{$f.Dispose();$h.Dispose()}")
        check('SFTP archive hash', digest == '40b974b3b093b3fe4976ca66091f62a466b36303440fbf81a578f0bce05c2b6a')

    powershell("[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')|Out-Null;[IO.Compression.ZipFile]::ExtractToDirectory("+psquote(archive)+','+psquote(release)+");$true|ConvertTo-Json", timeout=180)
    exe = release + '\\clipboard-windows-x64\\Clipboard.exe'
    report['executable'] = exe
    task = 'ClipboardLocalValidation-' + suffix

    def launch(arguments):
        # InteractiveToken: use the authorized user's actual desktop, never SYSTEM.
        code = r"""
        $svc=New-Object -ComObject 'Schedule.Service';$svc.Connect();$folder=$svc.GetFolder('\');$def=$svc.NewTask(0)
        $def.RegistrationInfo.Description='Authorized Clipboard Local desktop validation'
        $def.Principal.UserId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $def.Principal.LogonType=3;$def.Principal.RunLevel=0
        $def.Settings.Enabled=$true;$def.Settings.ExecutionTimeLimit='PT0S';$def.Settings.DisallowStartIfOnBatteries=$false;$def.Settings.StopIfGoingOnBatteries=$false
        $a=$def.Actions.Create(0);$a.Path=EXE;$a.Arguments=ARGS;$a.WorkingDirectory=WORK
        $registered=$folder.RegisterTaskDefinition(TASK,$def,6,$def.Principal.UserId,$null,3,$null)
        $registered.Run($null)|Out-Null
        $true|ConvertTo-Json
        """.replace('EXE', psquote(exe)).replace('ARGS', psquote(arguments)).replace('WORK', psquote(release)).replace('TASK', psquote(task))
        try:
            return powershell(code)
        except Exception as exc:
            print('Interactive task unavailable, checking direct user session:', str(exc)[:160], flush=True)
            if identity['Session'] not in identity['ExplorerSessions']:
                raise RuntimeError('Cannot launch visibly in authorized desktop session') from exc
            return powershell("Start-Process -FilePath "+psquote(exe)+" -ArgumentList "+psquote(arguments)+";$true|ConvertTo-Json")

    launch('--test-mode --show-manager --data-dir="' + profile + '"')
    endpoint = profile + '\\test-endpoint.json'
    for _ in range(60):
        if powershell('[IO.File]::Exists('+psquote(endpoint)+')|ConvertTo-Json'):
            break
        time.sleep(1)
    else:
        raise RuntimeError('Desktop application did not initialize')

    def bridge(command, args=None):
        payload = json.dumps({'command': command, 'args': args or []}, ensure_ascii=True)
        code = "$payload=[Console]::In.ReadToEnd();$e=[IO.File]::ReadAllText("+psquote(endpoint)+")|ConvertFrom-Json;$h=@{Authorization=('Bearer '+$e.token)}; $r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$e.port) -Method Post -Headers $h -ContentType 'application/json' -Body $payload; $r|ConvertTo-Json -Depth 12 -Compress"
        return powershell(code, input_data=payload.encode('ascii')).get('value')

    info = bridge('info')
    check('both real Windows 10 application windows visible', info['popupVisible'] and info['managerVisible'])
    check('tray and global shortcut registered', info['tray'] and info['shortcut'])
    check('default autostart registered', info['autostart'])
    app_session = powershell("@(Get-Process -Name Clipboard -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq "+psquote(exe)+"} | ForEach-Object {$_.SessionId})|ConvertTo-Json -Compress")
    sessions = app_session if isinstance(app_session, list) else [app_session]
    check('application runs in logged-in desktop session', bool(set(sessions).intersection(identity['ExplorerSessions'])))
    for text in ['继续停留在上次的位置。', 'npm run dev', 'https://github.com/', 'Windows 10 实机运行验证']:
        bridge('capture', [text])
    first = bridge('capture', ['Windows 10 实机运行验证'])
    check('exact deduplication', bridge('list', [{'q': 'Windows 10 实机运行验证'}])['total'] == 1)
    value = '完整文本验证🙂' * 25000
    long = bridge('capture', [value])
    check('long clipboard text persisted', bridge('get', [long['id']])['content'] == value)
    for enabled, dx in [(False, -40), (True, 40)]:
        js = "(()=>{const b=document.getElementById('autostart');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,clientX:60,bubbles:true}));b.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:"+str(60+dx)+",bubbles:true}));return true;})()"
        bridge('eval', ['manager', js]);time.sleep(.3)
        check('slide autostart '+str(enabled), bridge('info')['autostart'] == enabled)
    bridge('eval', ['manager', "(()=>{const s=document.getElementById('search');s.value='Windows 10';s.dispatchEvent(new Event('input',{bubbles:true}));return true;})()"])
    time.sleep(.4)
    check('UI search on real Windows 10', bridge('eval', ['manager', "document.querySelectorAll('.row').length===1"]))
    for i in range(90):
        bridge('capture', ['位置恢复验证 '+str(i)])
    bridge('eval', ['popup', "document.getElementById('list').scrollTop=3500"]);time.sleep(.6)
    state = bridge('setting', ['ui-popup'])
    check('scroll position saved', bool(state and state.get('anchor')))
    bridge('capture', ['后台新增保持浏览位置']);time.sleep(.5)
    check('new records preserve scroll anchor', bridge('setting', ['ui-popup'])['anchor'] == state['anchor'])
    bridge('eval', ['manager', "(()=>{const s=document.getElementById('search');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));return true;})()"])
    for text in ['继续停留在上次的位置。', 'npm run dev', 'https://github.com/', 'Windows 10 实机运行验证']:
        bridge('capture', [text])
    bridge('eval', ['popup', "document.getElementById('latest').click()"]);time.sleep(.5)
    for kind in ['popup', 'manager']:
        screenshot = dev + '\\' + kind + '.png'
        bridge('screenshot', [kind, screenshot]);get_file(screenshot, OUT / ('win10-'+kind+'.png'))
        check(kind+' real Windows 10 screenshot retrieved', (OUT / ('win10-'+kind+'.png')).stat().st_size > 1000)
    # Shut down the isolated validation instance, then launch normal collection.
    bridge('quit');time.sleep(2)
    launch('--show-manager')
    time.sleep(3)
    normal = powershell("@(Get-Process -Name Clipboard -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq "+psquote(exe)+"} | Select-Object Id,SessionId,MainWindowHandle)|ConvertTo-Json -Compress")
    check('normal project process remains running', bool(normal))
    report['normal_processes'] = normal
    report['count'] = len(report['passed'])
    report['status'] = 'passed'
    print('Real Windows 10 deployment and screenshots completed', flush=True)
except Exception as exc:
    report['status'] = 'failed'
    report['error'] = str(exc)
    raise
finally:
    (OUT / 'win10-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    if proxy and proxy.poll() is None:
        proxy.terminate()
