const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {Store}=require('../src/store.cjs');
test('精确去重、置顶、Unicode搜索、超长原文与重启持久化',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clipboard-test-'));const file=path.join(dir,'history.sqlite');let s=new Store(file);
  try{
    const first=s.capture('中文搜索与空格  ');const second=s.capture('another text');
    assert.notEqual(first.id,second.id);assert.equal(s.list().rows[0].id,second.id);
    const dup=s.capture('中文搜索与空格  ');assert.equal(dup.id,first.id);assert.equal(s.list().total,2);assert.equal(s.list().rows[0].id,first.id);assert.equal(s.get(first.id).copies,2);
    s.capture('中文搜索与空格');assert.equal(s.list().total,3);
    assert.equal(s.list({q:'中文'}).total,2);assert.equal(s.list({q:'搜索与空'}).total,2);assert.equal(s.list({q:'ANOTHER'}).total,1);assert.equal(s.list({q:'"quote"'}).total,0);
    const long='无字数限制🙂\n'.repeat(160000);const row=s.capture(long);assert.equal(s.get(row.id).content,long);assert.ok(s.get(row.id).chars>1000000);
    const state={q:'中文',anchor:{id:first.id,offset:31},selected:first.id};s.setting('ui-popup',state);
    s.close();s=new Store(file);assert.equal(s.get(row.id).content,long);assert.deepEqual(s.setting('ui-popup'),state);assert.equal(s.list().total,4);
    s.remove([row.id]);assert.equal(s.list().total,3);assert.equal(s.list({q:'无字数限制'}).total,0);
  }finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('分页与锚点位置',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clipboard-pages-'));const s=new Store(path.join(dir,'db'));
  try{for(let i=0;i<300;i++)s.capture('记录 '+i);const list=s.list({offset:100,limit:80});assert.equal(list.rows.length,80);const id=list.rows[10].id;assert.equal(s.locate({id}),110);s.capture('新内容');assert.equal(s.locate({id}),111);s.capture(s.get(id).content);assert.equal(s.locate({id}),0);assert.equal(s.list().total,301);}finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
