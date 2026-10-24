const {test}=require('node:test');const assert=require('node:assert/strict');const h=require('../src/ui/hotkey.js');
function event(key,flags={}){return {key,code:'',ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,...flags};}
test('单键、功能键、方向键、Escape 和 Tab 不需要 Ctrl/Alt',()=>{
 for(const [key,value] of [['a','A'],['F8','F8'],['ArrowLeft','Left'],['Escape','Escape'],['Tab','Tab'],[' ','Space'],['+','Plus']])assert.equal(h.accelerator(event(key)),value);
});
test('Shift、Win、Ctrl 保留不同含义，支持混合修饰键',()=>{
 assert.equal(h.accelerator(event('F8',{shiftKey:true})),'Shift+F8');
 assert.equal(h.accelerator(event('a',{metaKey:true})),'Super+A');
 assert.equal(h.accelerator(event('a',{ctrlKey:true})),'Control+A');
 assert.equal(h.accelerator(event('F8',{ctrlKey:true,altKey:true,shiftKey:true,metaKey:true})),'Control+Alt+Super+Shift+F8');
});
test('不在前端拒绝单独修饰键，交给系统实际注册',()=>{
 assert.equal(h.accelerator(event('Shift',{shiftKey:true})),'Shift');assert.equal(h.accelerator(event('Meta',{metaKey:true})),'Super');
});
test('输入法和标点按键转换为可注册名称',()=>{
 assert.equal(h.accelerator(event('Process',{code:'KeyQ'})),'Q');assert.equal(h.accelerator(event('Dead',{code:'Quote'})),"'");assert.equal(h.display('Super+Shift+F8'),'Win + Shift + F8');
});
