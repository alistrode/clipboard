const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {alive,read,write}=require('./recovery-worker.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function recovery({app,enabled,args,platform=process.platform,runtimeMode='gui'}){
  let config,file,child,monitor,starting=false,stopped=false,acknowledged=false;
  const root=app.getPath('userData');
  // Only accept a handoff created inside this application's profile.
  function inherited(name){const value=process.env[name];return value&&path.dirname(value)===root&&/^recovery-[a-f0-9-]+\.(?:stop|handoff)$/.test(path.basename(value))?value:null;}
  const inheritedStop=inherited('CLIPBOARD_RECOVERY_STOP_FILE'),handoff=inherited('CLIPBOARD_RECOVERY_HANDOFF');
  async function launch(){
    if(starting||stopped)return;
    starting=true;
    try{
      fs.rmSync(config.ready,{force:true});
      const fd=fs.openSync(path.join(root,'recovery-worker.log'),'a',0o600);
      try{child=spawn(process.execPath,[path.join(__dirname,'recovery-worker.cjs'),'--config',file],{detached:true,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});}
      finally{fs.closeSync(fd);}
      await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
      child.unref();
      for(let n=0;n<100;n++){
        if(stopped)return;
        const state=read(config.ready);
        if(state?.pid===child.pid&&state.parent===process.pid&&alive(child.pid)){if(handoff&&!acknowledged){write(handoff,{pid:process.pid,ready:true});acknowledged=true;}return;}
        if(!alive(child.pid))throw Error('自带恢复守护进程提前退出');
        await delay(100);
      }
      try{child.kill();}catch{}
      throw Error('自带恢复守护进程启动超时');
    }finally{starting=false;}
  }
  return {
    async start(){
      if(!enabled||platform!=='win32')return;
      fs.mkdirSync(root,{recursive:true});
      const id=crypto.randomUUID(),base=path.join(root,'recovery-'+id);
      file=base+'.json';config={parent:process.pid,executable:process.execPath,args,runtimeMode,stop:base+'.stop',ready:base+'.ready',handoff:base+'.handoff'};
      write(file,config);
      // Also retry startup failures while the application is alive.
      monitor=setInterval(()=>{if(!starting&&!stopped&&!alive(child?.pid))launch().catch(e=>{try{fs.appendFileSync(path.join(root,'recovery-worker.log'),new Date().toISOString()+' '+e.message+'\n');}catch{}});},2000);
      monitor.unref();
      await launch();
    },
    stop(){stopped=true;clearInterval(monitor);for(const target of [config?.stop,inheritedStop])if(target&&(target===config?.stop||fs.existsSync(target.replace(/\.stop$/,'.json'))))fs.writeFileSync(target,'intentional-exit',{mode:0o600});},
    info(){if(!config)return null;const state=read(config.ready);return {parent:process.pid,pid:child?.pid,ready:!!(state?.ready&&alive(state.pid)),method:'bundled-worker'};}
  };
}
module.exports={recovery};
