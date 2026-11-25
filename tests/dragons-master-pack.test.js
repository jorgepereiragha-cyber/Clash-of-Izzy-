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
 assert.match(migration,/PRIMARY KEY\(kingdom_id,dragon_key\)/);
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

test("Worker valida propriedade dos dragões e bloqueia resgate duplicado de mensagens",async()=>{
 const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 const game=await readFile(new URL("../game-adapter.js",import.meta.url),"utf8");
 const page=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
 for(const type of ["dragon_unlock","dragon_equip","mail_read","mail_claim"])assert.ok(worker.includes('type==="'+type+'"'));
 assert.match(worker,/if\(dragon\.master\)return json\(/);
 assert.match(worker,/EXISTS\(SELECT 1 FROM kingdom_dragons WHERE kingdom_id=\? AND dragon_key=\?\)/);
 assert.match(worker,/reward_key='welcome_v1' AND claimed_at IS NULL/);
 for(const table of ["kingdom_dragons","kingdom_mailbox","master_bonus_claims"])assert.ok(worker.includes('"'+table+'"'),"health schema missing "+table);
 assert.match(worker,/UPDATE kingdoms SET food=food\+1000,wood=wood\+500 WHERE id=\? AND changes\(\)=1/);
 assert.match(worker,/dragonAttackBonusPercent:getDragonCombatBonuses\(dragon\)/);
 assert.match(worker,/dragonDefenseBonusPercent:getDragonCombatBonuses\(dragon\)/);
 assert.match(game,/heroAttackBonusPercent\) \|\| 0, 0, 20/);
 assert.match(game,/dragonAttackBonusPercent\) \|\| 0, 0, 5\.5/);
 for(const id of ["dragonCollection","kingdomMailbox","kingdomBackpack"])assert.ok(page.includes('id="'+id+'"'));
});

test("beta dragon progression binds key and level, and rejects replay",async()=>{
 const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 const page=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
 const start=worker.indexOf('type==="dragon_upgrade"');
 const end=worker.indexOf('type==="hero_summon"',start);
 assert.ok(start>=0&&end>start);
 const action=worker.slice(start,end);
 assert.match(action,/body\.expectedLevel!==level\|\|body\.dragonKey!==dragonKey/);
 assert.match(action,/level=\? AND dragon_key=\? AND changes\(\)=1/);
 assert.match(action,/INSERT INTO kingdom_events.*WHERE changes\(\)=1/);
 assert.match(page,/type:"dragon_upgrade",dragonKey:dragon\.key,expectedLevel:level/);
});
