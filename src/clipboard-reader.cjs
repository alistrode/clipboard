'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');

// Clipboard providers can perform delayed rendering in another application.
// Keep those waits outside Electron's UI thread so hotkeys remain responsive.
function createClipboardReader({spawnChild=spawn,timeoutMs=6000,startupTimeoutMs=30000,retryDelayMs=1000,now=()=>performance.now()}={}){
  let child=null,pending=null,serial=0,buffer='',stopped=false,retryAt=0,ready=false;
  const unavailable=()=>Error('系统剪贴板暂时未响应，正在重试');
  function discard(c,error){
    if(child!==c)return;
    child=null;buffer='';retryAt=now()+retryDelayMs;
    const request=pending;pending=null;
    if(request){clearTimeout(request.timer);request.reject(error);}
    try{c.stdin.destroy();}catch{}
    try{c.kill();}catch{}
  }
  function start(){
    if(child)return child;
    const script=fs.readFileSync(path.join(__dirname,'clipboard-reader.ps1'),'utf8');
    const c=spawnChild('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    child=c;buffer='';ready=false;c.stdout.setEncoding('utf8');
    c.stdout.on('data',chunk=>{
      if(child!==c)return;
      buffer+=chunk;let end;
      while((end=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let result;
        try{result=JSON.parse(line);}catch{continue;}
        if(result.ready===true){
          if(!ready){ready=true;if(pending){clearTimeout(pending.timer);pending.timer=setTimeout(()=>discard(c,unavailable()),timeoutMs);}}
          continue;
        }
        if(!pending||result.id!==pending.id)continue;
        const request=pending;pending=null;clearTimeout(request.timer);
        if(result.ok&&typeof result.text==='string')request.resolve(result.text);
        else request.reject(unavailable());
      }
    });
    // Always drain stderr, including provider and PowerShell startup failures.
    c.stderr.on('data',()=>{});
    c.stdin.on('error',()=>discard(c,unavailable()));
    c.on('error',()=>discard(c,unavailable()));
    c.on('exit',()=>discard(c,unavailable()));
    return c;
  }
  return {
    read(){
      if(stopped||now()<retryAt)return Promise.reject(unavailable());
      if(pending)return pending.promise;
      let c;try{c=start();}catch{return Promise.reject(unavailable());}
      const id=++serial;let resolve,reject;
      const promise=new Promise((r,j)=>{resolve=r;reject=j;});
      const timer=setTimeout(()=>discard(c,unavailable()),ready?timeoutMs:startupTimeoutMs);
      pending={id,promise,resolve,reject,timer};
      try{c.stdin.write(JSON.stringify({id})+'\n');}catch{discard(c,unavailable());}
      return promise;
    },
    stop(){stopped=true;if(child)discard(child,unavailable());},
  };
}
module.exports={createClipboardReader};
