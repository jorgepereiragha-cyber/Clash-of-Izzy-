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


test("chance crítica aplica dano adicional e registra acertos", () => {
  const result = simulateBattle({
    army: [{ unit_type: "knight", tier: 2, quantity: 30 }],
    castleLevel: 5, defenderLevel: 3, heroLevel: 1, dragonLevel: 1,
    criticalChancePercent: 15, criticalDamageMultiplier: 2,
    criticalSeed: 12345, roll: 1
  });
  assert.ok(result.criticalHits > 0);
  assert.ok(result.log.some(entry => entry.critical === true));
});

test("chance crítica zero mantém todos os ataques sem crítico", () => {
  const result = simulateBattle({
    army: [{ unit_type: "knight", tier: 2, quantity: 30 }],
    defenderLevel: 3, criticalChancePercent: 0, criticalSeed: 12345, roll: 1
  });
  assert.equal(result.criticalHits, 0);
  assert.ok(result.log.every(entry => entry.critical === false));
});

test("críticos são reproduzíveis com a mesma semente", () => {
  const input = {
    army: [{ unit_type: "archer", tier: 3, quantity: 40 }],
    defenderLevel: 8, criticalChancePercent: 15, criticalSeed: 987654321, roll: 1
  };
  assert.deepEqual(simulateBattle(input), simulateBattle(input));
});

test("bônus de marcha reduz o tempo calculado no servidor até o limite de 20%", () => {
  assert.equal(calculateMarchDuration(120, 0), 120);
  assert.equal(calculateMarchDuration(120, 10), 110);
  assert.equal(calculateMarchDuration(120, 20), 100);
  assert.equal(calculateMarchDuration(120, 90), 100);
});

test("duração de marcha é limitada e nunca fica abaixo de um segundo", () => {
  assert.equal(calculateMarchDuration(0, 20), 1);
  assert.equal(calculateMarchDuration(999999, 0), 86400);
});


test("contador de críticos não depende do limite de 80 entradas do relatório", () => {
  const result = simulateBattle({
    army: [
      { unit_type: "militia", tier: 1, quantity: 100000 },
      { unit_type: "swordsman", tier: 1, quantity: 100000 },
      { unit_type: "spearman", tier: 1, quantity: 100000 },
      { unit_type: "archer", tier: 1, quantity: 100000 },
      { unit_type: "crossbowman", tier: 1, quantity: 100000 },
      { unit_type: "cavalry", tier: 1, quantity: 100000 },
      { unit_type: "knight", tier: 1, quantity: 100000 },
      { unit_type: "mage", tier: 1, quantity: 100000 },
      { unit_type: "catapult", tier: 1, quantity: 100000 },
      { unit_type: "ram", tier: 1, quantity: 100000 },
      { unit_type: "trebuchet", tier: 1, quantity: 100000 }
    ],
    defenderLevel: 30,
    criticalChancePercent: 15,
    criticalSeed: 24680,
    roll: 1
  });
  assert.ok(result.log.length <= 80);
  assert.ok(result.criticalHits >= result.log.filter(entry => entry.critical).length);
});
