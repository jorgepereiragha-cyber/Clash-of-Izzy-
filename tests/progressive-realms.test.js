import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {eligibleRealmForPopulation,getRealmCoordinates,realmStatusView,REALM_THRESHOLDS,REALM_NAMES} from "../realm-progression.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("desbloqueio irreversível: mapa 1, mapa 2 após 700, mapa 3 após 1000 reinos",()=>{
  assert.deepEqual(REALM_THRESHOLDS,[0,700,1000]);
  assert.equal(REALM_NAMES.length,3);
  for(const n of [0,1,399,400,699])assert.equal(eligibleRealmForPopulation(n),1);
  for(const n of [700,701,999])assert.equal(eligibleRealmForPopulation(n),2);
  for(const n of [1000,1001,10000])assert.equal(eligibleRealmForPopulation(n),3);
  for(const n of [-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+10]){
    assert.throws(()=>eligibleRealmForPopulation(n),RangeError);
  }
});

test("slots por mapa são únicos e não movem jogadores existentes do mapa 1",()=>{
  const all=new Set();
  for(let realm=1;realm<=3;realm++){
    for(let slot=0;slot<1200;slot++){
      const p=getRealmCoordinates(slot,realm);
      assert.equal(p.mapRegion,realm);
      const key=[p.mapRegion,p.mapX,p.mapZ].join("/");
      assert.ok(!all.has(key),"duplicado "+key);
      all.add(key);
    }
  }
  assert.deepEqual(getRealmCoordinates(0,2),{mapRegion:2,mapSlot:0,mapX:-50,mapZ:-50});
  assert.deepEqual(getRealmCoordinates(0,3),{mapRegion:3,mapSlot:0,mapX:-50,mapZ:-50});
  for(const args of [[-1,1],[0,0],[0,4],[1.5,1]])assert.throws(()=>getRealmCoordinates(...args));
});

test("endpoint distingue desbloqueio salvo de total atual sem fechar mapa liberado",()=>{
  const v=realmStatusView(699,[1],{1:699},1);
  assert.equal(v.realms[0].open,true);
  assert.equal(v.realms[1].open,false);
  assert.equal(v.realms[1].playersRemaining,1);
  assert.equal(v.realms[2].playersRemaining,301);
  const reached=realmStatusView(700,[1,2],{1:700},1);
  assert.equal(reached.realms[1].open,true);
  assert.equal(reached.realms[1].playersRemaining,0);
  assert.equal(reached.realms[2].open,false);
  const three=realmStatusView(1000,[1,2,3],{1:700,2:300},2);
  assert.equal(three.realms[2].open,true);
  assert.equal(three.realms[2].inhabitants,0);
  assert.equal(three.currentRealm,2);
  assert.equal(realmStatusView(950,[1,2,3],{},3).realms[2].open,true);
  assert.deepEqual(Object.keys(three),["registeredPlayers","counting","currentRealm","realms"]);
});

test("migration 0034 adiciona slots, índice único, regiões por território e histórico persistente",async()=>{
  const sql=await read("migrations/0034_progressive_realms.sql");
  assert.match(sql,/ALTER TABLE kingdoms ADD COLUMN map_slot/);
  assert.match(sql,/UPDATE kingdoms SET map_slot=id-1/);
  assert.match(sql,/UNIQUE INDEX IF NOT EXISTS idx_kingdoms_region_slot/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS realm_openings/);
  assert.match(sql,/SELECT 2 WHERE \(SELECT COUNT\(\*\) FROM kingdoms\)>=700/);
  assert.match(sql,/SELECT 3 WHERE \(SELECT COUNT\(\*\) FROM kingdoms\)>=1000/);
  assert.match(sql,/ALTER TABLE world_territories ADD COLUMN map_region/);
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM (?:players|kingdoms|world_territories)/i);
});

test("servidor cria um reino no mundo mais recente em INSERT único e nunca cruza a fronteira",async()=>{
  const worker=await read("worker.js");
  assert.match(worker,/INSERT INTO kingdoms\(player_id,kingdom_name,food,wood,stone,iron,gold,last_production_at,map_region,map_slot,map_x,map_z\)/);
  assert.match(worker,/MAX\(map_slot\)\+1/);
  assert.match(worker,/INSERT OR IGNORE INTO realm_openings\(realm_id\) SELECT 2/);
  assert.match(worker,/INSERT OR IGNORE INTO realm_openings\(realm_id\) SELECT 3/);
  assert.match(worker,/WHERE wt\.map_region=\?/);
  assert.match(worker,/AND map_region=\?"\)\.bind\(targetId,Number\(k\.map_region\)\|\|1\)/);
  assert.match(worker,/AND map_region=\?"\)\.bind\(territoryId,Number\(k\.map_region\)\|\|1\)/);
  assert.match(worker,/seedWorld\(env,Number\(kingdom\.map_region\)\|\|1\)/);
  assert.match(worker,/\/api\/realms\/status/);
  assert.match(worker,/\"realm_openings\"/);
});

test("UI mostra três mapas e status do servidor sem permitir troca clandestina de mundo",async()=>{
  const [page,client]=await Promise.all([read("world.html"),read("world-map.js")]);
  assert.match(page,/id="realmGrid"/);
  assert.match(page,/id="realmStatus"/);
  assert.match(client,/request\("\/realms\/status"\)/);
  assert.match(client,/Bloqueado · faltam/);
  assert.match(client,/realm\.open/);
  assert.doesNotMatch(client,/request\("\/realms\/switch"/);
});

test("preflight de D1 0034 permanece protegido e saúde pós-deploy inclui a nova tabela",async()=>{
  const [flow,worker]=await Promise.all([read(".github/workflows/deploy-cloudflare.yml"),read("worker.js")]);
  assert.match(flow,/COI_ALLOW_PENDING_0034: "true"/);
  assert.match(worker,/missingTables=requiredTables\.filter/);
  assert.match(worker,/\"realm_openings\"/);
  const post=flow.slice(flow.indexOf("Verify live D1 schema and Android API contract after Worker deploy"));
  assert.doesNotMatch(post,/COI_ALLOW_PENDING_0034:/);
});
