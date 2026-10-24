'use strict';
const $=id=>document.getElementById(id);
const kind=new URLSearchParams(location.search).get('view')||'popup';
const manager=kind==='manager';document.body.classList.toggle('manager',manager);
if(manager){$('title').textContent='剪贴板管理';$('search').placeholder='搜索历史记录…';}
const rowHeight=manager?44:84;
let rows=[],start=0,total=0,selected=null,query='',revision=0,restoring=false,saveTimer,searchTimer,detailId;
let knownAnchor=null,loading=false,reloadPending=false;
const viewport=$('list');
function error(e){$('error').textContent=e?.message||String(e);$('error').hidden=false;}
function clearError(){$('error').hidden=true;}
function shortcutText(s){return clipHotkey.display(s);}
function dateText(n){const d=new Date(n),now=new Date();const time=d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();return (day===today?'今天':today-day===86400000?'昨天':d.toLocaleDateString('zh-CN'))+' '+time;}
function getAnchor(){const index=Math.floor(viewport.scrollTop/rowHeight);const r=rows[index-start];return r?{id:r.id,offset:viewport.scrollTop%rowHeight}:null;}
function save(){clearTimeout(saveTimer);const anchor=getAnchor();if(!anchor&&total>0)return;if(anchor)knownAnchor=anchor;const state={q:query,selected,anchor,scrollTop:viewport.scrollTop};saveTimer=setTimeout(()=>clip.state(kind,state).catch(error),100);}
async function load({anchor=null,reset=false}={}){
  const rev=++revision;loading=true;
  try {
    let y=reset?0:viewport.scrollTop;
    if(anchor?.id)y=(await clip.db('locate',{id:anchor.id,q:query}))*rowHeight+(anchor.offset||0);
    const target=Math.max(0,Math.floor(y/rowHeight)-8);
    const result=await clip.db('list',{q:query,offset:target,limit:80});
    if(rev!==revision)return;
    total=result.total;rows=result.rows;start=target;
    if(!selected&&rows.length)selected=rows[0].id;
    $('spacer').style.height=total*rowHeight+'px';
    if(!anchor&&!reset)y=viewport.scrollTop;
    viewport.scrollTop=Math.min(y,Math.max(0,total*rowHeight-viewport.clientHeight));
    render();save();
  }catch(e){error(e);}finally{if(rev===revision){
    loading=false;
    const top=Math.floor(viewport.scrollTop/rowHeight),end=Math.min(total,top+Math.ceil(viewport.clientHeight/rowHeight));
    if(top<start||end>start+rows.length){load();}
    else if(reloadPending){reloadPending=false;load({anchor:getAnchor()});}
  }}
}
function render(){
  const fragment=document.createDocumentFragment();
  for(const row of rows){
    const outer=document.createElement('div');outer.className='row'+(row.id===selected?' selected':'');outer.dataset.id=row.id;outer.setAttribute('role','option');outer.setAttribute('aria-selected',row.id===selected?'true':'false');
    const card=document.createElement('div');card.className='card';
    const text=document.createElement('span');text.className='snippet';text.textContent=row.preview;card.append(text);
    if(manager){const time=document.createElement('span');time.className='time';time.textContent=dateText(row.updated);card.append(time);}
    else{const menu=document.createElement('button');menu.className='menu';menu.textContent='⋯';menu.setAttribute('aria-label','记录操作');menu.onclick=e=>{e.stopPropagation();selected=row.id;render();clip.menu(row.id);};card.append(menu);}
    outer.append(card);
    outer.onclick=()=>{selected=row.id;render();save();if(!manager)copy(row.id);};
    outer.ondblclick=()=>manager?showDetail(row.id):undefined;
    outer.oncontextmenu=e=>{e.preventDefault();selected=row.id;render();clip.menu(row.id);save();};
    fragment.append(outer);
  }
  $('rows').replaceChildren(fragment);$('rows').style.transform=`translateY(${start*rowHeight}px)`;
  $('empty').hidden=total!==0;
  if(total===0)$('empty').replaceChildren(document.createTextNode(query?'没有匹配的记录':'还没有记录'),document.createElement('br'),Object.assign(document.createElement('small'),{textContent:query?'换个关键词试试':'复制文字后会自动保存在这里'}));
  $('delete').disabled=!selected||!rows.some(r=>r.id===selected);
  if(manager)$('foot-left').textContent=`${total.toLocaleString()} 条${query?'匹配记录':''} · 已保存到本地`;
}
async function copy(id){try{await clip.copy(id);save();}catch(e){error(e);}}
async function showDetail(id){try{const row=await clip.db('get',id);if(!row)return;detailId=id;$('full-text').value=row.content;$('detail-meta').textContent=`${row.chars.toLocaleString()} 字符 · 复制 ${row.copies} 次`;$('detail').showModal();}catch(e){error(e);}}
viewport.addEventListener('scroll',()=>{
  if(restoring)return;
  save();
  const top=Math.floor(viewport.scrollTop/rowHeight);const end=top+Math.ceil(viewport.clientHeight/rowHeight);
  if(!loading&&(top<start+3&&start>0||end>start+rows.length-3&&start+rows.length<total))load();
});
$('search').addEventListener('input',()=>{query=$('search').value;clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{selected=null;knownAnchor=null;await load({reset:true});save();},150);});
$('latest').onclick=async()=>{selected=null;knownAnchor=null;await load({reset:true});save();};
$('delete').onclick=async()=>{if(!selected)return;try{await clip.remove([selected]);selected=null;await load();save();}catch(e){error(e);}};
$('close').onclick=()=>{save();clip.action('hide');};$('more').onclick=()=>clip.action('manager');$('minimize').onclick=()=>clip.action('minimize');$('maximize').onclick=()=>clip.action('maximize');
$('detail-close').onclick=()=>$('detail').close();$('detail-copy').onclick=()=>copy(detailId);
document.addEventListener('keydown',async e=>{
  if(e.target===$('shortcut'))return;
  if(e.key==='Escape'){if($('detail').open)$('detail').close();else{save();clip.action('hide');}return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();$('search').focus();return;}
  if(e.target===$('shortcut')||e.target.tagName==='TEXTAREA')return;
  if(['ArrowDown','ArrowUp'].includes(e.key)&&!$('detail').open){
    e.preventDefault();let index=rows.findIndex(r=>r.id===selected);let absolute=start+index+(e.key==='ArrowDown'?1:-1);absolute=Math.max(0,Math.min(total-1,absolute));
    if(absolute<start||absolute>=start+rows.length){viewport.scrollTop=absolute*rowHeight;await load();}
    const row=rows[absolute-start];if(row){selected=row.id;const top=absolute*rowHeight;if(top<viewport.scrollTop)viewport.scrollTop=top;else if(top+rowHeight>viewport.scrollTop+viewport.clientHeight)viewport.scrollTop=top+rowHeight-viewport.clientHeight;render();save();}
  }
  if(e.key==='Enter'&&selected&&e.target!==$('autostart')&&!$('detail').open){e.preventDefault();copy(selected);}
});
let autoOn=false,autoBusy=false,gesture=null;
function paintAuto(){const b=$('autostart');b.setAttribute('aria-checked',String(autoOn));b.classList.toggle('pending',autoBusy);b.disabled=autoBusy;$('auto-status').textContent=autoBusy?'正在应用…':autoOn?'已开启':'已关闭';}
async function setAuto(next){if(autoBusy||next===autoOn)return;autoBusy=true;const old=autoOn;autoOn=next;paintAuto();try{autoOn=await clip.autostart(next);$('auto-hint').textContent='已保存并生效';clearError();}catch(e){autoOn=old;$('auto-hint').textContent='设置失败，已恢复原状态';error(e);}finally{autoBusy=false;$('autostart').querySelector('.thumb').style.transform='';paintAuto();}}
$('autostart').addEventListener('pointerdown',e=>{if(autoBusy)return;gesture={x:e.clientX,initial:autoOn};$('autostart').setPointerCapture(e.pointerId);});
$('autostart').addEventListener('pointermove',e=>{if(!gesture)return;const dx=e.clientX-gesture.x;const value=Math.max(0,Math.min(31,(gesture.initial?31:0)+dx));$('autostart').querySelector('.thumb').style.transform=`translateX(${value}px)`;});
$('autostart').addEventListener('pointerup',e=>{if(!gesture)return;const dx=e.clientX-gesture.x,initial=gesture.initial;gesture=null;$('autostart').querySelector('.thumb').style.transform='';if(Math.abs(dx)>=6)setAuto(dx>0);else paintAuto();});
$('autostart').addEventListener('pointercancel',()=>{gesture=null;$('autostart').querySelector('.thumb').style.transform='';paintAuto();});
$('autostart').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();setAuto(e.key==='ArrowRight'?true:e.key==='ArrowLeft'?false:!autoOn);}});
let pendingShortcut=null,recordReady=Promise.resolve();
$('shortcut').title='按任意键或组合键，松开后自动保存；点击其他位置结束录入';
$('shortcut').addEventListener('focus',()=>{recordReady=clip.recordShortcut(true).catch(error);});
$('shortcut').addEventListener('blur',()=>{pendingShortcut=null;clip.recordShortcut(false).catch(error);});
window.addEventListener('blur',()=>{if(document.activeElement===$('shortcut'))$('shortcut').blur();});
$('shortcut').addEventListener('keydown',e=>{e.preventDefault();e.stopPropagation();if(!e.repeat&&!clipHotkey.isModifier(e.key))pendingShortcut={value:clipHotkey.accelerator(e),key:e.key};});
$('shortcut').addEventListener('keyup',async e=>{
  e.preventDefault();e.stopPropagation();
  if(!pendingShortcut||clipHotkey.isModifier(e.key))return;
  const candidate=pendingShortcut;pendingShortcut=null;
  try{await recordReady;const value=await clip.shortcut(candidate.value);e.target.value=shortcutText(value);if(!manager)$('foot-left').textContent=shortcutText(value);clearError();}
  catch(e){error(e);const s=await clip.settings();$('shortcut').value=shortcutText(s.shortcut);}
});
clip.on('shortcut-captured',async value=>{if(document.activeElement!==$('shortcut'))return;pendingShortcut=null;try{await recordReady;await clip.shortcut(value);clearError();}catch(e){error(e);}});
clip.on('shortcut-changed',value=>{$('shortcut').value=shortcutText(value);if(!manager)$('foot-left').textContent=shortcutText(value);});
clip.on('changed',()=>{if(loading){reloadPending=true;return;}const anchor=getAnchor();load({anchor}).then(()=>{save();if(reloadPending){reloadPending=false;load({anchor:getAnchor()});}});});
clip.on('shown',()=>{load({anchor:getAnchor()||knownAnchor});});
clip.on('detail',showDetail);clip.on('status',s=>{if(s.error)error(s.error);else clearError();});
async function init(){
  try{
    const state=await clip.state(kind);if(state){query=state.q||'';$('search').value=query;selected=state.selected;knownAnchor=state.anchor;}
    await load({anchor:state?.anchor,reset:!state});
    const settings=await clip.settings();autoOn=settings.autostart;paintAuto();$('shortcut').value=shortcutText(settings.shortcut);if(!manager)$('foot-left').textContent=shortcutText(settings.shortcut);
    if(settings.error)error(settings.error);
    if(settings.wayland)error(new Error('Wayland 的后台剪贴板访问由桌面环境决定；请在当前桌面验证记录与快捷键。'));
    document.documentElement.dataset.ready='true';
  }catch(e){error(e);}
}
init();
