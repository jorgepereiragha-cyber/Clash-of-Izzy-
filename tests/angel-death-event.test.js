import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ANGEL_DEATH_EVENT,
  getAngelDeathWeekendWindow,
  simulateAngelDeathAttack,
  angelDeathRewardForRank
} from "../angel-death-event.js";

test("Anjo da Morte uses the Brasília weekend window consistently", () => {
  const beforeStart = getAngelDeathWeekendWindow(new Date("2026-11-20T20:00:00.000Z"));
  assert.equal(beforeStart.startsAt, "2026-11-20T21:00:00.000Z");
  assert.equal(beforeStart.endsAt, "2026-11-23T03:00:00.000Z");
  const saturday = getAngelDeathWeekendWindow(new Date("2026-11-21T15:00:00.000Z"));
  assert.deepEqual(saturday, beforeStart);
  const afterEnd = getAngelDeathWeekendWindow(new Date("2026-11-23T03:00:00.000Z"));
  assert.equal(afterEnd.startsAt, "2026-11-27T21:00:00.000Z");
  assert.equal(afterEnd.timezone, "America/Sao_Paulo");
});

test("Anjo da Morte attack simulation is deterministic and losses never exceed selected troops", () => {
  const input = {
    army: [
      { unit_type: "militia", tier: 1, quantity: 100 },
      { unit_type: "swordsman", tier: 2, quantity: 40 }
    ],
    castleLevel: 12,
    heroLevel: 20,
    dragonLevel: 5,
    militaryLevel: 3,
    seed: 123456
  };
  const first = simulateAngelDeathAttack(input);
  const second = simulateAngelDeathAttack(input);
  assert.deepEqual(first, second);
  assert.ok(first.damage > 0);
  assert.equal(first.totalTroops, 140);
  assert.ok(first.troopsLost > 0 && first.troopsLost <= 140);
  assert.ok(first.losses.militia_1 <= 100);
  assert.ok(first.losses.swordsman_2 <= 40);
});

test("Anjo da Morte rewards are monotonic by rank and include death essence", () => {
  const first = angelDeathRewardForRank(1);
  const tenth = angelDeathRewardForRank(10);
  const hundredth = angelDeathRewardForRank(100);
  const participant = angelDeathRewardForRank(101);
  assert.ok(first.gems > tenth.gems && tenth.gems > hundredth.gems);
  assert.ok(hundredth.gems > participant.gems);
  assert.ok(first.deathEssence > participant.deathEssence);
  assert.equal(ANGEL_DEATH_EVENT.key, "angel_of_death");
});


test("event rewards and lifecycle are idempotent and scheduled by the Worker", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0014_search_quality_angel_death.sql", import.meta.url), "utf8");
  assert.ok(worker.includes("async function processAngelDeathEventLifecycle"));
  assert.ok(worker.includes("await processAngelDeathEventLifecycle(env)"));
  assert.ok(worker.includes("INSERT OR IGNORE INTO world_event_rewards"));
  assert.ok(worker.includes("rewards_distributed_at"));
  assert.ok(migration.includes("UNIQUE(event_key,starts_at)"));
  assert.ok(migration.includes("UNIQUE(event_id,kingdom_id,request_id)"));
  assert.ok(migration.includes("UNIQUE(event_id,kingdom_id)"));
});

test("permanent troop loss is isolated to Anjo da Morte attacks", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const eventAttack = worker.slice(worker.indexOf("async function angelDeathEventAttack"), worker.indexOf("async function distributeAngelDeathRewards"));
  const normalBattleStart = worker.indexOf('}else if(type==="battle"){');
  const normalBattleEnd = worker.indexOf('}else if(type==="rename"){', normalBattleStart);
  const normalBattle = worker.slice(normalBattleStart, normalBattleEnd);
  assert.ok(eventAttack.includes("SET quantity=quantity-CAST"));
  assert.ok(!normalBattle.includes("SET quantity=quantity-CAST"));
  assert.ok(normalBattle.includes("SET quantity=quantity"));
  assert.ok(worker.includes("survivors[u.unit_type]=u.quantity"));
});
