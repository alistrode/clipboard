const {DatabaseSync} = require('node:sqlite');
const {createHash} = require('node:crypto');
const {mkdirSync} = require('node:fs');
const {dirname} = require('node:path');
class Store {
  constructor(file) {
    mkdirSync(dirname(file), {recursive:true});
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY, digest TEXT NOT NULL UNIQUE, content TEXT NOT NULL,
      preview TEXT NOT NULL, chars INTEGER NOT NULL, copies INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL, seq INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS entries_order ON entries(seq DESC);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS counter(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL);
      INSERT OR IGNORE INTO counter VALUES(1,0);`);
    try {
      this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(content,content='entries',content_rowid='id',tokenize='trigram');
        CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN INSERT INTO search(rowid,content) VALUES(new.id,new.content); END;
        CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN INSERT INTO search(search,rowid,content) VALUES('delete',old.id,old.content); END;`);
      this.fts = true;
    } catch { this.fts = false; }
  }
  capture(content) {
    if (typeof content !== 'string' || content.length === 0) return null;
    const digest=createHash('sha256').update(content,'utf8').digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const old=this.db.prepare('SELECT id,content,copies FROM entries WHERE digest=?').get(digest);
      if(old && old.content !== content) throw new Error('内容哈希冲突，未覆盖原记录');
      const seq=this.db.prepare('UPDATE counter SET value=value+1 WHERE id=1 RETURNING value').get().value;
      const now=Date.now();
      let id;
      if(old){this.db.prepare('UPDATE entries SET copies=copies+1,updated=?,seq=? WHERE id=?').run(now,seq,old.id);id=old.id;}
      else id=Number(this.db.prepare('INSERT INTO entries(digest,content,preview,chars,updated,seq) VALUES(?,?,?,?,?,?)').run(digest,content,content.slice(0,400),content.length,now,seq).lastInsertRowid);
      this.db.exec('COMMIT');return {id,duplicate:!!old,seq};
    } catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  filter(q='') {
    if (!q) return {sql:'1',args:[]};
    if(this.fts && Array.from(q).length>=3) return {sql:'id IN (SELECT rowid FROM search WHERE search MATCH ?) AND instr(lower(content),lower(?))>0',args:['"'+q.replaceAll('"','""')+'"',q]};
    return {sql:'instr(lower(content),lower(?))>0',args:[q]};
  }
  list({q='',offset=0,limit=60}={}) {
    const {sql,args}=this.filter(q);
    const total=this.db.prepare(`SELECT count(*) n FROM entries WHERE ${sql}`).get(...args).n;
    const rows=this.db.prepare(`SELECT id,preview,chars,copies,updated,seq FROM entries WHERE ${sql} ORDER BY seq DESC LIMIT ? OFFSET ?`).all(...args,Math.min(Math.max(1,limit),150),Math.max(0,offset));
    return {rows,total};
  }
  locate({id,q=''}) {
    const row=this.db.prepare('SELECT seq FROM entries WHERE id=?').get(id);
    if(!row)return 0;
    const {sql,args}=this.filter(q);
    return this.db.prepare(`SELECT count(*) n FROM entries WHERE (${sql}) AND seq>?`).get(...args,row.seq).n;
  }
  get(id){return this.db.prepare('SELECT * FROM entries WHERE id=?').get(id)||null;}
  remove(ids){this.db.exec('BEGIN IMMEDIATE');try{const del=this.db.prepare('DELETE FROM entries WHERE id=?');for(const id of ids)del.run(id);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}return true;}
  setting(key,value){if(value!==undefined){this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));return value;}const r=this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);return r?JSON.parse(r.value):null;}
  close(){this.db.close();}
}
module.exports={Store};
