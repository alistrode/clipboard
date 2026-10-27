"""Refresh existing runtime archives with current app sources, retaining runtime files."""
from pathlib import Path
import hashlib, io, json, tarfile, zipfile, time
ROOT=Path(__file__).resolve().parents[1]
DELIVERY=ROOT/'deliverables'
manifest=json.loads((DELIVERY/'manifest.json').read_text())
app_files={p.relative_to(ROOT).as_posix():p.read_bytes() for p in (ROOT/'src').rglob('*') if p.is_file()}
for name in ['package.json','README.md','LICENSE','THIRD-PARTY.md','VALIDATION.md']:
    app_files[name]=(ROOT/name).read_bytes()
for platform in ['windows','linux']:
    old=manifest[platform]
    chunks=[]
    for part in old['parts']:
        b=(DELIVERY/part['file']).read_bytes()
        assert hashlib.sha256(b).hexdigest()==part['sha256'],part['file']
        chunks.append(b)
    data=b''.join(chunks);del chunks
    assert hashlib.sha256(data).hexdigest()==old['sha256']
    prefix='clipboard-'+('windows' if platform=='windows' else 'linux')+'-x64/'
    app_prefix=prefix+'resources/app/'
    checks={}
    result=io.BytesIO()
    if platform=='windows':
        with zipfile.ZipFile(io.BytesIO(data)) as src,zipfile.ZipFile(result,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as dst:
            for entry in src.infolist():
                name=entry.filename
                if name.startswith(app_prefix) or name==prefix+'SHA256SUMS':continue
                content=src.read(entry)
                dst.writestr(entry,content,compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
                if not entry.is_dir():checks[name[len(prefix):]]=hashlib.sha256(content).hexdigest()
            for name,content in app_files.items():
                dst.writestr(app_prefix+name,content)
                checks['resources/app/'+name]=hashlib.sha256(content).hexdigest()
            dst.writestr(prefix+'SHA256SUMS',''.join(h+'  '+n+'\n' for n,h in sorted(checks.items())))
    else:
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as src,tarfile.open(fileobj=result,mode='w:gz',compresslevel=6) as dst:
            for entry in src:
                name=entry.name.rstrip('/')
                if name.startswith(app_prefix.rstrip('/')) or name==prefix+'SHA256SUMS':continue
                stream=src.extractfile(entry) if entry.isfile() else None
                content=stream.read() if stream else None
                dst.addfile(entry,io.BytesIO(content) if content is not None else None)
                if content is not None:checks[name[len(prefix):]]=hashlib.sha256(content).hexdigest()
            for name,content in app_files.items():
                entry=tarfile.TarInfo(app_prefix+name);entry.size=len(content);entry.mode=0o644;entry.mtime=int(time.time());dst.addfile(entry,io.BytesIO(content))
                checks['resources/app/'+name]=hashlib.sha256(content).hexdigest()
            content=''.join(h+'  '+n+'\n' for n,h in sorted(checks.items())).encode()
            entry=tarfile.TarInfo(prefix+'SHA256SUMS');entry.size=len(content);entry.mode=0o644;dst.addfile(entry,io.BytesIO(content))
    new=result.getvalue();del data
    # Independently reopen the generated archive and compare every application file.
    archive=zipfile.ZipFile(io.BytesIO(new)) if platform=='windows' else tarfile.open(fileobj=io.BytesIO(new),mode='r:gz')
    with archive:
        for name,content in app_files.items():
            actual=archive.read(app_prefix+name) if platform=='windows' else archive.extractfile(app_prefix+name).read()
            assert actual==content,name
    for part in old['parts']:(DELIVERY/part['file']).unlink()
    parts=[]
    for offset in range(0,len(new),33554432):
        block=new[offset:offset+33554432];name=f'{platform}.part{len(parts)+1:03d}';(DELIVERY/name).write_bytes(block)
        parts.append({'file':name,'sha256':hashlib.sha256(block).hexdigest(),'bytes':len(block)})
    sha=hashlib.sha256(new).hexdigest()
    manifest[platform]={**old,'sha256':sha,'bytes':len(new),'parts':parts}
    launcher=ROOT/('scripts/start-windows.ps1' if platform=='windows' else 'Start-Linux.sh')
    text=launcher.read_text();assert old['sha256'] in text;launcher.write_text(text.replace(old['sha256'],sha))
    print(platform,len(new),sha,'app sources verified',len(app_files),flush=True)
(DELIVERY/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
