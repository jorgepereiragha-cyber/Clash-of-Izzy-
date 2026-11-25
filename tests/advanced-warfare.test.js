import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("migration avançada cria nós, rallies e pesquisa com escopo de reino", async () => {
 const sql=await read("migrations/0021_advanced_warfare.sql");
 for(const table of ["resource_nodes","rallies","rally_reinforcements","kingdom_tech","tech_catalog"])
  assert.match(sql,new RegExp("CREATE TABLE IF NOT EXISTS "+table+"\\b"));
 assert.match(sql,/WITH RECURSIVE seq\(n\)/);
 assert.match(sql,/n<99/);
 assert.match(sql,/reserved_by_rally/);
 assert.match(sql,/FOREIGN KEY|REFERENCES kingdoms/);
 assert.match(sql,/INSERT OR IGNORE INTO tech_catalog/);
});

test("módulo de guerra usa a identidade autenticada e valida tropas do catálogo permanente", async () => {
 const source=await read("rally.js");
 for(const marker of ["kingdomForPlayer","alliance_members","army_units","json_each","resource_ledger","processDueRallies","occupied_by"])
  assert.ok(source.includes(marker), "missing rally security or economy marker: "+marker);
 assert.match(source,/MAX_TOTAL_TROOPS/);
 assert.match(source,/Object\.hasOwn\(UNIT_POWER/);
 assert.doesNotMatch(source,/apiFetch|window\.map3d/);
});

test("world map oferece painel e ativos PWA do sistema de guerra", async () => {
 const html=await read("world.html");
 const worker=await read("worker.js");
 const sw=await read("sw.js");
 assert.ok(html.includes("/rally-ui.js"));
 assert.ok(html.includes("/styles/rally.css"));
 assert.ok(worker.includes("/api/game/rally/"));
 assert.ok(worker.includes("processDueRallies"));
 assert.ok(sw.includes("/rally-ui.js"));
});

test("rally settlement commits once and returns allied troops only to their own kingdoms",async()=>{
 const {DatabaseSync}=await import("node:sqlite");
 const {processDueRallies}=await import("../rally.js");
 const db=new DatabaseSync(":memory:");
 try{
  db.exec(`
   CREATE TABLE rallies(id TEXT PRIMARY KEY,leader_kingdom_id INTEGER,target_id TEXT,status TEXT,departure_time INTEGER,arrival_time INTEGER);
   CREATE TABLE resource_nodes(id TEXT PRIMARY KEY,occupied_by INTEGER,occupation_start INTEGER,garrison_json TEXT,reserved_by_rally TEXT,last_regen INTEGER,current_resources INTEGER,max_resources INTEGER,regen_rate INTEGER);
   CREATE TABLE rally_reinforcements(id INTEGER PRIMARY KEY,rally_id TEXT,kingdom_id INTEGER,troop_data TEXT);
   CREATE TABLE army_units(kingdom_id INTEGER,unit_type TEXT,tier INTEGER,quantity INTEGER,UNIQUE(kingdom_id,unit_type,tier));
   INSERT INTO rallies VALUES('r',1,'n','marching',0,0);
   INSERT INTO resource_nodes VALUES('n',NULL,NULL,'{}','r',0,10,100,10);
   INSERT INTO rally_reinforcements VALUES(1,'r',1,'{"militia":5}'),(2,'r',2,'{"militia":7,"archer":3}'),(3,'r',3,'{"militia":9}');
   INSERT INTO army_units VALUES(1,'militia',1,20),(2,'militia',1,11);
  `);
  const adapter={prepare(sql){return {bind(...args){return {sql,args,
   async all(){return {results:db.prepare(sql).all(...args)}},
   async first(){return db.prepare(sql).get(...args)},
   async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}
  }}}},async batch(statements){db.exec("BEGIN");try{
   const results=statements.map(s=>({meta:{changes:db.prepare(s.sql).run(...s.args).changes}}));
   db.exec("COMMIT");return results;
  }catch(e){db.exec("ROLLBACK");throw e;}}};
  const env={DB:adapter};
  await Promise.all([processDueRallies(env),processDueRallies(env)]);
  await processDueRallies(env);
  assert.equal(db.prepare("SELECT status FROM rallies WHERE id='r'").get().status,"completed");
  const node=db.prepare("SELECT * FROM resource_nodes WHERE id='n'").get();
  assert.equal(node.occupied_by,1);
  assert.deepEqual(JSON.parse(node.garrison_json),{militia:5});
  assert.equal(node.current_resources,100);
  const quantity=(owner,type)=>db.prepare("SELECT quantity FROM army_units WHERE kingdom_id=? AND unit_type=?").get(owner,type)?.quantity;
  assert.equal(quantity(1,"militia"),20);
  assert.equal(quantity(2,"militia"),18);
  assert.equal(quantity(2,"archer"),3);
  assert.equal(quantity(3,"militia"),9);
 }finally{db.close();}
});
