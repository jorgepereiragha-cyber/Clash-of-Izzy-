import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {calculateChainProduction} from "../intermediate-production.js";
import {progressionFromXp,requiredXpForLevel,queueProgressionXp} from "../player-progression-4x.js";
import {DEFENSE_CATALOG,defenseLimit,validateDefensePlacement,defensePowerFromRows} from "../city-defense-rules.js";
import {validateCityPlacement} from "../city-layout-rules.js";

const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("produção completa 1h: trigo -> farinha -> comida sem criação dupla",()=>{
  const t=calculateChainProduction({elapsedSeconds:3600,foodFreeSpace:100});
  assert.deepEqual([t.harvestedWheat,t.processedWheat,t.food,t.wheat,t.flour],[12,12,12,0,0]);
  assert.deepEqual(calculateChainProduction({elapsedSeconds:0,foodFreeSpace:100}),{
    wheat:0,flour:0,food:0,processedWheat:0,harvestedWheat:0,remainders:{wheat:0,mill:0,bakery:0}
  });
});
test("multiplicador zero não cria trigo, farinha nem comida",()=>{
  const paused=calculateChainProduction({
    elapsedSeconds:3600,multiplier:0,foodFreeSpace:100,wheat:4,flour:6
  });
  assert.deepEqual([paused.harvestedWheat,paused.processedWheat,paused.food,paused.wheat,paused.flour],[0,0,0,4,6]);
  const half=calculateChainProduction({elapsedSeconds:3600,multiplier:0.5,foodFreeSpace:100});
  assert.deepEqual([half.harvestedWheat,half.processedWheat,half.food],[6,6,6]);
});
test("capacidade dos processadores limita a cadeia; estoques e frações persistem",()=>{
  const wheat=calculateChainProduction({elapsedSeconds:3600,farmLevel:3,millLevel:1,bakeryLevel:1,foodFreeSpace:100});
  assert.equal(wheat.wheat,24);assert.equal(wheat.flour,0);assert.equal(wheat.food,12);
  const flour=calculateChainProduction({elapsedSeconds:3600,farmLevel:3,millLevel:3,bakeryLevel:1,foodFreeSpace:100});
  assert.equal(flour.flour,24);assert.equal(flour.food,12);
  const full=calculateChainProduction({elapsedSeconds:3600,foodFreeSpace:0});
  assert.equal(full.food,0);assert.equal(full.flour,12);
  const tiny=calculateChainProduction({elapsedSeconds:30,foodFreeSpace:100});
  assert.equal(tiny.food,0);assert.equal(tiny.remainders.wheat,360);
  const rest=calculateChainProduction({elapsedSeconds:270,foodFreeSpace:100,remainders:tiny.remainders});
  assert.equal(rest.food,1);
});
test("80 níveis correspondem exatamente a P1-P8; VIP é separado",()=>{
  for(let l=1;l<=80;l++){
    const s=progressionFromXp(requiredXpForLevel(l));
    assert.equal(s.level,l);
    assert.equal(s.phase,"P"+Math.ceil(l/10));
    assert.deepEqual(s.bonuses,{attackPercent:0,defensePercent:0,productionPercent:0});
  }
  assert.equal(progressionFromXp(1e8).level,80);
  assert.equal(progressionFromXp(-100).level,1);
  assert.equal(queueProgressionXp({queue_type:"construction",to_level:3}),300);
  assert.equal(queueProgressionXp({queue_type:"training",quantity:10}),50);
  assert.equal(queueProgressionXp({queue_type:"research",to_level:2}),150);
});
test("defesas respeitam grid, construções legadas, outras defesas e limites",()=>{
  const buildings=[{building_type:"castle",position_x:-10.5,position_z:-7}];
  const defenses=[{id:7,defense_type:"tower",grid_x:5,grid_z:5,width:2,height:2,level:1}];
  assert.equal(validateDefensePlacement(buildings,defenses,"trap",0,0),true);
  assert.equal(validateDefensePlacement(buildings,defenses,"trap",5,5),false);
  assert.equal(validateDefensePlacement(buildings,defenses,"tower",-10,-7),false);
  assert.equal(validateDefensePlacement(buildings,defenses,"gate",23,0),false);
  assert.equal(validateDefensePlacement(buildings,defenses,"tower",24,24),false);
  assert.equal(validateDefensePlacement(buildings,defenses,"trap",5,5,7),true);
  assert.equal(validateCityPlacement(buildings,"farm",5,5,defenses),false);
  assert.ok(defenseLimit("tower",30)>defenseLimit("tower",5));
  assert.equal(defensePowerFromRows([{defense_type:"tower",level:1}]),DEFENSE_CATALOG.tower.power);
});
test("0041 é aditiva, preserva a fonte real e mantém XP server-authoritative",async()=>{
  const migration=await read("migrations/0041_4x_industries_defenses_progression.sql");
  for(const table of ["intermediate_resources","city_defenses","kingdom_progression","progression_xp_ledger"])
    assert.match(migration,new RegExp("CREATE TABLE IF NOT EXISTS "+table));
  assert.doesNotMatch(migration,/\bDROP TABLE\b|\bDELETE FROM\b|ALTER TABLE/i);
  assert.match(migration,/UNIQUE\(kingdom_id,source_key\)/);
  const worker=await read("worker.js"),rules=await read("city-layout-rules.js");
  assert.match(worker,/advanced4xEnabled\(env\)\?0:12\*\(levels\.farm/);
  assert.match(worker,/calculateChainProduction\(/);
  assert.match(worker,/WHERE kingdom_id=\? AND changes\(\)=1/);
  assert.match(worker,/type==="city_defense_place"/);
  assert.match(worker,/progressionQueueStatements/);
  assert.match(rules,/AND NOT EXISTS\(SELECT 1 FROM city_defenses/);
});
test("Three.js e UI reutilizam renderer e contratos existentes",async()=>{
  const [renderer,kingdom,ui]=await Promise.all([
    read("scripts/kingdom-3d.js"),read("kingdom.html"),read("scripts/kingdom-4x-systems.js")
  ]);
  assert.match(renderer,/function renderCityDefenses/);
  assert.match(renderer,/function updateDefensePreview/);
  assert.match(renderer,/coi:defense-preview/);
  assert.match(kingdom,/__coiKingdomDefenses/);
  assert.match(kingdom,/id="coiFourXPanel"/);
  assert.match(ui,/window\.__coi4xAction/);
  assert.match(ui,/city_defense_place/);
});
