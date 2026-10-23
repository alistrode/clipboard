// Directory packaging: no bundler, no native compilation, no compression.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const platform=process.env.CLIPBOARD_TARGET||process.platform;
let runtime=process.env.CLIPBOARD_RUNTIME;
if(!runtime){try{runtime=path.dirname(require('electron'));}catch{throw Error('请执行 npm ci 或设置 CLIPBOARD_RUNTIME 为完整 Electron 运行时目录');}}
const out=path.resolve(root,'../release',`clipboard-${platform}-x64`);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});fs.cpSync(runtime,out,{recursive:true});
const app=path.join(out,'resources','app');fs.rmSync(path.join(out,'resources','default_app.asar'),{force:true});fs.mkdirSync(app,{recursive:true});
for(const f of ['src','package.json','LICENSE','README.md','THIRD-PARTY.md','VALIDATION.md'])fs.cpSync(path.join(root,f),path.join(app,f),{recursive:true});
if(platform==='win32'){
  fs.renameSync(path.join(out,'electron.exe'),path.join(out,'Clipboard.exe'));
  fs.writeFileSync(path.join(out,'Start.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0Clipboard.exe" %*\r\n');
}else{
  fs.renameSync(path.join(out,'electron'),path.join(out,'clipboard'));
  fs.chmodSync(path.join(out,'clipboard'),0o755);fs.chmodSync(path.join(out,'chrome_crashpad_handler'),0o755);
  fs.writeFileSync(path.join(out,'start.sh'),'#!/bin/sh\nset -eu\nSCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$SCRIPT_DIR/clipboard" "$@"\n',{mode:0o755});
}
const lines=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory())walk(f);else if(item.name!=='SHA256SUMS')lines.push(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')+'  '+path.relative(out,f).split(path.sep).join('/'));}}walk(out);fs.writeFileSync(path.join(out,'SHA256SUMS'),lines.join('\n')+'\n');
console.log(out);
