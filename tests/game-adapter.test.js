import test from "node:test";
import assert from "node:assert/strict";
import { simulateBattle, calculateMarchDuration } from "../game-adapter.js";

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

test("PvP simula a guarnição real e devolve baixas dos dois exércitos", () => {
  const input = {
    army: [
      { unit_type: "knight", tier: 2, quantity: 24 },
      { unit_type: "archer", tier: 1, quantity: 30 }
    ],
    defendingArmy: [
      { unit_type: "militia", tier: 1, quantity: 60 },
      { unit_type: "archer", tier: 2, quantity: 18 },
      { unit_type: "mage", tier: 1, quantity: 8 }
    ],
    castleLevel: 8,
    defenderCastlePowerBonusPercent: 12,
    heroLevel: 6,
    defenderHeroLevel: 8,
    dragonLevel: 4,
    defenderDragonLevel: 3,
    researchLevel: 5,
    defenderResearchLevel: 4,
    defenderDefenseBonusPercent: 15,
    equipmentAttackBonusPercent: 12,
    defenderEquipmentAttackBonusPercent: 10,
    equipmentHealthBonusPercent: 8,
    defenderEquipmentHealthBonusPercent: 20,
    criticalChancePercent: 10,
    defenderCriticalChancePercent: 12,
    criticalSeed: 123456,
    defenderCriticalSeed: 654321,
    roll: 1
  };
  const result = simulateBattle(input);
  assert.equal(typeof result.won, "boolean");
  assert.ok(result.rounds >= 1 && result.rounds <= 30);
  assert.ok(result.defenderLosses);
  assert.ok(result.losses.knight >= 0 && result.losses.knight <= 24);
  assert.ok(result.losses.archer >= 0 && result.losses.archer <= 30);
  assert.ok(result.defenderLosses.militia >= 0 && result.defenderLosses.militia <= 60);
  assert.ok(result.defenderLosses.archer >= 0 && result.defenderLosses.archer <= 18);
  assert.ok(result.defenderLosses.mage >= 0 && result.defenderLosses.mage <= 8);
  assert.equal(
    result.survivors,
    54 - result.losses.knight - result.losses.archer
  );
  assert.equal(
    result.defenderSurvivors,
    86 - result.defenderLosses.militia - result.defenderLosses.archer - result.defenderLosses.mage
  );
  assert.deepEqual(result, simulateBattle(input));
});

test("buffs defensivos reais aumentam o poder da guarnição e a mitigação", () => {
  const input = {
    army: [{ unit_type: "knight", tier: 2, quantity: 40 }],
    defendingArmy: [{ unit_type: "militia", tier: 2, quantity: 50 }],
    castleLevel: 5,
    defenderLevel: 5,
    roll: 1,
    criticalSeed: 100,
    defenderCriticalSeed: 200
  };
  const base = simulateBattle(input);
  const defended = simulateBattle({
    ...input,
    defenderCastlePowerBonusPercent: 20,
    defenderDefenseBonusPercent: 30,
    defenderEquipmentHealthBonusPercent: 30,
    defenderHeroLevel: 20,
    defenderDragonLevel: 15,
    defenderResearchLevel: 10
  });
  assert.ok(defended.defenderPower > base.defenderPower);
  assert.ok(defended.defenderSurvivors >= base.defenderSurvivors);
});
