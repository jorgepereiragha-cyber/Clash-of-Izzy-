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
