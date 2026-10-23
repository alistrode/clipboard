const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
let executable=process.env.CLIPBOARD_ELECTRON;
if(!executable){try{executable=require('electron');}catch{console.error('请先执行 npm ci，或设置 CLIPBOARD_ELECTRON 指向 Electron 可执行文件。');process.exit(1);}}
if(!fs.existsSync(executable)){console.error('Electron 运行时不存在：'+executable);process.exit(1);}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,[root,...process.argv.slice(2)],{stdio:'inherit',env});child.on('exit',code=>process.exit(code??1));child.on('error',e=>{console.error(e.message);process.exit(1);});
