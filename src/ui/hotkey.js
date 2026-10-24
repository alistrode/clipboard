(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.clipHotkey=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const modifiers=new Set(['Control','Shift','Alt','Meta','OS','AltGraph']);
  const aliases={' ':'Space',Spacebar:'Space',Esc:'Escape',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Del:'Delete','+':'Plus',OS:'Super',Meta:'Super'};
  const codes={Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'};
  function keyName(e){
    let key=e.key;
    if(!key||['Dead','Process','Unidentified'].includes(key)){
      if(/^Key[A-Z]$/.test(e.code))key=e.code.slice(3);
      else if(/^Digit\d$/.test(e.code))key=e.code.slice(5);
      else key=codes[e.code]||e.code||key;
    }
    if(/^Numpad\d$/.test(e.code))return 'num'+e.code.slice(6);
    return aliases[key]||(key?.length===1?key.toUpperCase():key);
  }
  function accelerator(e){
    const parts=[];
    if(e.ctrlKey)parts.push('Control');if(e.altKey)parts.push('Alt');if(e.metaKey)parts.push('Super');if(e.shiftKey)parts.push('Shift');
    const key=keyName(e);
    if(!modifiers.has(e.key))parts.push(key);
    else if(parts.length===0)parts.push(key);
    return [...new Set(parts.filter(Boolean))].join('+');
  }
  function display(value){return value.split('+').map(k=>({CommandOrControl:'Ctrl',Control:'Ctrl',Super:'Win',Meta:'Win',Plus:'+'}[k]||k)).join(' + ');}
  return {accelerator,display,isModifier:key=>modifiers.has(key)};
});
