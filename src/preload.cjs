const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('clip',{
  db:(method,...args)=>ipcRenderer.invoke('db',method,...args),
  state:(kind,value)=>ipcRenderer.invoke('state',kind,value),
  settings:()=>ipcRenderer.invoke('settings'),autostart:value=>ipcRenderer.invoke('autostart',value),
  shortcut:value=>ipcRenderer.invoke('shortcut',value),copy:id=>ipcRenderer.invoke('copy',id),
  recordShortcut:active=>ipcRenderer.invoke('shortcut-recording',active),
  remove:ids=>ipcRenderer.invoke('remove',ids),action:name=>ipcRenderer.invoke('action',name),
  menu:id=>ipcRenderer.send('menu',id),
  on:(type,fn)=>{if(['changed','status','shown','detail','shortcut-captured','shortcut-changed'].includes(type))ipcRenderer.on(type,(_e,value)=>fn(value));}
});
