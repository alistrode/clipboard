const {spawn}=require('node:child_process');
const path=require('node:path');
function createInputTarget(){
  let child,serial=0,buffer='',target=null;const pending=new Map();
  function start(){
    if(child)return;
    child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'input-target.ps1'),'-AppPid',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    child.stdout.on('data',chunk=>{buffer+=chunk.toString();let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{const r=JSON.parse(line),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.ok?p.resolve(r.value):p.reject(Error(r.error));}}catch{}}});
    child.stderr.on('data',()=>{});
    const fail=()=>{child=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('输入目标服务已退出；内容已复制，请手动粘贴'));}pending.clear();};
    child.on('error',fail);child.on('exit',fail);
  }
  function request(method,args={}){
    start();const id=++serial;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('输入目标确认超时；内容已复制，请手动粘贴'));},5000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,...args})+'\n');});
  }
  return {
    warmup(){if(process.platform==='win32')start();},
    async capture(){target=null;if(process.platform!=='win32')return;target=await request('capture');},
    async paste(){if(process.platform!=='win32')throw Error('此平台已复制内容，请返回输入框粘贴');if(!target)throw Error('未找到原输入框；内容已复制，请手动粘贴');const saved=target;target=null;return request('paste',{target:saved});},
    async restore(){if(process.platform==='win32'&&target)return request('restore',{target});},
    async status(){return process.platform==='win32'?request('status'):null;},
    clear(){target=null;},
    stop(){child?.kill();child=null;},
  };
}
module.exports={createInputTarget};
