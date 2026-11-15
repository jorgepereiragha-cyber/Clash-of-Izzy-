import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRealmOpening, REALM_OPENING_THRESHOLD } from "../realm-policy.js";

test("não abre outro reino antes de 1.000 jogadores", () => {
  assert.equal(REALM_OPENING_THRESHOLD, 1000);
  assert.equal(evaluateRealmOpening({ registeredPlayers: 999, capacityReached: true }).eligible, false);
});

test("1.000 jogadores sem pressão de capacidade não fragmentam a comunidade", () => {
  assert.equal(evaluateRealmOpening({ registeredPlayers: 1000 }).eligible, false);
});

test("novo reino só fica elegível após o marco e pressão de capacidade", () => {
  assert.equal(evaluateRealmOpening({ registeredPlayers: 1000, activePlayers: 850, capacityReached: true }).eligible, true);
});
