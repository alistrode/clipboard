'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');const {PassThrough}=require('node:stream');
const {createClipboardReader}=require('../src/clipboard-reader.cjs');
function child(){const c=new EventEmitter();c.stdin=new PassThrough();c.stdout=new PassThrough();c.stderr=new PassThrough();c.killed=false;c.kill=()=>{c.killed=true;};return c;}
function reply(c,id,text){c.stdout.write(JSON.stringify({id,ok:true,text})+'\n');}
test('slow providers leave the caller event loop responsive and return Unicode intact',async()=>{
 const c=child();const reader=createClipboardReader({spawnChild:()=>c,timeoutMs:500});let tick=false;
 const value=reader.read();await new Promise(r=>setTimeout(()=>{tick=true;r();},15));assert.equal(tick,true);
 const text='中文 😀\nsecond line';const bytes=Buffer.from(JSON.stringify({id:1,ok:true,text})+'\n');const cut=bytes.indexOf(Buffer.from('中'))+1;c.stdout.write(bytes.subarray(0,cut));c.stdout.write(bytes.subarray(cut));assert.equal(await value,text);reader.stop();
});
test('timeout retires only the stalled reader and a late old exit cannot kill its replacement',async()=>{
 const old=child(),next=child();let spawned=0;const reader=createClipboardReader({spawnChild:()=>spawned++?next:old,timeoutMs:25,startupTimeoutMs:25,retryDelayMs:0});
 await assert.rejects(reader.read(),/暂时未响应/);assert.equal(old.killed,true);
 const current=reader.read();old.emit('exit',1);reply(next,2,'replacement');assert.equal(await current,'replacement');assert.equal(next.killed,false);reader.stop();
});
test('startup time is separate from a provider read deadline',async()=>{
 const c=child();const reader=createClipboardReader({spawnChild:()=>c,timeoutMs:15,startupTimeoutMs:200});const p=reader.read();const rejected=assert.rejects(p,/暂时未响应/);await new Promise(r=>setTimeout(r,30));assert.equal(c.killed,false);c.stdout.write('{"ready":true}\n');await rejected;assert.equal(c.killed,true);reader.stop();
});
test('concurrent reads share one request and stop rejects the outstanding request',async()=>{
 const c=child();let count=0;c.stdin.on('data',()=>count++);const reader=createClipboardReader({spawnChild:()=>c,timeoutMs:500});const a=reader.read(),b=reader.read();assert.equal(a,b);assert.equal(count,1);reader.stop();await assert.rejects(a);assert.equal(c.killed,true);await assert.rejects(reader.read());
});
