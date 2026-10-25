const fs=require('node:fs');const path=require('node:path');
function createAutostart({app,executable,args=[],configHome,platform=process.platform}) {
  const file=path.join(configHome,'autostart','clipboard-local.desktop');
  const quote=s=>'"'+s.replace(/[\\"`$]/g,'\\$&')+'"';
  const windowsArgs=args.map(s=>/\s/.test(s)?'\"'+s.replace(/\"/g,'\\\"')+'\"':s);
  function windowsState(){const state=app.getLoginItemSettings({path:executable,args:windowsArgs});return state.openAtLogin && state.executableWillLaunchAtLogin!==false && !(state.launchItems||[]).some(i=>i.name==='ClipboardLocal'&&!i.enabled);}
  return {
    get(){if(platform==='win32')return windowsState();if(platform==='linux')return fs.existsSync(file)&&!/^Hidden=true$/m.test(fs.readFileSync(file,'utf8'));return false;},
    set(enabled){
      if(platform==='win32'){
        // Migrate only legacy entries pointing to this exact executable.
        const old=app.getLoginItemSettings({path:executable,args:windowsArgs});
        for(const item of old.launchItems||[])if(item.scope!=='machine'&&item.name!=='ClipboardLocal'&&String(item.path).toLowerCase()===executable.toLowerCase())app.setLoginItemSettings({name:item.name,openAtLogin:false,path:executable,args:windowsArgs});
        app.setLoginItemSettings({name:'ClipboardLocal',openAtLogin:enabled,enabled,path:executable,args:windowsArgs});
        const actual=windowsState();
        if(actual!==enabled)throw new Error('系统未接受开机自启设置');return actual;
      }
      if(platform==='linux'){
        if(enabled){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,`[Desktop Entry]\nType=Application\nName=Clipboard Local\nComment=Local clipboard history\nExec=${[executable,...args].map(quote).join(' ')}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`,{mode:0o600});fs.renameSync(temp,file);}
        else fs.rmSync(file,{force:true});
        return this.get();
      }
      throw new Error('当前平台尚不支持开机自启');
    }
  };
}
module.exports={createAutostart};
