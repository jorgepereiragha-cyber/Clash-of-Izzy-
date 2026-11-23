import test from "node:test";
import assert from "node:assert/strict";
import { simulateBattle, calculateMarchDuration, applyUnitLosses } from "../game-adapter.js";

test("rejeita exército vazio", () => {
  assert.throws(() => simulateBattle({ army: [] }), /Exército vazio/);
});

test("simulação retorna perdas limitadas ao tamanho do exército", () => {
  const result = simulateBattle({
    army: [
      { unit_type: "militia", tier: 1, quantity: 40 },
      { unit_type: "archer", tier: 1, quantity: 20 }
    ],
    castleLevel: 8,
    defenderLevel: 3,
    heroLevel: 4,
    dragonLevel: 2,
    researchLevel: 3,
    roll: 1
  });
  assert.equal(typeof result.won, "boolean");
  assert.ok(result.rounds >= 1 && result.rounds <= 30);
  assert.ok(result.losses.militia >= 0 && result.losses.militia <= 40);
  assert.ok(result.losses.archer >= 0 && result.losses.archer <= 20);
  assert.equal(result.survivors, 60 - result.losses.militia - result.losses.archer);
});

test("mesmos parâmetros produzem o mesmo resultado", () => {
  const input = {
    army: [{ unit_type: "knight", tier: 2, quantity: 12 }],
    castleLevel: 10,
    defenderLevel: 5,
    heroLevel: 3,
    dragonLevel: 4,
    researchLevel: 2,
    roll: 1
  };
  assert.deepEqual(simulateBattle(input), simulateBattle(input));
});

test("nível do castelo aumenta o poder calculado do atacante", () => {
  const army = [{ unit_type: "militia", tier: 1, quantity: 30 }];
  const low = simulateBattle({ army, castleLevel: 1, defenderLevel: 1, roll: 1 });
  const high = simulateBattle({ army, castleLevel: 30, defenderLevel: 1, roll: 1 });
  assert.ok(high.attackerPower > low.attackerPower);
});


test("cliente preserva o token e não funda outro reino quando a sessão salva falha", async () => {
  const { readFile } = await import("node:fs/promises");
  const arena = await readFile(new URL("../arena.html", import.meta.url), "utf8");
  const connect = arena.slice(arena.indexOf("async function connectKingdom()"), arena.indexOf("\nfunction renderChronicle()"));
  assert.match(connect, /if\(savedToken\)[\s\S]*?fetch\(API_BASE\+'\/game\/state'/);
  assert.match(connect, /Seu acesso foi preservado/);
  assert.doesNotMatch(connect, /localStorage\.removeItem\('coi_game_token'\)/);
  assert.doesNotMatch(connect, /sessionStorage\.removeItem\('coi_game_token'\)/);
  assert.match(connect, /}else\{[\s\S]*?fetch\(API_BASE\+'\/game\/start'/);
});


test("arena oferece retry e recuperação de sessão após falha sem criar outro reino", async () => {
  const { readFile }=await import("node:fs/promises");
  const arena=await readFile(new URL("../arena.html",import.meta.url),"utf8");
  const connect=arena.slice(arena.indexOf("async function connectKingdom()"),arena.indexOf("\nfunction renderChronicle()"));
  assert.ok(connect.includes("kingdomConnectInFlight"),"guard against duplicate reconnect requests");
  assert.ok(connect.includes("retryArenaKingdom"),"show retry after connection failure");
  assert.ok(connect.includes("void connectKingdom();"),"retry the existing connection flow");
  assert.ok(connect.includes("authError.status=response.status"),"remember HTTP error for recovery");
  assert.ok(connect.includes("if(error.status===401||error.status===403)"),"offer account recovery on unauthorized");
  assert.ok(connect.includes("recover.href='/account.html'"));
  assert.ok(connect.includes("status.replaceChildren("),"replace prior controls rather than duplicating");
  assert.ok(connect.includes("finally{kingdomConnectInFlight=false;}"));
  assert.doesNotMatch(connect,/localStorage\.removeItem\('coi_game_token'\)/);
});

test("bônus de equipamentos fortalecem ataque e sobrevivência sem ultrapassar o limite", () => {
  const army = [{ unit_type: "knight", tier: 2, quantity: 20 }];
  const base = simulateBattle({ army, castleLevel: 1, defenderLevel: 8, roll: 1 });
  const geared = simulateBattle({ army, castleLevel: 1, defenderLevel: 8, equipmentAttackBonusPercent: 30, equipmentHealthBonusPercent: 30, roll: 1 });
  assert.ok(geared.attackerPower > base.attackerPower);
  assert.ok(geared.survivors >= base.survivors);
  const capped = simulateBattle({ army, castleLevel: 1, defenderLevel: 8, equipmentAttackBonusPercent: 300, equipmentHealthBonusPercent: 300, roll: 1 });
  const maxed = simulateBattle({ army, castleLevel: 1, defenderLevel: 8, equipmentAttackBonusPercent: 30, equipmentHealthBonusPercent: 30, roll: 1 });
  assert.deepEqual(capped, maxed);
});


test("chance crítica aumenta dano e registra os acertos", () => {
  const input = { army:[{unit_type:"knight",tier:2,quantity:30}],castleLevel:5,defenderLevel:3,criticalChancePercent:100,criticalDamageMultiplier:2,criticalSeed:12345,roll:1 };
  const critical = simulateBattle(input);
  const normal = simulateBattle({...input,criticalChancePercent:0});
  assert.ok(critical.criticalHits > 0);
  assert.ok(critical.log.some(entry=>entry.critical===true));
  assert.ok(critical.attackerPower > normal.attackerPower || critical.survivors >= normal.survivors);
});

test("chance crítica zero nunca registra acerto crítico", () => {
  const result=simulateBattle({army:[{unit_type:"knight",tier:2,quantity:30}],defenderLevel:3,criticalChancePercent:0,criticalSeed:12345,roll:1});
  assert.equal(result.criticalHits,0);
  assert.ok(result.log.every(entry=>entry.critical===false));
});

test("críticos são reproduzíveis com a mesma semente", () => {
  const input={army:[{unit_type:"archer",tier:3,quantity:40}],defenderLevel:8,criticalChancePercent:15,criticalSeed:987654321,roll:1};
  assert.deepEqual(simulateBattle(input),simulateBattle(input));
});

test("velocidade de marcha reduz duração sem ultrapassar os limites", () => {
  assert.equal(calculateMarchDuration(100,0),100);
  assert.equal(calculateMarchDuration(100,25),80);
  assert.equal(calculateMarchDuration(100,100),67);
  assert.equal(calculateMarchDuration(1,50),5);
});

test("baixas de batalha são descontadas e respeitam limites do exército", () => {
  assert.deepEqual(applyUnitLosses([
    { unit_type: "militia", quantity: 10 },
    { unit_type: "archer", quantity: 8 }
  ], { militia: 3, archer: 8, unknown: 99 }), {
    militia: 7,
    archer: 0
  });
});

test("baixas agregadas são distribuídas sem duplicar perdas entre stacks", () => {
  assert.deepEqual(applyUnitLosses([
    { unit_type: "militia", tier: 1, quantity: 3 },
    { unit_type: "militia", tier: 2, quantity: 4 }
  ], { militia: 4 }), { militia: 3 });
});

test("perdas inválidas não criam tropas extras nem quantidades negativas", () => {
  assert.deepEqual(applyUnitLosses([
    { unit_type: "militia", quantity: 5 },
    { unit_type: "archer", quantity: 2 }
  ], { militia: -10, archer: 100 }), {
    militia: 5,
    archer: 0
  });
});

test("passivos do herói melhoram ataque e sobrevivência", () => {
  const army = [{ unit_type: "knight", tier: 2, quantity: 40 }];
  const base = simulateBattle({ army, castleLevel: 5, defenderLevel: 8, roll: 1, criticalSeed: 123 });
  const hero = simulateBattle({
    army, castleLevel: 5, defenderLevel: 8, roll: 1, criticalSeed: 123,
    heroAttackBonusPercent: 2.2,
    heroDefenseBonusPercent: 1.7,
    heroHealthBonusPercent: 1
  });
  assert.ok(hero.attackerPower > base.attackerPower);
  assert.ok(hero.survivors >= base.survivors);
});

test("passivo de ataque do herói respeita o teto global de 30%", () => {
  const army = [{ unit_type: "knight", tier: 2, quantity: 20 }];
  const capped = simulateBattle({ army, castleLevel: 5, defenderLevel: 8, roll: 1, equipmentAttackBonusPercent: 30 });
  const over = simulateBattle({ army, castleLevel: 5, defenderLevel: 8, roll: 1, equipmentAttackBonusPercent: 30, heroAttackBonusPercent: 3 });
  assert.deepEqual(over, capped);
});

test("herói dourado supera o teto antigo de 3% e bônus do dragão são aplicados uma única vez",()=>{
 const army=[{unit_type:"knight",tier:3,quantity:80}];
 const args={army,castleLevel:4,defenderLevel:16,roll:1,criticalSeed:111};
 const base=simulateBattle(args);
 const gold=simulateBattle({...args,heroAttackBonusPercent:20,heroDefenseBonusPercent:20});
 const withDragon=simulateBattle({...args,heroAttackBonusPercent:20,heroDefenseBonusPercent:20,dragonAttackBonusPercent:5.5,dragonDefenseBonusPercent:5.5});
 const capped=simulateBattle({...args,heroAttackBonusPercent:999,heroDefenseBonusPercent:999,dragonAttackBonusPercent:999,dragonDefenseBonusPercent:999});
 const exactlyCapped=simulateBattle({...args,heroAttackBonusPercent:20,heroDefenseBonusPercent:20,dragonAttackBonusPercent:5.5,dragonDefenseBonusPercent:5.5});
 assert.ok(gold.attackerPower>base.attackerPower);
 assert.ok(withDragon.attackerPower>gold.attackerPower);
 assert.deepEqual(capped,exactlyCapped);
});

test("bônus do VIP 7 do castelo se acumulam até o teto global sem duplicação",()=>{
 const army=[{unit_type:"knight",tier:3,quantity:70}];
 const base={army,castleLevel:30,defenderLevel:14,roll:1,criticalSeed:2026};
 const normal=simulateBattle(base);
 const vip=simulateBattle({...base,castleVipAttackBonusPercent:3.5,castleVipDefenseBonusPercent:7});
 assert.ok(vip.attackerPower>normal.attackerPower);
 const capped=simulateBattle({...base,equipmentAttackBonusPercent:30,castleVipAttackBonusPercent:3.5});
 const baseCapped=simulateBattle({...base,equipmentAttackBonusPercent:30});
 assert.deepEqual(capped,baseCapped,"VIP não ultrapassa o teto global de 30%");
 const extras=simulateBattle({...base,castleVipAttackBonusPercent:300,castleVipDefenseBonusPercent:300});
 const exact=simulateBattle({...base,castleVipAttackBonusPercent:3.5,castleVipDefenseBonusPercent:7});
 assert.deepEqual(extras,exact,"VIP vindo do cliente não poderia multiplicar bônus acima do limite");
});
