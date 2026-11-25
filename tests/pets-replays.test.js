import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculatePetProgress } from "../pets.js";
import { simulateBattle } from "../game-adapter.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("migration adiciona pets por reino e mantém equipamento canônico", async () => {
  const migration = await read("migrations/0022_pets_and_battle_replays.sql");
  const worker = await read("worker.js");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pet_catalog/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS kingdom_pets/);
  assert.match(migration, /idx_kingdom_pets_one_active/);
  assert.match(migration, /kingdom_pet_feed_requests/);
  assert.match(migration, /INSERT OR IGNORE INTO kingdom_pets[\s\S]*SELECT id,'pet_raven'/);
  assert.match(migration, /ALTER TABLE battle_reports[\s\S]*replay_json/);
  assert.match(migration, /604800/);
  assert.match(worker, /kingdom_equipment/);
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS (equipment_catalog|player_equipment|player_materials)/);
});

test("progressão de mascotes sobe níveis e preserva experiência excedente", () => {
  assert.deepEqual(calculatePetProgress(1, 95, 10), { level: 2, experience: 5 });
  assert.deepEqual(calculatePetProgress(1, 0, 305), { level: 3, experience: 5 });
  assert.deepEqual(calculatePetProgress(50, 20, 100), { level: 50, experience: 120 });
});

test("passiva de Fenrir aumenta apenas o poder da infantaria", () => {
  const army = [{ unit_type: "militia", tier: 1, quantity: 500 }];
  const base = simulateBattle({ army, defenderLevel: 1, criticalSeed: 123, roll: 1 });
  const boosted = simulateBattle({
    army, defenderLevel: 1, criticalSeed: 123, roll: 1, infantryAttackBonusPercent: 8
  });
  assert.ok(boosted.attackerPower > base.attackerPower);
  const ranged = [{ unit_type: "archer", tier: 1, quantity: 500 }];
  const rangedBase = simulateBattle({ army: ranged, defenderLevel: 1, criticalSeed: 123, roll: 1 });
  const rangedBoosted = simulateBattle({
    army: ranged, defenderLevel: 1, criticalSeed: 123, roll: 1, infantryAttackBonusPercent: 8
  });
  assert.equal(rangedBoosted.attackerPower, rangedBase.attackerPower);
});

test("Worker liga pets, produção, marcha, combate e replay com autenticação", async () => {
  const worker = await read("worker.js");
  const rally = await read("rally.js");
  const replay = await read("battle-replay.js");
  const page = await read("kingdom.html");
  assert.match(page, /id="petsList"/);
  assert.match(page, /id="battleReplayList"/);
  assert.match(page, /data-pet-feed/);
  assert.match(page, /Assistir replay/);
  assert.match(worker, /handlePetsRoute/);
  assert.match(worker, /getBattleReplay/);
  assert.match(worker, /getPetBonuses\(env,kingdomId\)/);
  assert.match(worker, /resourceProductionMultiplier/);
  assert.match(worker, /infantryAttackBonusPercent/);
  assert.match(worker, /has_replay/);
  assert.match(worker, /replay_expires_at<=\?/);
  assert.match(rally, /getPetBonuses/);
  assert.match(replay, /br\.attacker_kingdom_id=mine\.id OR br\.defender_kingdom_id=mine\.id/);
  assert.match(replay, /replay_expires_at>unixepoch\(\)/);
});

test("alimentação tem request_key e grava a deduplicação no D1", async () => {
  const pets = await read("pets.js");
  const migration = await read("migrations/0022_pets_and_battle_replays.sql");
  assert.match(pets, /request_key obrigatório/);
  assert.match(migration, /UNIQUE \(kingdom_id,request_key\)/);
  assert.match(pets, /kingdom_pet_feed_requests/);
  assert.match(pets, /changes\(\)>0/);
});

test("mascote desativado não consome ouro nem substitui o mascote ativo, inclusive durante uma operação",async()=>{
  const {DatabaseSync}=await import("node:sqlite");
  const {handlePetsRoute}=await import("../pets.js");
  const db=new DatabaseSync(":memory:");
  try{
    db.exec(`
      CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT);
      CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,gold INTEGER,updated_at TEXT);
      CREATE TABLE pet_catalog(id TEXT PRIMARY KEY,name TEXT,active INTEGER,unlock_cost_gold INTEGER,base_skill_json TEXT);
      CREATE TABLE kingdom_pets(kingdom_id INTEGER,pet_id TEXT,level INTEGER,experience INTEGER,is_active INTEGER,updated_at INTEGER,UNIQUE(kingdom_id,pet_id));
      CREATE UNIQUE INDEX one_active ON kingdom_pets(kingdom_id) WHERE is_active=1;
      CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
      CREATE TABLE kingdom_pet_feed_requests(kingdom_id INTEGER,request_key TEXT,pet_id TEXT,food_amount INTEGER,gold_spent INTEGER,exp_gained INTEGER,level_after INTEGER,experience_after INTEGER,UNIQUE(kingdom_id,request_key));
      INSERT INTO players VALUES(1,'public');
      INSERT INTO kingdoms VALUES(10,1,10000,NULL);
      INSERT INTO pet_catalog VALUES('pet_raven','Raven',1,0,'{}'),('pet_wolf','Wolf',0,100,'{}'),('pet_dragon','Dragon',1,100,'{}');
      INSERT INTO kingdom_pets VALUES(10,'pet_raven',1,0,1,0),(10,'pet_wolf',1,0,0,0);
    `);
    let disableBeforeBatch=null;
    const adapter={prepare(sql){return {bind(...args){return {sql,args,first:async()=>db.prepare(sql).get(...args)||null}}}},async batch(statements){
      if(disableBeforeBatch){db.prepare("UPDATE pet_catalog SET active=0 WHERE id=?").run(disableBeforeBatch);disableBeforeBatch=null;}
      db.exec("BEGIN");
      try{const result=statements.map(({sql,args})=>({meta:{changes:db.prepare(sql).run(...args).changes}}));db.exec("COMMIT");return result;}
      catch(error){db.exec("ROLLBACK");throw error;}
    }};
    const call=(path,body)=>handlePetsRoute({method:"POST"},{DB:adapter},"public",path,body);
    const feed={pet_id:"pet_wolf",food_amount:5,request_key:"request_1234567890"};
    assert.equal((await call("feed",feed)).status,404);
    assert.equal((await call("activate",{pet_id:"pet_wolf"})).status,404);
    db.exec("UPDATE pet_catalog SET active=1 WHERE id='pet_wolf'");
    disableBeforeBatch="pet_wolf";
    assert.equal((await call("feed",feed)).status,409);
    db.exec("UPDATE pet_catalog SET active=1 WHERE id='pet_wolf'");
    disableBeforeBatch="pet_wolf";
    assert.equal((await call("activate",{pet_id:"pet_wolf"})).status,409);
    disableBeforeBatch="pet_dragon";
    assert.equal((await call("unlock",{pet_id:"pet_dragon"})).status,409);
    assert.equal(db.prepare("SELECT gold FROM kingdoms").get().gold,10000);
    assert.equal(db.prepare("SELECT pet_id FROM kingdom_pets WHERE is_active=1").get().pet_id,"pet_raven");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_pet_feed_requests").get().n,0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_pets").get().n,2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events").get().n,0);
    // Re-selecting the active pet is a successful no-op, including parallel requests.
    const repeated=await Promise.all(Array.from({length:4},()=>call("activate",{pet_id:"pet_raven"})));
    assert.ok(repeated.every(r=>r.status===200));
    for(const response of repeated)assert.equal((await response.json()).replayed,true);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events").get().n,0);
    db.exec("UPDATE pet_catalog SET active=1 WHERE id='pet_wolf'");
    const switches=await Promise.all(Array.from({length:4},()=>call("activate",{pet_id:"pet_wolf"})));
    assert.ok(switches.every(r=>r.status===200));
    const bodies=await Promise.all(switches.map(r=>r.json()));
    assert.equal(bodies.filter(r=>!r.replayed).length,1);
    assert.equal(db.prepare("SELECT pet_id FROM kingdom_pets WHERE is_active=1").get().pet_id,"pet_wolf");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events WHERE event_type='pet_activated'").get().n,1);
  }finally{db.close();}
});
