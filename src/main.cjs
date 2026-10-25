const {app,BrowserWindow,ipcMain,clipboard,Tray,Menu,nativeImage,globalShortcut,screen,dialog}=require('electron');
const {Worker}=require('node:worker_threads');
const path=require('node:path');const fs=require('node:fs');const os=require('node:os');
const {createAutostart}=require('./autostart.cjs');
const testing=process.argv.includes('--test-mode');
const dataArg=process.argv.find(a=>a.startsWith('--data-dir='));
if(dataArg)app.setPath('userData',dataArg.slice(11));
app.setName('Clipboard Local');
if(process.platform==='win32')app.setAppUserModelId('ClipboardLocal');
if(process.platform==='linux')app.commandLine.appendSwitch('enable-features','GlobalShortcutsPortal');
let keyboardRestartTimer,keyboardHealthTimer,keyboardLastHeartbeat=0,keyboardFailures=0;
let popup,manager,tray,quitting=false,worker,ready,autostart,timer,lastObserved=null,lastGeneration=0;
let fault='';const pending=new Map();let serial=0;let clipboardListener,reading=false,readAgain=false,forceAgain=false,ownCopyValue=null;
let shortcutRecorder=null;
let winVActive=false,keyboardReady=false,keyboardPromise=null,modeSerial=0,modeAcknowledged=0;const modeWaiters=new Map();
function ownsWinV(value){const p=value.toLowerCase().split('+').sort();return process.platform==='win32'&&p.length===2&&p.includes('v')&&(p.includes('super')||p.includes('meta')||p.includes('win'));}
function registeredShortcut(value){return ownsWinV(value)?winVActive&&keyboardReady:globalShortcut.isRegistered(value);}
function modeFile(){return path.join(app.getPath('userData'),'keyboard-mode.txt');}
function writeKeyboardMode(wait=false){
  if(process.platform!=='win32')return Promise.resolve();
  const sequence=++modeSerial;const file=modeFile();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',`${sequence} ${winVActive?1:0} ${shortcutRecorder!==null?1:0}`);fs.renameSync(file+'.tmp',file);
  if(!wait)return Promise.resolve();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{modeWaiters.delete(sequence);reject(Error('Win+V 接管未得到系统确认'));},4000);modeWaiters.set(sequence,{resolve:()=>{clearTimeout(timer);resolve();},reject});if(modeAcknowledged>=sequence){modeWaiters.delete(sequence);clearTimeout(timer);resolve();}});
}
async function registerShortcut(value){if(!ownsWinV(value))return globalShortcut.register(value,showPopup);winVActive=true;try{await startWindowsListener();await writeKeyboardMode(true);return true;}catch(e){winVActive=false;writeKeyboardMode().catch(reportError);throw e;}}
function unregisterShortcut(value){if(ownsWinV(value)){winVActive=false;writeKeyboardMode().catch(reportError);}else globalShortcut.unregister(value);}
async function finishShortcutRecording(sender){if(shortcutRecorder!==sender)return;shortcutRecorder=null;const value=await db('setting','shortcut')||'CommandOrControl+Shift+V';if(!quitting&&!registeredShortcut(value)&&!await registerShortcut(value))reportError(new Error('系统未能恢复快捷键：'+value));if(!quitting&&process.platform==='win32'&&keyboardPromise)await writeKeyboardMode(true);}
const lock=app.requestSingleInstanceLock();if(!lock){app.quit();}else{
app.on('second-instance',()=>showPopup());
app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{runtimeLog('quit requested');quitting=true;clearTimeout(timer);clearTimeout(keyboardRestartTimer);clearInterval(keyboardHealthTimer);if(clipboardListener)clipboardListener.kill();globalShortcut.unregisterAll();});
app.whenReady().then(start).catch(e=>{dialog.showErrorBox('剪贴板启动失败',e.message);app.exit(1);});
}
function db(method,...args){return ready.then(()=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,method,args});}));}
function broadcast(type,value){for(const w of [popup,manager])if(w&&!w.isDestroyed())w.webContents.send(type,value);}
function runtimeLog(event){try{const file=path.join(app.getPath('userData'),'runtime.log');fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)&&fs.statSync(file).size>1048576)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,new Date().toISOString()+' '+event+'\n');}catch{}}
function reportError(e){runtimeLog('error '+(e.message||String(e)));fault=e.message||String(e);broadcast('status',{error:fault});if(tray)tray.setToolTip('剪贴板 · 保存失败：'+fault);}
async function start(){
  runtimeLog('start version='+app.getVersion()+' pid='+process.pid+' background='+process.argv.includes('--background'));
  worker=new Worker(path.join(__dirname,'db-worker.cjs'),{workerData:{file:path.join(app.getPath('userData'),'history.sqlite')}});
  ready=new Promise((resolve,reject)=>{worker.on('message',m=>{if(m.ready)return resolve();if(m.fatal)return reject(new Error(m.fatal));const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.value);}});worker.on('error',reject);});
  await ready;
  worker.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();reportError(e);});
  const appArgs=app.isPackaged?['--background']:[app.getAppPath(),'--background'];
  if(process.argv.includes('--no-sandbox'))appArgs.unshift('--no-sandbox');
  autostart=createAutostart({app,executable:process.execPath,args:appArgs,configHome:process.env.CLIPBOARD_CONFIG_HOME||process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config')});
  const initialized=await db('setting','initialized')===true;
  if(!testing||!initialized){try{const saved=await db('setting','autostart');const desired=typeof saved==='boolean'?saved:true;autostart.set(desired);await db('setting','autostart',desired);await db('setting','initialized',true);}catch(e){reportError(e);}}
  installIPC();
  let shortcut=await db('setting','shortcut')||'CommandOrControl+Shift+V';
  try{if(!await registerShortcut(shortcut))reportError(new Error('快捷键被占用，请在管理窗口修改'));}catch(e){reportError(e);}
  createTray();
  if(!process.argv.includes('--background'))await showPopup();
  if(process.argv.includes('--show-manager'))await showManager();
  if(!testing){poll();if(process.platform==='win32')startWindowsListener().catch(reportError);}
  if(testing)startTestBridge();
  runtimeLog('ready autostart='+autostart.get()+' winV='+winVActive+' keyboard='+keyboardReady);
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
  ipcMain.handle('shortcut-recording',async(e,active)=>{if(active){shortcutRecorder=e.sender.id;const old=await db('setting','shortcut')||'CommandOrControl+Shift+V';unregisterShortcut(old);if(process.platform==='win32'){await startWindowsListener();await writeKeyboardMode(true);}}else await finishShortcutRecording(e.sender.id);return true;});
  ipcMain.handle('shortcut',async(_e,value)=>{
    if(typeof value!=='string'||!value||value.length>100)throw Error('无法识别该按键');
    const old=await db('setting','shortcut')||'CommandOrControl+Shift+V';
    if(old===value&&!shortcutRecorder)return value;
    try{if(!await registerShortcut(value))throw Error('系统拒绝注册：'+value+'，可能已被系统或其他程序占用');}
    catch(e){throw Error('未能保存 '+value+'：'+e.message+'。原快捷键已保留。');}
    try{await db('setting','shortcut',value);}catch(e){unregisterShortcut(value);throw e;}
    if(old!==value)unregisterShortcut(old);
    if(shortcutRecorder)unregisterShortcut(value);
    fault='';broadcast('shortcut-changed',value);return value;
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
  if(keyboardPromise)return keyboardPromise;
  clearTimeout(keyboardRestartTimer);keyboardReady=false;modeAcknowledged=0;keyboardLastHeartbeat=Date.now();
  const {spawn}=require('node:child_process');
  const script=fs.readFileSync(path.join(__dirname,'clipboard-listener.ps1'),'utf8');
  writeKeyboardMode().catch(reportError);
  let resolveReady,rejectReady;keyboardPromise=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const deadline=setTimeout(()=>{rejectReady(Error('Win+V 键盘服务启动超时'));clipboardListener?.kill();},30000);
  clipboardListener=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,CLIPBOARD_MODE_FILE:modeFile(),CLIPBOARD_PARENT_PID:String(process.pid)}});
  let buffer='';clipboardListener.stdout.on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(line==='KEYBOARD_READY'){keyboardReady=true;keyboardFailures=0;keyboardLastHeartbeat=Date.now();clearTimeout(deadline);resolveReady();if(fault.startsWith('Windows 键盘服务')){fault='';broadcast('status',{error:''});}}else if(line==='HEARTBEAT'){keyboardLastHeartbeat=Date.now();}else if(line.startsWith('MODE ')){modeAcknowledged=Number(line.slice(5));for(const [id,w] of modeWaiters)if(id<=modeAcknowledged){modeWaiters.delete(id);w.resolve();}}else if(line==='WINV'){if(shortcutRecorder!==null){for(const w of [popup,manager])if(w&&!w.isDestroyed()&&w.webContents.id===shortcutRecorder)w.webContents.send('shortcut-captured','Super+V');}else if(winVActive)showPopup();}else if(line==='CHANGED'&&!testing)captureClipboard(true);}});
  clipboardListener.on('error',e=>{clearTimeout(deadline);rejectReady(e);});
  clipboardListener.on('exit',(code,signal)=>{runtimeLog('keyboard exit code='+code+' signal='+signal);keyboardReady=false;clearTimeout(deadline);rejectReady(Error('Windows 键盘服务已退出'));keyboardPromise=null;clipboardListener=null;clearInterval(keyboardHealthTimer);if(!quitting){reportError(new Error('Windows 键盘服务已退出，正在自动恢复'));keyboardRestartTimer=setTimeout(()=>startWindowsListener().catch(reportError),Math.min(30000,1000*2**Math.min(keyboardFailures++,5)));}});
  clearInterval(keyboardHealthTimer);keyboardHealthTimer=setInterval(()=>{if(Date.now()-keyboardLastHeartbeat>20000)clipboardListener?.kill();},5000);
  return keyboardPromise;
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
      else if(command==='info')value={version:process.versions,autostart:autostart.get(),data:app.getPath('userData'),tray:!!tray,trayBounds:tray?.getBounds(),popupVisible:popup?.isVisible(),managerVisible:manager?.isVisible(),shortcut:registeredShortcut(await db('setting','shortcut')||'CommandOrControl+Shift+V'),winVActive,keyboardReady,listenerPid:clipboardListener?.pid};
      else throw Error('Unknown command');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({value}));
    }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
  });
  server.listen(0,'127.0.0.1',()=>{fs.writeFileSync(path.join(app.getPath('userData'),'test-endpoint.json'),JSON.stringify({port:server.address().port,token}),{mode:0o600});});
  app.on('will-quit',()=>server.close());
}
