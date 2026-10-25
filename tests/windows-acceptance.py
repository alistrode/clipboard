"""Runs the exact shipped Windows folder on an actual GitHub Windows runner.
Reports the real OS; Windows Server success does not imply Windows 10 acceptance.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'acceptance'
PROFILE = OUT / 'profile'
OUT.mkdir(exist_ok=True)
passed = []
process = None
listener = None


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    passed.append(name)
    print('PASS', name, flush=True)


def wait_for(fn, seconds=30):
    until = time.monotonic() + seconds
    last = None
    while time.monotonic() < until:
        try:
            value = fn()
            if value:
                return value
        except ChildProcessError:
            raise
        except Exception as exc:
            last = exc
        time.sleep(.15)
    raise RuntimeError(f'Timed out: {last}')


def call(command, *args):
    endpoint = json.loads((PROFILE / 'test-endpoint.json').read_text())
    request = urllib.request.Request(
        'http://127.0.0.1:' + str(endpoint['port']),
        data=json.dumps({'command': command, 'args': args}).encode(),
        headers={'Authorization': 'Bearer ' + endpoint['token'], 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result.get('value')


def evaluate(kind, script):
    return call('eval', kind, script)


try:
    manifest = json.loads((ROOT / 'deliverables/manifest.json').read_text())['windows']
    digest = hashlib.sha256()
    for part in manifest['parts']:
        content = (ROOT / 'deliverables' / part['file']).read_bytes()
        check('part hash ' + part['file'], hashlib.sha256(content).hexdigest() == part['sha256'])
        digest.update(content)
    check('original Windows archive SHA-256', digest.hexdigest() == manifest['sha256'])

    log = (OUT / 'app-stdout.log').open('w', encoding='utf8')
    err = (OUT / 'app-stderr.log').open('w', encoding='utf8')
    process = subprocess.Popen([
        'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', str(ROOT / 'scripts/start-windows.ps1'),
        '--test-mode', '--test-recovery', '--show-manager', '--data-dir=' + str(PROFILE),
    ], cwd=ROOT, stdout=log, stderr=err)
    def launcher_ready():
        if process.poll() not in (None, 0):
            raise ChildProcessError('Windows launcher exited with code ' + str(process.poll()))
        return (PROFILE / 'test-endpoint.json').exists()
    try:
        wait_for(launcher_ready, 90)
    except Exception:
        for stream in [log, err]:
            stream.flush()
        print('Launcher exit code:', process.poll(), flush=True)
        print('Launcher stdout:', (OUT / 'app-stdout.log').read_text(encoding='utf8', errors='replace'), flush=True)
        print('Launcher stderr:', (OUT / 'app-stderr.log').read_text(encoding='utf8', errors='replace'), flush=True)
        raise
    info = call('info')
    (OUT / 'runtime.json').write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding='utf8')
    check('tray object created', info['tray'])
    check('global shortcut registered', info['shortcut'])
    check('first launch registers Windows autostart', info['autostart'])
    guardian=wait_for(lambda: (call('info').get('recovery') or {}).get('ready') and call('info')['recovery'],45)
    old_pid=guardian['parent']
    subprocess.run(['taskkill.exe','/PID',str(old_pid),'/T','/F'],check=True,capture_output=True)
    def recovered():
        value=call('info');guard=value.get('recovery') or {}
        return value if guard.get('parent')!=old_pid and guard.get('ready') else None
    wait_for(recovered,60)
    check('whole app recovers after process tree termination',True)
    call('show')
    wait_for(lambda: evaluate('manager', "document.documentElement.dataset.ready === 'true'"))
    wait_for(lambda: evaluate('popup', "document.documentElement.dataset.ready === 'true'"))
    check('both desktop windows initialized', True)
    old_shortcut = evaluate('manager', "clip.settings().then(s=>s.shortcut)")
    evaluate('manager', "(()=>{const b=document.getElementById('shortcut');b.focus();b.dispatchEvent(new KeyboardEvent('keydown',{key:'Meta',metaKey:true,bubbles:true}));b.dispatchEvent(new KeyboardEvent('keyup',{key:'Meta',bubbles:true}));return true;})()")
    time.sleep(.2)
    check('Win modifier alone is not saved as Super', evaluate('manager', "clip.settings().then(s=>s.shortcut)") == old_shortcut)
    evaluate('manager', "document.getElementById('shortcut').blur()")
    for key, flags, expected in [('a', {}, 'Control'), ('F8', {}, 'F8'), ('F8', {'shiftKey': True}, 'Shift+F8'), ('F8', {'metaKey': True, 'shiftKey': True}, 'Super+Shift+F8')]:
        if key == 'a':
            expected = 'A'
        js = "(()=>{const b=document.getElementById('shortcut');b.focus();return true;})()"
        evaluate('manager', js)
        time.sleep(.15)
        event = json.dumps({'key': key, 'code': 'KeyA' if key == 'a' else 'F8', 'bubbles': True, **flags})
        evaluate('manager', "(()=>{const b=document.getElementById('shortcut');b.dispatchEvent(new KeyboardEvent('keydown',"+event+"));b.dispatchEvent(new KeyboardEvent('keyup',"+event+"));return true;})()")
        wait_for(lambda: evaluate('manager', "clip.settings().then(s=>s.shortcut)") == expected)
        check('unrestricted shortcut UI ' + expected, True)
        evaluate('manager', "document.getElementById('shortcut').blur()")
    evaluate('manager', "clip.shortcut('CommandOrControl+Shift+V')")
    evaluate('manager', "clip.shortcut('Super+V')")
    check('Win+V native takeover service ready', call('info')['winVActive'] and call('info')['keyboardReady'])
    time.sleep(12)  # Cross a hook renewal interval before testing the real key.
    evaluate('popup', "clip.action('hide')")
    subprocess.run(['powershell.exe','-NoProfile','-Command',r'''Add-Type 'using System; using System.Runtime.InteropServices; public class WinVInput { [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra); }'; [WinVInput]::keybd_event(0x5B,0,0,[UIntPtr]::Zero); [WinVInput]::keybd_event(0x56,0,0,[UIntPtr]::Zero); [WinVInput]::keybd_event(0x56,0,2,[UIntPtr]::Zero); [WinVInput]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)'''],check=True)
    wait_for(lambda: call('info')['popupVisible'])
    check('actual Windows Win+V summons our clipboard', True)
    evaluate('manager', "clip.shortcut('CommandOrControl+Shift+V')")

    for value in ['last scroll position', 'npm run dev', 'https://github.com/', 'Windows clipboard text']:
        call('capture', value)
    call('clipboard', 'native clipboard round trip')
    check('native Windows clipboard write/read', call('readClipboard') == 'native clipboard round trip')
    first = call('list', {'q': 'native clipboard round trip'})['rows'][0]['id']
    call('clipboard', 'separator')
    call('clipboard', 'native clipboard round trip')
    check('deduplication and newest ordering', call('list', {'q': 'native clipboard round trip'})['total'] == 1 and call('list', {})['rows'][0]['id'] == first)
    long = '\u957f\u6587\u672c\U0001f642' * 60000
    row = call('capture', long)
    check('long text persisted without truncation', call('get', row['id'])['content'] == long)
    evaluate('manager', "(()=>{const s=document.getElementById('search');s.value='native clipboard';s.dispatchEvent(new Event('input',{bubbles:true}));return true;})()")
    wait_for(lambda: evaluate('manager', "document.querySelectorAll('.row').length === 1"))
    check('UI full text search', True)

    for enabled, dx in [(False, -40), (True, 40)]:
        evaluate('manager', f"(()=>{{const b=document.getElementById('autostart');b.dispatchEvent(new PointerEvent('pointerdown',{{pointerId:1,clientX:60,bubbles:true}}));b.dispatchEvent(new PointerEvent('pointerup',{{pointerId:1,clientX:{60+dx},bubbles:true}}));return true;}})()")
        wait_for(lambda: call('info')['autostart'] == enabled)
        check('Windows autostart registry slide ' + str(enabled), True)

    # Compile and exercise the real Win32 notification helper independently.
    listener_log = OUT / 'listener-stdout.log'
    with listener_log.open('w', encoding='utf8') as output, (OUT / 'listener-stderr.log').open('w', encoding='utf8') as errors:
        listener = subprocess.Popen(['powershell.exe', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', str(ROOT / 'src/clipboard-listener.ps1')], stdout=output, stderr=errors)
        wait_for(lambda: listener_log.exists() and 'READY' in listener_log.read_text(encoding='utf8', errors='replace'), 45)
        call('clipboard', 'Win32 clipboard notification proof')
        wait_for(lambda: 'CHANGED' in listener_log.read_text(encoding='utf8', errors='replace'))
        check('AddClipboardFormatListener receives actual Windows clipboard change', True)

    for i in range(120):
        call('capture', 'scroll entry ' + str(i))
    evaluate('popup', "document.getElementById('list').scrollTop=4000")
    time.sleep(.5)
    before = call('setting', 'ui-popup')
    check('scroll anchor persisted', bool(before and before.get('anchor') and before['scrollTop'] > 3000))
    call('capture', 'new record while scrolled')
    time.sleep(.5)
    after = call('setting', 'ui-popup')
    check('background insertion preserves anchor', after['anchor'] == before['anchor'])

    evaluate('manager', "(()=>{const s=document.getElementById('search');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));return true;})()")
    evaluate('popup', "document.getElementById('latest').click()")
    for value in ['last scroll position', 'npm run dev', 'https://github.com/', 'Windows clipboard text']:
        call('capture', value)
    time.sleep(.5)
    for kind in ['popup', 'manager']:
        call('screenshot', kind, str(OUT / (kind + '.png')))
        check(kind + ' actual screenshot captured', (OUT / (kind + '.png')).stat().st_size > 1000)
    call('trayQuit')
    time.sleep(1)
    # Re-run the same packaged executable and verify persistent database/state.
    (PROFILE / 'test-endpoint.json').unlink(missing_ok=True)
    exe = ROOT / '.runtime/clipboard-windows-x64/Clipboard.exe'
    process = subprocess.Popen([str(exe), '--test-mode', '--test-recovery', '--show-manager', '--data-dir=' + str(PROFILE)], stdout=log, stderr=err)
    wait_for(lambda: (PROFILE / 'test-endpoint.json').exists())
    check('process restart preserves long clipboard text', call('get', row['id'])['content'] == long)
    check('process restart preserves UI state', call('setting', 'ui-popup') is not None)
    call('trayQuit')
    (OUT / 'result.json').write_text(json.dumps({'passed': passed, 'count': len(passed), 'scope': 'GitHub-hosted Windows Server 2022; NOT Windows 10 desktop or reboot verification'}, indent=2), encoding='utf8')
except Exception as exc:
    (OUT / 'failure.json').write_text(json.dumps({'error': str(exc), 'passed': passed}, indent=2), encoding='utf8')
    raise
finally:
    if listener and listener.poll() is None:
        listener.terminate()
    try:
        call('trayQuit')
    except Exception:
        pass
