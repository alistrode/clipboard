const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
function recovery({app,enabled,args}){
  let config;
  return {
    async start(){
      if(!enabled||process.platform!=='win32')return;
      const root=app.getPath('userData'),id=crypto.randomUUID();
      fs.mkdirSync(root,{recursive:true});
      config={parent:process.pid,executable:process.execPath,args,stop:path.join(root,'recovery-'+id+'.stop'),ready:path.join(root,'recovery-'+id+'.ready'),task:'ClipboardLocalRecovery-'+crypto.createHash('sha256').update(root).digest('hex').slice(0,12)};
      const file=path.join(root,'recovery-'+id+'.json');fs.writeFileSync(file,JSON.stringify(config));
      const q=s=>"'"+s.replace(/'/g,"''")+"'";
      const ps=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
      const script=path.join(__dirname,'recovery.ps1');
      const arguments_='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+script+'" -Config "'+file+'"';
      const code="$ErrorActionPreference='Stop';$s=New-Object -ComObject Schedule.Service;$s.Connect();$d=$s.NewTask(0);$d.Principal.UserId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$d.Principal.LogonType=3;$d.Principal.RunLevel=0;$d.Settings.ExecutionTimeLimit='PT0S';$d.Settings.MultipleInstances=0;$d.Settings.DisallowStartIfOnBatteries=$false;$d.Settings.StopIfGoingOnBatteries=$false;$d.Settings.RestartCount=3;$d.Settings.RestartInterval='PT1M';$a=$d.Actions.Create(0);$a.Path="+q(ps)+";$a.Arguments="+q(arguments_)+";$t=$s.GetFolder('\\').RegisterTaskDefinition("+q(config.task)+",$d,6,$d.Principal.UserId,$null,3,$null);$t.Run($null)|Out-Null";
      await new Promise((resolve,reject)=>execFile(ps,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,timeout:30000},e=>e?reject(e):resolve()));
    },
    stop(){if(config)fs.writeFileSync(config.stop,'tray-exit');},
    info(){if(!config)return null;try{return {...JSON.parse(fs.readFileSync(config.ready,'utf8')),task:config.task};}catch{return {parent:config.parent,ready:false,task:config.task};}}
  };
}
module.exports={recovery};
