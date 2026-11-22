import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 THRONE_SHIELD_DAYS,THRONE_HOLD_MINUTES,THRONE_PREPARATION_HOURS,
 THRONE_CONTEST_HOURS,THRONE_RECOVERY_DAYS,THRONE_NPC_POWER,
 thronePhase,throneTimestamp,canCrownThrone,thronePowerForArmy,resolveThroneSiege
} from "../throne-war-rules.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const opening="2026-01-01T00:00:00.000Z";
const T=Date.parse(opening);
const DAY=86400000,HOUR=3600000;

test("escudo 35 dias exatos por mapa e bloqueio antes da abertura",()=>{
 assert.equal(THRONE_SHIELD_DAYS,35);
 assert.equal(THRONE_HOLD_MINUTES,150);
 assert.equal(THRONE_PREPARATION_HOURS,24);
 assert.equal(THRONE_CONTEST_HOURS,24);
 assert.equal(THRONE_RECOVERY_DAYS,7);
 for(const elapsed of [0,34*DAY,35*DAY-1]){
   const phase=thronePhase(opening,T+elapsed);
   assert.equal(phase.phase,"shield");
   assert.equal(phase.canAttack,false);
   assert.equal(phase.roundId,0);
 }
 assert.equal(thronePhase(opening,T+35*DAY).phase,"preparation");
 assert.equal(thronePhase(opening,T+36*DAY-1).phase,"preparation");
 const contest=thronePhase(opening,T+36*DAY);
 assert.equal(contest.phase,"contest");
 assert.equal(contest.canAttack,true);
 assert.equal(contest.roundId,1);
 assert.equal(thronePhase(opening,T+37*DAY).phase,"recovery");
 assert.equal(thronePhase(opening,T+44*DAY).phase,"preparation");
 assert.equal(thronePhase(opening,T+45*DAY).roundId,2);
 assert.throws(()=>thronePhase(opening,T-1),RangeError);
 assert.throws(()=>thronePhase("não é data",T),RangeError);
 assert.equal(throneTimestamp("2026-01-01 00:00:00"),T);
 assert.equal(throneTimestamp(opening),T);
});

test("ocupação contínua de 150 minutos; reiniciar com uma nova aliança",()=>{
 const battleStart=T+36*DAY+1000;
 const contestEnd=new Date(T+37*DAY).toISOString();
 const start=new Date(battleStart).toISOString();
 assert.equal(canCrownThrone({heldSince:start,contestUntil:contestEnd,now:battleStart+149*60000}),false);
 assert.equal(canCrownThrone({heldSince:start,contestUntil:contestEnd,now:battleStart+150*60000}),true);
 assert.equal(canCrownThrone({heldSince:new Date(T+37*DAY-140*60000).toISOString(),
   contestUntil:contestEnd,now:T+37*DAY+10000}),false);
 assert.equal(canCrownThrone({heldSince:start,contestUntil:contestEnd,now:battleStart}),false);
});

test("guarda inicial, conquista, reforço, redução de guarnição e troca de ocupante",()=>{
 const units={militia:{power:2},knight:{power:14}};
 assert.equal(THRONE_NPC_POWER,250);
 assert.deepEqual(thronePowerForArmy("militia",100,units),{power:200,casualties:5});
 assert.deepEqual(thronePowerForArmy("knight",100,units),{power:1400,casualties:5});
 for(const value of [0,-1,5001,1.2,NaN,"10.2"])assert.throws(()=>thronePowerForArmy("militia",value,units));
 assert.throws(()=>thronePowerForArmy("dragon",3,units));
 const now=T+36*DAY;
 assert.equal(resolveThroneSiege(null,3,7,200,now).result,"npc_defended");
 const captured=resolveThroneSiege(null,3,7,500,now);
 assert.equal(captured.result,"captured");
 assert.equal(captured.holdingAllianceId,3);
 const old={holding_alliance_id:3,holding_kingdom_id:7,garrison_power:500,held_since:captured.heldSince};
 const reinforced=resolveThroneSiege(old,3,8,200,now+1000);
 assert.equal(reinforced.result,"reinforced");
 assert.equal(reinforced.heldSince,old.held_since);
 assert.equal(reinforced.garrisonPower,700);
 const defended=resolveThroneSiege(old,9,11,100,now+2000);
 assert.equal(defended.result,"defended");
 assert.equal(defended.garrisonPower,400);
 assert.equal(defended.heldSince,old.held_since);
 const switched=resolveThroneSiege(old,9,11,600,now+3000);
 assert.equal(switched.result,"captured");
 assert.equal(switched.holdingAllianceId,9);
 assert.equal(switched.holdingKingdomId,11);
 assert.notEqual(switched.heldSince,old.held_since);
});

test("schema 0035 cria trono em cada mapa liberado, escudo, coroações e idempotência",async()=>{
 const sql=await read("migrations/0035_throne_war.sql");
 for(const part of [
  "CREATE TABLE IF NOT EXISTS throne_sieges",
  "CREATE TABLE IF NOT EXISTS throne_crowns",
  "CREATE TABLE IF NOT EXISTS throne_siege_actions",
  "action_id TEXT PRIMARY KEY",
  "PRIMARY KEY(realm_id,round_id)",
  "'royal_throne_realm_'||realm_id",
  "datetime(unlocked_at,'+35 days')",
  "'throne',realm_id"
 ]) assert.ok(sql.includes(part),part);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM (players|kingdoms|world_territories)/i);
});

test("Worker exige autenticação e aliança, não aceita captura do trono por marcha comum",async()=>{
 const [worker,source,ignore]=await Promise.all([
   read("worker.js"),read("throne-war.js"),read(".assetsignore")
 ]);
 assert.match(worker,/\/api\/game\/throne"/);
 assert.match(worker,/\/api\/game\/throne\/action"/);
 assert.match(worker,/throneAction\(env,playerId,body,UNITS\)/);
 assert.match(worker,/territory\.territory_kind==="throne"|target\.territory_kind==="throne"/);
 assert.match(worker,/t\.territory_kind!=="resource"/);
 assert.match(worker,/territory_kind='resource' AND owner_kingdom_id IS NULL/);
 assert.match(worker,/\"throne_sieges","throne_crowns","throne_siege_actions"/);
 assert.match(source,/INSERT OR IGNORE INTO throne_siege_actions/);
 assert.match(source,/u\.quantity>=\?/);
 assert.match(source,/AND changes\(\)=1/);
 assert.match(source,/NOT EXISTS\(SELECT 1 FROM throne_crowns/);
 assert.match(source,/O Trono está sob escudo inicial de 35 dias/);
 assert.match(source,/O candidato precisa ser da aliança e do mesmo mapa/);
 assert.match(source,/throneStatus\(env,playerId,now\)/);
 assert.ok(ignore.split(/\r?\n/).includes("throne-war.js"));
 assert.ok(ignore.split(/\r?\n/).includes("throne-war-rules.js"));
});

test("trono 3D e interface apresentam guerra sem liberar ataque enquanto bloqueado",async()=>{
 const [page,client,world3d]=await Promise.all([
   read("world.html"),read("world-map.js"),read("world-map-3d.js")
 ]);
 for(const part of ["thronePanel","thronePhase","throneAttack","throneReinforce",
   "throneAppoint","throneUnit","throneQuantity","throneMessage"])
  assert.ok(page.includes('id="'+part+'"'),part);
 assert.match(client,/request\("\/game\/throne"\)/);
 assert.match(client,/request\("\/game\/throne\/action"/);
 assert.match(client,/throneState\.canAttack/);
 assert.match(client,/territory\.territory_kind === "throne"/);
 assert.match(world3d,/function createRoyalThrone/);
 assert.match(world3d,/territory\.territory_kind === "throne"/);
});

test("preflight D1 aceita 0035 apenas antes da migração, nunca no pós-deploy",async()=>{
 const [script,workflow]=await Promise.all([
  read("scripts/cloudflare-remote-audit.mjs"),read(".github/workflows/deploy-cloudflare.yml")
 ]);
 assert.match(script,/allowPending0035:process\.env\.COI_ALLOW_PENDING_0035==="true"/);
 assert.match(script,/tables:\["throne_sieges","throne_crowns","throne_siege_actions"\]/);
 assert.match(workflow,/COI_ALLOW_PENDING_0035: "true"/);
 const post=workflow.slice(workflow.indexOf("Verify live D1 schema and Android API contract after Worker deploy"));
 assert.doesNotMatch(post,/COI_ALLOW_PENDING_0035:/);
});
