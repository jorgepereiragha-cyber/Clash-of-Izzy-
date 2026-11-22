import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 THRONE_SHIELD_DAYS,THRONE_PREPARATION_HOURS,THRONE_CONTEST_HOURS,THRONE_CYCLE_DAYS,THRONE_HOLD_MINUTES,
 throneTimeline,validateThroneArmy,throneCombat,mayCoronate,thronePublicView,assaultThrone
} from "../throne-war.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const origin="2026-11-01T00:00:00Z";
const day=86400000;
const at=(days,hours=0)=>new Date(Date.parse(origin)+days*day+hours*3600000);

test("escudo 35 dias por mapa; 24h de preparação ainda protegidas",()=>{
 assert.equal(THRONE_SHIELD_DAYS,35);
 assert.equal(THRONE_PREPARATION_HOURS,24);
 assert.equal(THRONE_CONTEST_HOURS,8);
 assert.equal(THRONE_CYCLE_DAYS,7);
 assert.equal(THRONE_HOLD_MINUTES,30);
 assert.deepEqual([at(0),at(33),at(34,0)].map(t=>throneTimeline(origin,t).phase),["shield","shield","preparation"]);
 assert.equal(throneTimeline(origin,at(34,23)).shielded,true);
 assert.equal(throneTimeline(origin,at(35)).phase,"contest");
 assert.equal(throneTimeline(origin,at(35)).shielded,false);
 assert.equal(throneTimeline(origin,at(35,8)).phase,"recovery");
 assert.equal(throneTimeline(origin,at(42)).phase,"contest");
 assert.equal(throneTimeline(origin,at(42)).cycle,1);
 assert.equal(throneTimeline(origin,at(35)).contestEndsAt,at(35,8).toISOString());
 assert.equal(throneTimeline(origin,at(35)).remainingSeconds,8*3600);
 assert.throws(()=>throneTimeline("invalid",at(35)));
});

test("ocupação 30 minutos coroa só antes do fim da etapa de disputa",()=>{
 const row={occupation_cycle:0,occupying_alliance_id:7,occupied_since:at(35,1).toISOString(),crowned_cycle:null};
 assert.equal(mayCoronate(row,origin,at(35,1.4)),false);
 assert.equal(mayCoronate(row,origin,at(35,1.5)),true);
 assert.equal(mayCoronate({...row,crowned_cycle:0},origin,at(35,2)),false);
 assert.equal(mayCoronate({...row,occupied_since:at(35,7.8).toISOString()},origin,at(35,8.5)),false);
 assert.equal(mayCoronate({...row,occupying_alliance_id:null},origin,at(35,2)),false);
});

test("formação usa somente tipos válidos e limites de 200-10000 tropas",()=>{
 const v=validateThroneArmy({militia:100,swordsman:100,knight:300});
 assert.equal(v.quantity,500);
 assert.equal(v.power,100+300+2400);
 for(const army of [{militia:199},{militia:10001},{fake_unit:1000},{militia:-100},
   {militia:100.5},[],{},null,{"__proto__":1}]){
  assert.throws(()=>validateThroneArmy(army));
 }
 const won=throneCombat(2400,1200);
 assert.equal(won.won,true);
 assert.equal(throneCombat(1100,1200).won,false);
 assert.throws(()=>throneCombat(NaN,1200));
});

test("estado público separa mapa protegido, ocupante e monarca sem revelar tokens",()=>{
 const view=thronePublicView({realm_id:2,unlocked_at:origin},{
   territory_id:12,occupation_cycle:0,occupying_alliance_id:4,
   occupant_alliance_tag:"IZZ",occupied_since:at(35,1).toISOString(),
   crowned_cycle:0,crowned_alliance_id:4,king_alliance_tag:"IZZ",
   kingdom_name:"Reino do Rei"
 },at(35,2));
 assert.equal(view.realmId,2);
 assert.equal(view.phase,"contest");
 assert.equal(view.shielded,false);
 assert.equal(view.occupantAllianceTag,"IZZ");
 assert.equal(view.kingAllianceId,4);
 assert.equal(view.holdRequiredMinutes,30);
 assert.equal(view.minimumCastleLevel,10);
 assert.equal(thronePublicView({realm_id:2,unlocked_at:origin},{},at(20)).status,"protected");
});

function fakeDb(row,membership={alliance_id:10},captureResult=true){
 const calls=[];
 const make=sql=>({
  bind(...args){return {
    first:async()=>sql.includes("FROM realm_openings r JOIN realm_thrones t")?row:
      sql.includes("FROM alliance_members am")?membership:null,
    run:async()=>({meta:{changes:1}}),
    all:async()=>({results:[]}),
    args
   }},
   sql
 });
 return {calls,
  DB:{
   prepare(sql){calls.push(sql);return make(sql);},
   async batch(statements){calls.push("BATCH");
     return [{meta:{changes:1}},{meta:{changes:captureResult?1:0}},
       {meta:{changes:1}},{meta:{changes:1}}];
   }
  }
 };
}
test("cerco é bloqueado durante 35 dias e por requisitos de aliança, castelo e tropas",async()=>{
 const row={realm_id:1,unlocked_at:origin,territory_id:3,revision:0,crowned_cycle:null,
   crowned_alliance_id:null,occupation_cycle:null,occupying_alliance_id:null};
 const data={units:{militia:200},requestId:"00000000-0000-4000-8000-000000000001"};
 const shield=await assaultThrone(fakeDb(row),{id:8,map_region:1,castle_level:10},data,at(20));
 assert.equal(shield.ok,false);assert.equal(shield.status,409);
 assert.match(shield.error,/protegido/i);
 const low=await assaultThrone(fakeDb(row),{id:8,map_region:1,castle_level:9},data,at(35));
 assert.equal(low.ok,false);assert.match(low.error,/Castelo nível 10/);
 const noAlliance=await assaultThrone(fakeDb(row,null),{id:8,map_region:1,castle_level:10},data,at(35));
 assert.equal(noAlliance.ok,false);assert.match(noAlliance.error,/aliança/);
 const badId=await assaultThrone(fakeDb(row),{id:8,map_region:1,castle_level:10},{...data,requestId:"repeat"},at(35));
 assert.equal(badId.status,400);
 const occupied=await assaultThrone(fakeDb({...row,occupation_cycle:0,occupying_alliance_id:10}),
   {id:8,map_region:1,castle_level:10},data,at(35,1));
 assert.equal(occupied.ok,false);assert.match(occupied.error,/já ocupa/);
 const crowned=await assaultThrone(fakeDb({...row,crowned_cycle:0,crowned_alliance_id:11}),
   {id:8,map_region:1,castle_level:10},data,at(35,1));
 assert.equal(crowned.ok,false);assert.match(crowned.error,/já foi conquistado/);
});

test("cerco válido usa um D1 batch transacional de perda, tentativa, ocupação e relatório",async()=>{
 const row={realm_id:1,unlocked_at:origin,territory_id:3,revision:0,crowned_cycle:null,
   crowned_alliance_id:null,occupation_cycle:null,occupying_alliance_id:null};
 const db=fakeDb(row);
 const result=await assaultThrone(db,{id:8,map_region:1,castle_level:10},
   {units:{knight:200},requestId:"00000000-0000-4000-8000-000000000001"},at(35));
 assert.equal(result.ok,true);
 assert.equal(result.combat.won,true);
 assert.equal(result.combat.losses.knight,24);
 assert.equal(db.calls.filter(x=>x==="BATCH").length,1);
 assert.ok(db.calls.some(sql=>sql.includes("NOT EXISTS(SELECT 1 FROM throne_assaults WHERE kingdom_id=?")));
 assert.ok(db.calls.some(sql=>sql.includes("created_at>datetime('now','-5 minutes')")));
 assert.ok(db.calls.some(sql=>sql.includes("AND t.revision=?")));
 const guarded=await assaultThrone(fakeDb(row,{alliance_id:11},false),
   {id:8,map_region:1,castle_level:10},
   {units:{militia:200},requestId:"00000000-0000-4000-8000-000000000002"},at(35));
 assert.equal(guarded.ok,false);
 assert.equal(guarded.status,409);
});

test("modelo 3D e mapa exibem Trono sem liberar marcha comum ou captura de território",async()=>{
 const [worker,ui,three,migration,preflight,flow]=await Promise.all([
  read("worker.js"),read("world-map.js"),read("world-map-3d.js"),
  read("migrations/0035_throne_war.sql"),
  read("scripts/cloudflare-remote-audit.mjs"),read(".github/workflows/deploy-cloudflare.yml")
 ]);
 assert.match(worker,/\/api\/throne\/status/);
 assert.match(worker,/assaultThrone\(env,k,body\)/);
 assert.match(worker,/realm_thrones","throne_assaults/);
 assert.match(worker,/Trono Imperial exige Guerra do Trono/);
 assert.match(worker,/não pode ser reivindicado fora da Guerra do Trono/);
 assert.match(worker,/territory_key NOT LIKE 'royal_throne_%'/);
 assert.match(worker,/CASE WHEN wt\.territory_key LIKE 'royal_throne_%' THEN 'throne'/);
 assert.match(ui,/id/); // Presence of module is checked below with meaningful patterns.
 assert.match(ui,/request\("\/throne\/status\?realm="/);
 assert.match(ui,/sendThroneAssault/);
 assert.match(three,/createRoyalThrone/);
 assert.match(migration,/realm_thrones/);
 assert.match(migration,/throne_assaults/);
 assert.match(migration,/'\+35 days'/);
 assert.match(migration,/royal_throne_/);
 assert.match(preflight,/allowPending0035/);
 assert.match(flow,/COI_ALLOW_PENDING_0035: "true"/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM kingdoms/i);
});
