'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function alive(pid){if(!Number.isInteger(pid)||pid<1)return false;try{process.kill(pid,0);if(process.platform==='linux'){const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');if(stat.slice(stat.lastIndexOf(')')+2).startsWith('Z '))return false;}return true;}catch(e){return e.code==='EPERM';}}
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function write(file,value){const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600});fs.renameSync(tmp,file);}
async function run(file){
  const c=read(file);if(!c||!Number.isInteger(c.parent)||!path.isAbsolute(c.executable)||!Array.isArray(c.args))throw Error('Invalid recovery configuration');
  const root=path.dirname(file);
  for(const key of ['stop','ready','handoff'])if(typeof c[key]!=='string'||path.dirname(c[key])!==root)throw Error('Recovery files must remain in the application profile');
  const stopped=()=>fs.existsSync(c.stop);
  const log=message=>{try{const f=path.join(root,'recovery-worker.log');if(fs.existsSync(f)&&fs.statSync(f).size>1048576)fs.renameSync(f,f+'.previous');fs.appendFileSync(f,new Date().toISOString()+' '+message+'\n');}catch{}};
  const cleanup=()=>{for(const f of [file,c.ready,c.handoff,c.stop])try{fs.rmSync(f,{force:true});}catch{}};
  write(c.ready,{pid:process.pid,parent:c.parent,ready:true});log('watching '+c.parent);
  while(alive(c.parent)){if(stopped()){cleanup();return;}await delay(500);}
  let backoff=1000;
  while(!stopped()){
    // Allow the old application's processes and single-instance lock to close.
    await delay(backoff);if(stopped())break;
    fs.rmSync(c.handoff,{force:true});
    const env={...process.env,CLIPBOARD_RECOVERY_HANDOFF:c.handoff,CLIPBOARD_RECOVERY_STOP_FILE:c.stop};
    if(c.runtimeMode==='node')env.ELECTRON_RUN_AS_NODE='1';else delete env.ELECTRON_RUN_AS_NODE;
    const fd=fs.openSync(path.join(root,'recovery-worker.log'),'a',0o600);
    let child;
    try{
      child=spawn(c.executable,c.args,{env,detached:true,windowsHide:true,stdio:['ignore',fd,fd]});
      await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
      child.unref();log('restarting '+c.parent+' as '+child.pid);
    }catch(e){log('restart failed: '+e.message);}finally{fs.closeSync(fd);}
    while(alive(child?.pid)&&!stopped()){
      const next=read(c.handoff);
      if(next?.pid===child.pid&&next.ready){log('handoff confirmed '+child.pid);cleanup();return;}
      await delay(250);
    }
    backoff=Math.min(30000,backoff*2);
  }
  cleanup();
}
module.exports={alive,read,write,run};
if(require.main===module){const at=process.argv.indexOf('--config');if(at<0)throw Error('--config is required');run(path.resolve(process.argv[at+1])).catch(e=>{console.error(e.message);process.exitCode=1;});}
