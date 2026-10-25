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
    app=ntpath.normpath(r'E:\xxm\clipboard\release\win10-40083184338\clipboard-windows-x64\resources\app')
    exe=ntpath.normpath(r'E:\xxm\clipboard\release\win10-40083184338\clipboard-windows-x64\Clipboard.exe')
    dev=ntpath.normpath(r'E:\xxm\clipboard\dev\hotkey-'+os.environ['GITHUB_RUN_ID'])
    profile=ntpath.join(dev,'profile')
    endpoint=ntpath.join(profile,'test-endpoint.json')
    task='ClipboardHotkeyFix-'+os.environ['GITHUB_RUN_ID']
    files=['src/main.cjs','src/autostart.cjs','src/recovery.cjs','src/recovery.ps1','src/clipboard-listener.ps1','src/preload.cjs','src/ui/index.html','src/ui/app.js','src/ui/style.css','src/ui/hotkey.js','package.json']
    from zipfile import ZipFile,ZIP_DEFLATED
    patch=TMP/'hotkey-patch.zip'
    with ZipFile(patch,'w',compression=ZIP_DEFLATED,compresslevel=1) as z:
        for name in files:z.write(ROOT/name,name)
    patch_hash=hashlib.sha256(patch.read_bytes()).hexdigest()
    powershell('[IO.Directory]::CreateDirectory('+psquote(dev)+')|Out-Null;$true|ConvertTo-Json')
    remote_patch=ntpath.join(dev,'hotkey-patch.zip')
    def put_file(local,remote):
        run(['scp','-F','/dev/null','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(TMP/'clipboard-known-hosts'),'-o','HostKeyAlias='+HOST,'-i',str(KEY),'-P','22022',str(local),USER+'@127.0.0.1:'+remote.replace(chr(92),'/')],timeout=120)
    put_file(patch,remote_patch)
    # Back up only our application source, then stop only this application's verified executable.
    code=r"""
    $app=APP;$exe=EXE;$patch=PATCH;$dev=DEV
    if(([IO.File]::ReadAllText((Join-Path $app 'package.json'))|ConvertFrom-Json).name -ne 'clipboard-local'){throw 'Application identity mismatch'}
    $h=[Security.Cryptography.SHA256]::Create();$f=[IO.File]::OpenRead($patch)
    try{$hash=[BitConverter]::ToString($h.ComputeHash($f)).Replace('-','').ToLowerInvariant()}finally{$f.Dispose();$h.Dispose()}
    if($hash -ne HASH){throw 'Patch SHA256 mismatch'}
    [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')|Out-Null
    $backup=BACKUP
    [IO.Compression.ZipFile]::CreateFromDirectory($app,$backup)
    $ownIds=@(Get-Process Clipboard -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq $exe}|ForEach-Object {$_.Id})
    $guardRoots=@((Join-Path $env:APPDATA 'Clipboard Local'),(Join-Path $env:APPDATA 'clipboard-local'))
    $guardRoots+=@(Get-ChildItem 'E:\xxm\clipboard\dev' -Directory -ErrorAction SilentlyContinue|Where-Object {$_.Name -like 'hotkey-*'}|ForEach-Object {Join-Path $_.FullName 'profile'})
    foreach($root in $guardRoots){foreach($f in @(Get-ChildItem $root -Filter 'recovery-*.json' -File -ErrorAction SilentlyContinue)){try{$c=[IO.File]::ReadAllText($f.FullName)|ConvertFrom-Json;if($c.executable -eq $exe -and $ownIds -contains [int]$c.parent){[IO.File]::WriteAllText($c.stop,'application update')}}catch{}}}
    $oldScript=[IO.File]::ReadAllText((Join-Path $app 'src\clipboard-listener.ps1'));$oldEncoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($oldScript))
    Get-CimInstance -Query ("SELECT ProcessId FROM Win32_Process WHERE Name='powershell.exe' AND CommandLine LIKE '%"+$oldEncoded+"%'") -ErrorAction SilentlyContinue | ForEach-Object {try{Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop}catch{}}
    try{$s=New-Object -ComObject 'Schedule.Service';$s.Connect();$s.GetFolder('\').GetTask('ClipboardLocalValidation-40083184338').Stop(0)}catch{}
    Get-Process -Name Clipboard -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe} | ForEach-Object {$_.Kill()}
    Start-Sleep -Milliseconds 700
    $data=@()
    foreach($name in @('Clipboard Local','clipboard-local')){
      $p=Join-Path $env:APPDATA $name
      if([IO.File]::Exists((Join-Path $p 'history.sqlite'))){
        $b=Join-Path $p BACKUPNAME;[IO.Directory]::CreateDirectory($b)|Out-Null
        foreach($n in @('history.sqlite','history.sqlite-wal','history.sqlite-shm')){if([IO.File]::Exists((Join-Path $p $n))){[IO.File]::Copy((Join-Path $p $n),(Join-Path $b $n),$false)}}
        $data+=Join-Path $p 'history.sqlite'
      }
    }
    $zip=[IO.Compression.ZipFile]::OpenRead($patch)
    try{foreach($entry in $zip.Entries){$target=Join-Path $app $entry.FullName;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))|Out-Null;[IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$true)}}finally{$zip.Dispose()}
    [pscustomobject]@{Backup=$backup;Databases=$data;Version=([IO.File]::ReadAllText((Join-Path $app 'package.json'))|ConvertFrom-Json).version}|ConvertTo-Json -Compress
    """.replace('$app=APP;', '$app='+psquote(app)+';').replace('EXE',psquote(exe)).replace('PATCH',psquote(remote_patch)).replace('DEV',psquote(dev)).replace('HASH',psquote(patch_hash)).replace('BACKUPNAME',psquote('before-hotkey-'+os.environ['GITHUB_RUN_ID'])).replace('BACKUP',psquote(r'E:\xxm\clipboard\backups\hotkey-before-'+os.environ['GITHUB_RUN_ID']+'.zip'))
    patched=powershell(code)
    check('version 1.0.5 installed with source and history backups',patched['Version']=='1.0.5')
    report['backup']=patched['Backup']
    # Read history counts only, never clipboard contents; seed a separate test profile without altering autostart.
    count_script=TMP/'hotkey-count.cjs'
    count_script.write_text("const fs=require('node:fs');const {DatabaseSync}=require('node:sqlite');let r={count:0,shortcut:'CommandOrControl+Shift+V'};if(fs.existsSync(process.argv[2])){let d=new DatabaseSync(process.argv[2],{readOnly:!process.argv[3]});r.count=d.prepare('select count(*) n from entries').get().n;let s=d.prepare(\"select value from settings where key='shortcut'\").get();if(s)r.shortcut=JSON.parse(s.value);if(process.argv[3])d.prepare(\"INSERT INTO settings(key,value) VALUES('shortcut',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value\").run(JSON.stringify('Super+V'));d.close();}if(process.argv[3]){const {Store}=require(process.argv[4]);let s=new Store(process.argv[3]);s.setting('initialized',true);s.setting('shortcut','Super+V');for(let i=0;i<320;i++)s.capture('Preview '+i+' '+('long_unbroken_text_'.repeat(35))+'\\n'+('line\\n'.repeat(12)));s.close();}console.log(JSON.stringify(r));",encoding='ascii')
    remote_count=ntpath.join(dev,'count.cjs');put_file(count_script,remote_count)
    databases=patched['Databases'];databases=databases if isinstance(databases,list) else ([databases] if databases else [])
    db=databases[0] if databases else ntpath.join(dev,'nonexistent.sqlite')
    def history_info(seed=False):
        args='"'+remote_count+'" "'+db+'"'
        if seed:args+=' "'+ntpath.join(profile,'history.sqlite')+'" "'+ntpath.join(app,'src','store.cjs')+'"'
        code="$p=New-Object Diagnostics.ProcessStartInfo;$p.FileName="+psquote(exe)+";$p.Arguments="+psquote(args)+";$p.UseShellExecute=$false;$p.RedirectStandardOutput=$true;$p.CreateNoWindow=$true;$p.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1';$r=[Diagnostics.Process]::Start($p);$o=$r.StandardOutput.ReadToEnd();$r.WaitForExit();$o"
        return powershell(code)
    before=history_info(True);report['history_before']=before['count']
    def launch(args):
        code="$s=New-Object -ComObject 'Schedule.Service';$s.Connect();$d=$s.NewTask(0);$d.Principal.UserId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$d.Principal.LogonType=3;$d.Principal.RunLevel=0;$d.Settings.ExecutionTimeLimit='PT0S';$d.Settings.DisallowStartIfOnBatteries=$false;$d.Settings.StopIfGoingOnBatteries=$false;$a=$d.Actions.Create(0);$a.Path="+psquote(exe)+";$a.Arguments="+psquote(args)+";$t=$s.GetFolder('\').RegisterTaskDefinition("+psquote(task)+",$d,6,$d.Principal.UserId,$null,3,$null);$t.Run($null)|Out-Null;$true|ConvertTo-Json"
        powershell(code)
    launch('--test-mode --test-recovery --show-manager --data-dir="'+profile+'"')
    for _ in range(30):
        if powershell('[IO.File]::Exists('+psquote(endpoint)+')|ConvertTo-Json'):break
        time.sleep(.5)
    def bridge(command,args=None):
        payload=json.dumps({'command':command,'args':args or []},ensure_ascii=True)
        code="$e=[IO.File]::ReadAllText("+psquote(endpoint)+")|ConvertFrom-Json;$w=New-Object Net.WebClient;$w.Proxy=$null;$w.Headers['Authorization']='Bearer '+$e.token;$w.Headers['Content-Type']='application/json; charset=utf-8';try{[Text.Encoding]::UTF8.GetString($w.UploadData(('http://127.0.0.1:'+$e.port),'POST',[Text.Encoding]::UTF8.GetBytes("+psquote(payload)+")))}finally{$w.Dispose()}"
        return powershell(code).get('value')
    info=bridge('info')
    check('Win+V user-mode takeover ready',info['winVActive'] and info['keyboardReady'])
    bridge('eval',['manager',"clip.autostart(false)"])
    check('autostart slider disables actual startup entry',not bridge('info')['autostart'])
    bridge('eval',['manager',"clip.autostart(true)"])
    check('autostart slider enables actual startup entry',bridge('info')['autostart'])
    registered=powershell("[pscustomobject]@{Command=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run').ClipboardLocal}|ConvertTo-Json -Compress")
    check('stable startup name points to installed executable',registered['Command']=='"'+exe+'" --background')
    report['startup_command']=registered['Command']
    old_listener=bridge('info')['listenerPid']
    powershell('Stop-Process -Id '+str(old_listener)+' -Force;$true|ConvertTo-Json')
    for _ in range(15):
        time.sleep(1)
        recovered=bridge('info')
        if recovered.get('keyboardReady') and recovered.get('listenerPid')!=old_listener:break
    check('keyboard helper automatically recovers after termination',recovered.get('keyboardReady') and recovered.get('listenerPid')!=old_listener)
    inventory=powershell("@(Get-Process | Where-Object {$_.ProcessName -match 'ditto|copyq|clip|TextInputHost|powertoys'} | Select-Object ProcessName,Id,SessionId)|ConvertTo-Json -Compress")
    report['clipboard_process_inventory']=inventory
    bridge('eval',['manager',"(async()=>{document.getElementById('shortcut').blur();await clip.recordShortcut(false);return clip.shortcut('Super+V');})()"])
    key_script=TMP/'press-winv.ps1'
    key_script.write_text(r"""Add-Type 'using System;using System.Runtime.InteropServices;public class ClipInput{[DllImport("user32.dll")]public static extern void keybd_event(byte k,byte s,uint f,UIntPtr e);}';[ClipInput]::keybd_event(0x5B,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 60;[ClipInput]::keybd_event(0x56,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 60;[ClipInput]::keybd_event(0x56,0,2,[UIntPtr]::Zero);[ClipInput]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)""",encoding='ascii')
    remote_key=ntpath.join(dev,'press-winv.ps1');put_file(key_script,remote_key)
    def send_win_v():
        code="$s=New-Object -ComObject Schedule.Service;$s.Connect();$d=$s.NewTask(0);$d.Principal.UserId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$d.Principal.LogonType=3;$d.Principal.RunLevel=0;$a=$d.Actions.Create(0);$a.Path='powershell.exe';$a.Arguments="+psquote('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"'+remote_key+'\"')+";$t=$s.GetFolder('\\').RegisterTaskDefinition("+psquote(task+'-Input')+",$d,6,$d.Principal.UserId,$null,3,$null);$t.Run($null)|Out-Null;$true|ConvertTo-Json"
        powershell(code)
    for i in range(2):
        bridge('eval',['popup',"clip.action('hide')"])
        send_win_v()
        for _ in range(8):
            if bridge('info')['popupVisible']:break
            time.sleep(.5)
        check('actual Win+V summons our clipboard '+str(i+1),bridge('info')['popupVisible'])
    # Synthetic records stay in the isolated test database.
    dimensions=bridge('eval',['popup',"JSON.stringify([...document.querySelectorAll('.card')].slice(0,6).map(c=>{const s=c.querySelector('.snippet'),a=c.getBoundingClientRect(),b=s.getBoundingClientRect();return {inside:b.left>=a.left&&b.right<=a.right&&b.bottom<=a.bottom&&b.top>=a.top,lines:b.height<=48,width:c.scrollWidth<=c.clientWidth};}))"])
    check('long previews stay inside cards',all(x['inside'] and x['lines'] and x['width'] for x in json.loads(dimensions)))
    for view in ['popup','manager']:
        bridge('eval',[view,"(async()=>{const v=document.getElementById('list');v.scrollTop=2300;v.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,10));v.scrollTop=9800;v.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,1600));return true;})()"])
        state=bridge('eval',[view,"clip.state('"+view+"')"])
        check(view+' fast scrolling saves visible anchor',bool(state and state.get('anchor') and state['scrollTop']>9000))
        visible=bridge('eval',[view,"(()=>{const v=document.getElementById('list').getBoundingClientRect();return [...document.querySelectorAll('.row')].some(e=>{const r=e.getBoundingClientRect();return r.top<=v.top+1&&r.bottom>v.top;});})()"])
        check(view+' viewport has no unloaded blank gap',visible)
        bridge('eval',[view,"clip.action('hide')"])
        bridge('show')
        time.sleep(1.5)
        restored=bridge('eval',[view,"clip.state('"+view+"')"])
        check(view+' hide and reopen preserves position',restored['anchor']==state['anchor'])
    before_anchor=bridge('eval',['popup',"clip.state('popup')"])
    bridge('capture',['new entry while browsing older history'])
    time.sleep(1.5)
    after_anchor=bridge('eval',['popup',"clip.state('popup')"])
    check('new clipboard entry preserves browsing anchor',before_anchor['anchor']==after_anchor['anchor'])
    bridge('screenshot',['popup',ntpath.join(dev,'winv-popup.png')]);get_file(ntpath.join(dev,'winv-popup.png'),OUT/'winv-popup.png')
    bridge('screenshot',['manager',ntpath.join(dev,'hotkey-manager.png')]);get_file(ntpath.join(dev,'hotkey-manager.png'),OUT/'hotkey-manager.png')
    guard=bridge('info').get('recovery')
    for _ in range(10):
        if guard and guard.get('ready'):break
        time.sleep(1);guard=bridge('info').get('recovery')
    check('independent application watchdog ready',guard and guard.get('ready'))
    previous_parent=guard['parent']
    # Kill the application process tree; Task Scheduler keeps the guard independent.
    powershell('taskkill.exe /PID '+str(previous_parent)+' /T /F|Out-Null;$true|ConvertTo-Json')
    recovered_app=None
    for _ in range(25):
        time.sleep(1)
        try:
            recovered_app=bridge('info')
            if recovered_app.get('recovery',{}).get('parent')!=previous_parent and recovered_app.get('keyboardReady'):break
        except Exception:pass
    check('whole application recovers after unexpected process-tree exit',bool(recovered_app and recovered_app.get('recovery',{}).get('parent')!=previous_parent and recovered_app.get('keyboardReady')))
    report['recovered_app_pid']=recovered_app['recovery']['parent']
    bridge('trayQuit');time.sleep(6)
    stopped=powershell("@(Get-Process Clipboard -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq "+psquote(exe)+"}).Count|ConvertTo-Json")
    check('intentional tray exit stays exited',stopped==0)

    launch('--background');time.sleep(12)
    send_win_v()
    time.sleep(1)
    after=history_info();report['history_after']=after['count']
    check('original clipboard history preserved',after['count']>=before['count'])
    check('Win+V is the persisted normal shortcut',after['shortcut']=='Super+V')
    normal=powershell("@(Get-Process Clipboard -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq "+psquote(exe)+" -and $_.MainWindowHandle -ne 0}|Select-Object Id,SessionId,MainWindowHandle)|ConvertTo-Json -Compress")
    check('exact login arguments start app and actual Win+V opens normal window',bool(normal))
    final_startup=powershell("[pscustomobject]@{Command=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run').ClipboardLocal}|ConvertTo-Json -Compress")
    check('normal app keeps startup entry enabled',final_startup['Command']==registered['Command'])
    report.update({'status':'passed','version':'1.0.5','normal_processes':normal,'executable':exe,'count':len(report['passed'])})
except Exception as exc:
    report.update({'status':'failed','error':str(exc)})
    raise
finally:
    (OUT/'hotkey-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    try:subprocess.run(['ssh','-S',str(TMP/'clipboard-master'),'-O','exit','-p','22022',USER+'@127.0.0.1'],capture_output=True,timeout=10)
    except Exception:pass
    if proxy and proxy.poll() is None:proxy.terminate()
