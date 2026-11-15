import test from "node:test";
import assert from "node:assert/strict";
import { simulateBattle } from "../game-adapter.js";

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
