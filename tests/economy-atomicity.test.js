import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("recompensa de coleção é idempotente sob requisições concorrentes", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const start = worker.indexOf('if(type==="cosmetic_claim")');
  const end = worker.indexOf('}else if(type==="seasonal_buy")', start);
  assert.ok(start >= 0 && end > start, "bloco de resgate de coleção encontrado");
  const claim = worker.slice(start, end);
  assert.match(claim, /INSERT INTO kingdom_collection_claims[\s\S]*ON CONFLICT\(kingdom_id,collection_id\) DO NOTHING/);
  assert.match(claim, /UPDATE players SET gems=gems\+\? WHERE id=\? AND changes\(\)>0/);
  assert.match(claim, /UPDATE kingdom_cosmetic_wallet SET shards=shards\+\? WHERE kingdom_id=\? AND changes\(\)>0/);
  assert.match(claim, /if\(!result\[0\]\?\.meta\?\.changes\)return json\(\{error:"Esta recompensa já foi resgatada\."/);
  assert.ok(claim.indexOf("INSERT INTO kingdom_collection_claims") < claim.indexOf("UPDATE players SET gems"));
});

test("loja e mercador: saldo, estoque e entrega atômicos sob concorrência e falha",async()=>{
 const {DatabaseSync}=await import("node:sqlite");
 const {commitShopPurchase}=await import("../worker.js");
 const db=new DatabaseSync(":memory:");
 try{
  db.exec(`
   CREATE TABLE players(id INTEGER PRIMARY KEY,gems INTEGER NOT NULL);
   CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,gold INTEGER,food INTEGER,wood INTEGER);
   CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
   CREATE TABLE merchant_stock(kingdom_id INTEGER,cycle_id INTEGER,item_id TEXT,stock INTEGER CHECK(stock>=0),UNIQUE(kingdom_id,cycle_id,item_id));
   CREATE TABLE shop_inventory(kingdom_id INTEGER,item_id TEXT,quantity INTEGER CHECK(quantity>=0),UNIQUE(kingdom_id,item_id));
   INSERT INTO players VALUES(1,100);
   INSERT INTO kingdoms VALUES(10,1,500,0,0);
  `);
  let fault=false;
  const adapter={prepare(sql){return {bind(...args){return {sql,args}}}},async batch(statements){
   db.exec("BEGIN");
   try{
    const results=statements.map(s=>{
     if(fault&&s.sql.startsWith("INSERT INTO shop_inventory"))throw Error("synthetic delivery failure");
     return {meta:{changes:db.prepare(s.sql).run(...s.args).changes}};
    });
    db.exec("COMMIT");return results;
   }catch(e){db.exec("ROLLBACK");throw e;}
  }};
  const opts={kingdomId:10,playerId:1,itemId:"pack",source:"merchant",price:40,currency:"gems",gives:{food:100,acc_1h:2},cycle:1,offerStock:1};
  fault=true;
  await assert.rejects(commitShopPurchase(adapter,opts),/synthetic delivery failure/);
  assert.equal(db.prepare("SELECT gems FROM players").get().gems,100);
  assert.equal(db.prepare("SELECT food FROM kingdoms").get().food,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM merchant_stock").get().n,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events").get().n,0);
  fault=false;
  const results=await Promise.all([commitShopPurchase(adapter,opts),commitShopPurchase(adapter,opts)]);
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(db.prepare("SELECT gems FROM players").get().gems,60);
  assert.equal(db.prepare("SELECT food FROM kingdoms").get().food,100);
  assert.equal(db.prepare("SELECT quantity FROM shop_inventory").get().quantity,2);
  assert.equal(db.prepare("SELECT stock FROM merchant_stock").get().stock,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events WHERE event_type='shop_purchase'").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events WHERE event_type='__internal_action_guard'").get().n,0);
  const insufficient=await commitShopPurchase(adapter,{...opts,cycle:2,price:999});
  assert.equal(insufficient.ok,false);
  assert.equal(db.prepare("SELECT stock FROM merchant_stock WHERE cycle_id=2").get().stock,1);
  assert.equal(db.prepare("SELECT gems FROM players").get().gems,60);
  const regular=await commitShopPurchase(adapter,{...opts,source:"shop",price:25,currency:"gold",gives:{wood:50}});
  assert.equal(regular.ok,true);
  assert.equal(db.prepare("SELECT gold,wood FROM kingdoms").get().gold,475);
  assert.equal(db.prepare("SELECT wood FROM kingdoms").get().wood,50);
 }finally{db.close();}
});
