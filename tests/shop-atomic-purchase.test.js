import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const worker=readFileSync(new URL("../worker.js",import.meta.url),"utf8");
const source=worker.slice(worker.indexOf('}else if(type==="shop_buy"){'),worker.indexOf('}else if(type==="merchant_exchange"){'));
function literal(prefix){
 const found=[...source.matchAll(/env\.DB\.prepare\(("(?:[^"\\]|\\.)*")/g)].map(x=>JSON.parse(x[1])).find(s=>s.startsWith(prefix));
 assert.ok(found,prefix);return found;
}
const stockCheck=source.match(/const stockCheck=offer\?("(?:[^"\\]|\\.)*"):/);
assert.ok(stockCheck);
const guard=JSON.parse(source.match(/,guard=("(?:[^"\\]|\\.)*")/)[1]);
test("shop purchase has one guarded transaction and no independent debit",()=>{
 assert.equal((source.match(/env\.DB\.batch\(/g)||[]).length,1);
 assert.doesNotMatch(source,/\.run\(/);
 assert.match(source,/WHERE id=\? AND "\+guard/);
 assert.match(source,/SELECT \?,\?,\? WHERE "\+guard\+" ON CONFLICT/);
});
test("merchant purchase rejects empty stock and low balance without charging or delivering",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec("CREATE TABLE players(id INTEGER PRIMARY KEY,gems INTEGER); CREATE TABLE merchant_stock(kingdom_id INTEGER,cycle_id TEXT,item_id TEXT,stock INTEGER); CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT); CREATE TABLE shop_inventory(kingdom_id INTEGER,item_id TEXT,quantity INTEGER,UNIQUE(kingdom_id,item_id)); INSERT INTO players VALUES(1,50); INSERT INTO merchant_stock VALUES(10,'cycle','item',1);");
  const debit=literal("UPDATE players SET gems=gems-?")+JSON.parse(stockCheck[1]);
  const stock=literal("UPDATE merchant_stock SET stock=stock-1");
  const mark=literal("INSERT INTO kingdom_events");
  const grant=literal("INSERT INTO shop_inventory")+guard+" ON CONFLICT(kingdom_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity";
  const clean=literal("DELETE FROM kingdom_events");
  const buy=(price,id,fail=false)=>{
   db.exec("BEGIN");
   try{
    db.prepare(debit).run(price,1,price,10,"cycle","item");
    db.prepare(stock).run(10,"cycle","item");
    db.prepare(mark).run(10,"__internal_action_guard",id);
    db.prepare(grant).run(10,"item",1,10,id);
    if(fail)throw Error("injected");
    db.prepare(clean).run(10,id);
    db.exec("COMMIT");
   }catch(e){db.exec("ROLLBACK");throw e}
  };
  const state=()=>[db.prepare("SELECT gems FROM players").get().gems,db.prepare("SELECT stock FROM merchant_stock").get().stock,db.prepare("SELECT COALESCE(SUM(quantity),0) AS n FROM shop_inventory").get().n];
  buy(60,"a");assert.deepEqual(state(),[50,1,0]);
  assert.throws(()=>buy(20,"b",true),/injected/);assert.deepEqual(state(),[50,1,0]);
  buy(20,"c");assert.deepEqual(state(),[30,0,1]);
  buy(20,"d");assert.deepEqual(state(),[30,0,1]);
 }finally{db.close()}
});
