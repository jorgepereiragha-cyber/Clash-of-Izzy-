import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSiegeScenario, advanceSiegeTurn } from "../scripts/siege-lab-sim.js";

test("siege laboratory is deterministic and requires a breach before infantry attacks the tower", () => {
  const initial = createSiegeScenario();
  assert.ok(Object.isFrozen(initial));
  const first = advanceSiegeTurn(initial, "gate");
  assert.deepEqual(first, advanceSiegeTurn(initial, "gate"));
  assert.equal(initial.round, 0);
  assert.equal(first.round, 1);
  assert.ok(first.gateHp < initial.gateHp);
  assert.equal(first.towerHp, initial.towerHp);
  assert.ok(first.infantryHp < initial.infantryHp);
  assert.equal(first.winner, null);
});

test("concentrating rams on the gate enables eventual victory without mutating inputs", () => {
  const snapshot = createSiegeScenario();
  let state = snapshot;
  for (let i = 0; i < 30 && !state.winner; i++) state = advanceSiegeTurn(state, "gate");
  assert.equal(snapshot.gateHp, 1300);
  assert.equal(state.winner, "attackers");
  assert.equal(state.gateHp, 0);
  assert.equal(state.towerHp, 0);
  assert.ok(state.round <= 30);
  assert.deepEqual(advanceSiegeTurn(state, "gate").events, []);
});

test("unbounded and invalid inputs fail closed and do not create negative hit points", () => {
  assert.throws(() => advanceSiegeTurn(createSiegeScenario(), "alliance_wallet"), RangeError);
  const state = advanceSiegeTurn({
    ...createSiegeScenario(),
    ramHp: Infinity,
    infantryHp: -999,
    gateHp: Number.NaN,
    towerHp: 900000
  }, "wall");
  assert.ok(Object.values(state).filter(Number.isFinite).every(n => n >= 0 && n <= 50000));
});

test("3D siege demo is independent of game transactions and playable on mobile", async () => {
  const [page,visual,logic] = await Promise.all([
    readFile(new URL("../siege-lab.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/siege-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/siege-lab-sim.js", import.meta.url), "utf8")
  ]);
  for (const marker of ['id="siegeViewport"', 'id="attackGate"', 'id="attackWall"', 'id="resetSiege"', 'role="status"', 'viewport-fit=cover', 'scripts/siege-lab.js']) {
    assert.ok(page.includes(marker), marker);
  }
  assert.match(page, /Ambiente de teste isolado/);
  assert.match(visual, /new THREE\.WebGLRenderer/);
  assert.match(visual, /new THREE\.OrthographicCamera/);
  assert.match(visual, /THREE\.BoxGeometry/);
  assert.match(visual, /setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 1\.25\)\)/);
  assert.match(visual, /webglcontextlost/);
  assert.doesNotMatch(page + visual + logic, /fetch\(|\/api\/game\/action|env\.DB|MercadoPago|\bPIX\b/i);
});
