import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CASTLE_MAX_LEVEL,CASTLE_VIP_MAX_LEVEL,CASTLE_VIP_GEM_COSTS,castleVipLevel,getCastleVipBonuses,getCastleVipState} from "../castle-vip.js";

test("castelo normal vai até 30 e só então libera VIP 1 até VIP 7",()=>{
 assert.equal(CASTLE_MAX_LEVEL,30);
 assert.equal(CASTLE_VIP_MAX_LEVEL,7);
 assert.equal(CASTLE_VIP_GEM_COSTS.length,7);
 assert.equal(new Set(CASTLE_VIP_GEM_COSTS).size,7);
 for(let level=1;level<=29;level++){
  const state=getCastleVipState({castle_level:level,prestige:0});
  assert.equal(state.eligible,false);
  assert.equal(state.next.level,1);
 }
 const maxed=getCastleVipState({castle_level:30,prestige:0});
 assert.equal(maxed.eligible,true);
 assert.equal(maxed.next.level,1);
 assert.equal(maxed.next.gemCost,1000);
 assert.equal(maxed.castleLevel,30);
 const final=getCastleVipState({castle_level:30,prestige:7});
 assert.equal(final.level,7);
 assert.equal(final.eligible,false);
 assert.equal(final.completed,true);
 assert.equal(final.next,null);
});
test("VIP do castelo reaproveita prestígio legado sem zerar níveis",()=>{
 assert.equal(castleVipLevel(-10),0);
 assert.equal(castleVipLevel(999),7);
 assert.equal(castleVipLevel("inválido"),0);
 for(let level=0;level<=7;level++){
  const s=getCastleVipState({castle_level:30,prestige:level});
  assert.equal(s.level,level);
  assert.equal(s.bonuses.productionPercent,level*10);
  assert.equal(s.bonuses.attackPercent,level*.5);
  assert.equal(s.bonuses.defensePercent,level);
  if(level<7)assert.equal(s.next.gemCost,CASTLE_VIP_GEM_COSTS[level]);
 }
 // Contas que já haviam reiniciado o castelo após um prestígio não perdem esse nível.
 const legacy=getCastleVipState({castle_level:14,prestige:3});
 assert.equal(legacy.level,3);
 assert.equal(legacy.castleLevel,14);
 assert.equal(legacy.eligible,false);
 assert.deepEqual(getCastleVipBonuses(7),{productionPercent:70,attackPercent:3.5,defensePercent:7});
});
test("Worker só evolui VIP com castelo 30 e comparação de nível, nunca reseta o castelo",async()=>{
 const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 const page=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
 const arena=await readFile(new URL("../arena.html",import.meta.url),"utf8");
 const adapter=await readFile(new URL("../game-adapter.js",import.meta.url),"utf8");
 const section=worker.slice(worker.indexOf('}else if(type==="castle_vip_upgrade"'),worker.indexOf('}else if(type==="upgrade"'));
 assert.ok(section.length>300);
 assert.match(section,/expectedVipLevel/);
 assert.match(section,/AND prestige=\? AND castle_level=30/);
 assert.match(section,/AND level=30/);
 assert.match(section,/UPDATE players SET gems=gems-\?/);
 assert.match(section,/changes\(\)=1/);
 assert.doesNotMatch(section,/SET level=1|castle_level=1/);
 assert.match(worker,/castleVip:getCastleVipState\(fresh\)/);
 assert.match(worker,/getCastleVipBonuses\(row.prestige\)/);
 assert.match(worker,/castleVipAttackBonusPercent:getCastleVipBonuses\(/);
 assert.match(adapter,/castleVipAttackBonusPercent/);
 assert.match(adapter,/castleVipDefenseBonusPercent/);
 assert.match(page,/id="castleVipProgress"/);
 assert.match(page,/type:"castle_vip_upgrade",expectedVipLevel/);
 assert.match(arena,/Próxima evolução VIP/);
});
