const {app,BrowserWindow,ipcMain,clipboard,Tray,Menu,nativeImage,globalShortcut,screen,dialog}=require('electron');
const {Worker}=require('node:worker_threads');
const path=require('node:path');const fs=require('node:fs');const os=require('node:os');
const {createAutostart}=require('./autostart.cjs');
const testing=process.argv.includes('--test-mode');
const dataArg=process.argv.find(a=>a.startsWith('--data-dir='));
if(dataArg)app.setPath('userData',dataArg.slice(11));
app.setName('Clipboard Local');
if(process.platform==='linux')app.commandLine.appendSwitch('enable-features','GlobalShortcutsPortal');
let popup,manager,tray,quitting=false,worker,ready,autostart,timer,lastObserved=null,lastGeneration=0;
let fault='';const pending=new Map();let serial=0;let clipboardListener,reading=false,readAgain=false,forceAgain=false,ownCopyValue=null;
let shortcutRecorder=null;
async function finishShortcutRecording(sender){if(shortcutRecorder!==sender)return;shortcutRecorder=null;const value=await db('setting','shortcut')||'CommandOrControl+Shift+V';if(!quitting&&!globalShortcut.isRegistered(value)&&!globalShortcut.register(value,showPopup))reportError(new Error('系统未能恢复快捷键：'+value));}
const lock=app.requestSingleInstanceLock();if(!lock){app.quit();}else{
app.on('second-instance',()=>showPopup());
app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{quitting=true;clearTimeout(timer);if(clipboardListener)clipboardListener.kill();globalShortcut.unregisterAll();});
app.whenReady().then(start).catch(e=>{dialog.showErrorBox('剪贴板启动失败',e.message);app.exit(1);});
}
function db(method,...args){return ready.then(()=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,method,args});}));}
function broadcast(type,value){for(const w of [popup,manager])if(w&&!w.isDestroyed())w.webContents.send(type,value);}
function reportError(e){fault=e.message||String(e);broadcast('status',{error:fault});if(tray)tray.setToolTip('剪贴板 · 保存失败：'+fault);}
async function start(){
  worker=new Worker(path.join(__dirname,'db-worker.cjs'),{workerData:{file:path.join(app.getPath('userData'),'history.sqlite')}});
  ready=new Promise((resolve,reject)=>{worker.on('message',m=>{if(m.ready)return resolve();if(m.fatal)return reject(new Error(m.fatal));const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.value);}});worker.on('error',reject);});
  await ready;
  worker.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();reportError(e);});
  const appArgs=app.isPackaged?['--background']:[app.getAppPath(),'--background'];
  if(process.argv.includes('--no-sandbox'))appArgs.unshift('--no-sandbox');
  autostart=createAutostart({app,executable:process.execPath,args:appArgs,configHome:process.env.CLIPBOARD_CONFIG_HOME||process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config')});
  if(await db('setting','initialized')!==true){try{autostart.set(true);await db('setting','initialized',true);}catch(e){reportError(e);}}
  installIPC();
  let shortcut=await db('setting','shortcut')||'CommandOrControl+Shift+V';
  if(!globalShortcut.register(shortcut,showPopup))reportError(new Error('快捷键被占用，请在管理窗口修改'));
  createTray();
  if(!process.argv.includes('--background'))await showPopup();
  if(process.argv.includes('--show-manager'))await showManager();
  if(!testing){poll();if(process.platform==='win32')startWindowsListener();}
  if(testing)startTestBridge();
}
function createTray(){
  // A transparent PNG is generated locally, independent of platform fonts.
  const pixels=Buffer.alloc(24*24*4);for(let y=3;y<22;y++)for(let x=5;x<20;x++){if(x===5||x===19||y===3||y===21||(y===9||y===13||y===17)&&x>8&&x<17){const i=(y*24+x)*4;pixels[i]=40;pixels[i+1]=40;pixels[i+2]=40;pixels[i+3]=255;}}
  const icon=nativeImage.createFromBitmap(pixels,{width:24,height:24,scaleFactor:1});
  tray=new Tray(icon);tray.setToolTip('剪贴板 · 正在记录');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'打开剪贴板',click:showPopup},{label:'管理',click:showManager},{type:'separator'},{label:'退出',click:()=>app.quit()}]));
  tray.on('click',showPopup);
}
async function makeWindow(kind){
  const isPopup=kind==='popup';
  const size=isPopup?{width:340,height:520}:{width:700,height:660};
  const saved=await db('setting','bounds-'+kind);
  let pos={};if(saved){const ds=screen.getAllDisplays();if(ds.some(d=>saved.x>=d.workArea.x-100&&saved.x<d.workArea.x+d.workArea.width-50&&saved.y>=d.workArea.y&&saved.y<d.workArea.y+d.workArea.height-50))pos={x:saved.x,y:saved.y};}
  const w=new BrowserWindow({...size,...pos,minWidth:isPopup?300:560,minHeight:isPopup?400:480,frame:false,show:false,resizable:!isPopup,alwaysOnTop:isPopup,skipTaskbar:isPopup,backgroundColor:'#ffffff',title:isPopup?'剪贴板':'剪贴板管理',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  w.setMenuBarVisibility(false);
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  w.webContents.on('will-navigate',e=>e.preventDefault());
  w.on('close',e=>{if(!quitting){e.preventDefault();w.hide();}});
  w.on('hide',()=>finishShortcutRecording(w.webContents.id).catch(reportError));
  let boundsTimer;w.on('move',()=>{clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>db('setting','bounds-'+kind,w.getBounds()).catch(reportError),150);});
  if(isPopup)w.on('blur',()=>{if(!testing&&!w.webContents.isDevToolsOpened())w.hide();});
  await w.loadFile(path.join(__dirname,'ui','index.html'),{query:{view:kind}});
  return w;
}
async function showPopup(){try{if(!popup||popup.isDestroyed())popup=await makeWindow('popup');popup.show();popup.focus();popup.webContents.send('shown');}catch(e){reportError(e);}}
async function showManager(){try{if(!manager||manager.isDestroyed())manager=await makeWindow('manager');manager.show();manager.focus();manager.webContents.send('shown');}catch(e){reportError(e);}}
function installIPC(){
  const allowed=new Set(['list','get','locate']);
  ipcMain.handle('db',(_e,method,...args)=>{if(!allowed.has(method))throw Error('不支持的操作');return db(method,...args);});
  ipcMain.handle('state',(_e,kind,value)=>{if(!['popup','manager'].includes(kind))throw Error('未知窗口');return db('setting','ui-'+kind,value);});
  ipcMain.handle('settings',async()=>({autostart:autostart.get(),shortcut:await db('setting','shortcut')||'CommandOrControl+Shift+V',error:fault,wayland:process.env.XDG_SESSION_TYPE==='wayland'}));
  ipcMain.handle('autostart',async(_e,enabled)=>{if(typeof enabled!=='boolean')throw Error('无效设置');const actual=autostart.set(enabled);await db('setting','autostart',actual);return actual;});
  ipcMain.handle('shortcut-recording',async(e,active)=>{if(active){shortcutRecorder=e.sender.id;const old=await db('setting','shortcut')||'CommandOrControl+Shift+V';globalShortcut.unregister(old);}else await finishShortcutRecording(e.sender.id);return true;});
  ipcMain.handle('shortcut',async(_e,value)=>{
    if(typeof value!=='string'||!value||value.length>100)throw Error('无法识别该按键');
    const old=await db('setting','shortcut')||'CommandOrControl+Shift+V';
    if(old===value&&!shortcutRecorder)return value;
    try{if(!globalShortcut.register(value,showPopup))throw Error('系统拒绝注册：'+value+'，可能已被系统或其他程序占用');}
    catch(e){throw Error('未能保存 '+value+'：'+e.message+'。原快捷键已保留。');}
    try{await db('setting','shortcut',value);}catch(e){globalShortcut.unregister(value);throw e;}
    if(old!==value)globalShortcut.unregister(old);
    if(shortcutRecorder)globalShortcut.unregister(value);
    fault='';return value;
  });
  ipcMain.handle('copy',async(_e,id)=>{const row=await db('get',id);if(!row)throw Error('记录已删除');ownCopyValue=row.content;await clipboard.writeText(row.content);lastObserved=row.content;lastGeneration++;if(popup&&_e.sender===popup.webContents)popup.hide();return true;});
  ipcMain.handle('remove',async(_e,ids)=>{if(!Array.isArray(ids)||ids.some(id=>!Number.isSafeInteger(id)))throw Error('无效记录');await db('remove',ids);broadcast('changed');return true;});
  ipcMain.handle('action',(e,action)=>{const w=BrowserWindow.fromWebContents(e.sender);if(action==='hide')w.hide();if(action==='minimize')w.minimize();if(action==='maximize'){w.isMaximized()?w.unmaximize():w.maximize();}if(action==='manager')showManager();return true;});
  ipcMain.on('menu',(e,id)=>{const w=BrowserWindow.fromWebContents(e.sender);Menu.buildFromTemplate([{label:'复制',click:async()=>{const row=await db('get',id);if(row){ownCopyValue=row.content;await clipboard.writeText(row.content);lastObserved=row.content;} }},{label:'查看完整内容',click:()=>e.sender.send('detail',id)},{label:'删除',click:async()=>{await db('remove',[id]);broadcast('changed');}},{type:'separator'},{label:'管理',click:showManager}]).popup({window:w});});
}
async function captureClipboard(force=false){
  if(reading){readAgain=true;forceAgain=forceAgain||force;return;}
  reading=true;
  try {
    const value=await clipboard.readText();
    if(force&&ownCopyValue===value){ownCopyValue=null;lastObserved=value;}
    else if(force||value!==lastObserved){
      const generation=lastGeneration;const result=await db('capture',value);
      if(generation===lastGeneration)lastObserved=value;
      if(result){fault='';broadcast('changed');broadcast('status',{error:''});if(tray)tray.setToolTip('剪贴板 · 正在记录');}
    }
  }catch(e){reportError(e);}finally{reading=false;}
  if(readAgain&&!quitting){readAgain=false;const force=forceAgain;forceAgain=false;await captureClipboard(force);}
}
async function poll(){
  await captureClipboard();
  if(!quitting)timer=setTimeout(poll,650);
}
function startWindowsListener(){
  const {spawn}=require('node:child_process');
  const script=fs.readFileSync(path.join(__dirname,'clipboard-listener.ps1'),'utf8');
  clipboardListener=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  clipboardListener.stdout.on('data',()=>captureClipboard(true));
  clipboardListener.on('error',()=>reportError(new Error('剪贴板通知监听未启动，正在使用定时读取')));
  clipboardListener.on('exit',()=>{if(!quitting)reportError(new Error('剪贴板通知监听已退出，正在使用定时读取'));});
}
function startTestBridge(){
  // Explicit opt-in only: loopback + random bearer token, never enabled in normal use.
  const http=require('node:http');const token=require('node:crypto').randomBytes(24).toString('hex');
  const server=http.createServer(async(req,res)=>{
    if(req.headers.authorization!=='Bearer '+token){res.writeHead(403);return res.end();}
    let body='';for await(const chunk of req)body+=chunk;
    try{const {command,args=[]}=JSON.parse(body);let value;
      if(command==='capture'){value=await db('capture',args[0]);broadcast('changed');}
      else if(command==='clipboard'){await clipboard.writeText(args[0]);lastObserved=null;await poll();value=true;clearTimeout(timer);}
      else if(command==='readClipboard')value=await clipboard.readText();
      else if(command==='show'){await showPopup();await showManager();value=true;}
      else if(command==='eval'){const w=args[0]==='popup'?popup:manager;value=await w.webContents.executeJavaScript(args[1]);}
      else if(command==='screenshot'){const w=args[0]==='popup'?popup:manager;const img=await w.webContents.capturePage();fs.writeFileSync(args[1],img.toPNG());value=true;}
      else if(command==='arrange'){popup.setPosition(80,110);manager.setPosition(530,110);value=true;}
      else if(command==='quit'){value=true;setTimeout(()=>app.quit(),100);}
      else if(['list','get','setting','locate'].includes(command))value=await db(command,...args);
      else if(command==='info')value={version:process.versions,autostart:autostart.get(),data:app.getPath('userData'),tray:!!tray,trayBounds:tray?.getBounds(),popupVisible:popup?.isVisible(),managerVisible:manager?.isVisible(),shortcut:globalShortcut.isRegistered('CommandOrControl+Shift+V')};
      else throw Error('Unknown command');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({value}));
    }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
  });
  server.listen(0,'127.0.0.1',()=>{fs.writeFileSync(path.join(app.getPath('userData'),'test-endpoint.json'),JSON.stringify({port:server.address().port,token}),{mode:0o600});});
  app.on('will-quit',()=>server.close());
}
