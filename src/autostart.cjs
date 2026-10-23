const fs=require('node:fs');const path=require('node:path');
function createAutostart({app,executable,args=[],configHome}) {
  const file=path.join(configHome,'autostart','clipboard-local.desktop');
  const quote=s=>'"'+s.replace(/[\\"`$]/g,'\\$&')+'"';
  return {
    get(){if(process.platform==='win32')return app.getLoginItemSettings({path:executable,args}).openAtLogin;if(process.platform==='linux')return fs.existsSync(file)&&!/^Hidden=true$/m.test(fs.readFileSync(file,'utf8'));return false;},
    set(enabled){
      if(process.platform==='win32'){
        app.setLoginItemSettings({openAtLogin:enabled,path:executable,args});
        const actual=app.getLoginItemSettings({path:executable,args}).openAtLogin;
        if(actual!==enabled)throw new Error('系统未接受开机自启设置');return actual;
      }
      if(process.platform==='linux'){
        if(enabled){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,`[Desktop Entry]\nType=Application\nName=Clipboard Local\nComment=Local clipboard history\nExec=${[executable,...args].map(quote).join(' ')}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`,{mode:0o600});fs.renameSync(temp,file);}
        else fs.rmSync(file,{force:true});
        return this.get();
      }
      throw new Error('当前平台尚不支持开机自启');
    }
  };
}
module.exports={createAutostart};
