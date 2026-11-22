import test from "node:test";
import assert from "node:assert/strict";
import {DRAGON_CATALOG,DRAGON_BY_KEY,MASTER_DRAGON_KEYS,getDragonCombatBonuses,getDragonCollectionView} from "../dragon-catalog.js";
import {MASTER_PACK_NAME,MASTER_PACK_GEMS,MASTER_PACK_BONUSES,masterGrantStatements} from "../master-pack.js";
import {readFile} from "node:fs/promises";
test("9 dragões distintos: três de cada cor, somente dourados Master",()=>{
 assert.equal(DRAGON_CATALOG.length,9);
 assert.equal(new Set(DRAGON_CATALOG.map(d=>d.key)).size,9);
 assert.equal(new Set(DRAGON_CATALOG.map(d=>d.name)).size,9);
 for(const [rarity,n] of [["blue",3],["purple",3],["gold",3]]){
  assert.equal(DRAGON_CATALOG.filter(d=>d.rarity===rarity).length,n);
 }
 assert.equal(MASTER_DRAGON_KEYS.length,3);
 assert.ok(DRAGON_CATALOG.filter(d=>d.rarity==="gold").every(d=>d.master));
 assert.ok(DRAGON_CATALOG.filter(d=>d.rarity!=="gold").every(d=>!d.master));
});
test("bônus dos dragões dourados superam roxos e azuis sem ultrapassar 5,5%",()=>{
 const maxPurple=Math.max(...DRAGON_CATALOG.filter(d=>d.rarity==="purple").flatMap(d=>[d.attack,d.defense]));
 for(const dragon of DRAGON_CATALOG){
  const early=getDragonCombatBonuses({dragon_key:dragon.key,level:1,bond:1});
  const late=getDragonCombatBonuses({dragon_key:dragon.key,level:100,bond:100});
  for(const key of ["attackPercent","defensePercent"]){
   assert.ok(early[key]>0&&late[key]>=early[key]);
   assert.ok(late[key]<=5.5);
   if(dragon.rarity==="gold")assert.ok(early[key]>maxPurple);
  }
  assert.equal(DRAGON_BY_KEY[dragon.key].name,dragon.name);
 }
 assert.deepEqual(getDragonCombatBonuses({dragon_key:"made-up"}),{attackPercent:0,defensePercent:0});
});
test("coleção marca um único dragão equipado e preserva o inicial",()=>{
 const collection=getDragonCollectionView(["ember_wyrm","storm_rune"],"storm_rune");
 assert.equal(collection.filter(x=>x.owned).length,2);
 assert.equal(collection.filter(x=>x.equipped).length,1);
 assert.ok(collection.find(x=>x.key==="ember_wyrm").owned);
});
test("Master só é concedido com compra aprovada e ledger único",async()=>{
 const migration=await readFile(new URL("../migrations/0030_dragons_master_mailbox.sql",import.meta.url),"utf8");
 assert.match(migration,/UNIQUE REFERENCES kingdoms/);
 assert.match(migration,/UNIQUE\(kingdom_id,dragon_key\)/);
 assert.match(migration,/UNIQUE\(kingdom_id,source_key\)/);
 assert.match(migration,/Pacote Master de Eldoria/);
 assert.equal(MASTER_PACK_GEMS,10000);
 assert.equal(MASTER_PACK_NAME,"Pacote Master de Eldoria");
 assert.deepEqual(MASTER_PACK_BONUSES.dragons,MASTER_DRAGON_KEYS);
 const sql=[];
 const db={prepare(statement){sql.push(statement);return {bind(){return {sql:statement}}}}};
 assert.equal(masterGrantStatements(db,123).length,6);
 assert.ok(sql.some(s=>s.includes("status='approved'")));
 assert.ok(sql.some(s=>s.includes("AND changes()=1")));
 assert.equal(sql.filter(s=>s.includes("INSERT OR IGNORE INTO kingdom_dragons")).length,3);
});
