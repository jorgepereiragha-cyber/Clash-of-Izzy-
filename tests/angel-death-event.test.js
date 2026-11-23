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


test("first deployment during an already-started weekend schedules the next complete event", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes("const history=await env.DB.prepare"));
  assert.ok(worker.includes("now.getTime()-Date.parse(window.startsAt)>15*60*1000"));
  assert.ok(worker.includes("getAngelDeathWeekendWindow(new Date(Date.parse(window.startsAt)+7*86400000))"));
});

test("leaderboard ties follow the same stable ordering as final reward payout", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes("last_attack_at<?"));
  assert.ok(worker.includes("kingdom_id<?"));
  assert.ok(worker.includes("ORDER BY ep.score DESC,ep.damage DESC,ep.last_attack_at ASC,ep.kingdom_id ASC"));
  assert.ok(worker.includes("ROW_NUMBER() OVER (ORDER BY ep.score DESC,ep.damage DESC,ep.last_attack_at ASC,ep.kingdom_id ASC) AS final_rank"));
  assert.ok(worker.includes("ORDER BY ranked.final_rank LIMIT 10"));
  assert.ok(worker.includes("Number(participant.final_rank)||index+1"));
});

test("successful Angel of Death attack refreshes authoritative scores despite the mutation lock", async () => {
  const client = await readFile(new URL("../events.js", import.meta.url), "utf8");
  assert.ok(client.includes("async function refresh(force=false){if(busy&&!force)return;"),
    "normal polling must pause during a mutation, while a forced post-attack refresh can run");
  assert.ok(client.includes("const generation=++refreshGeneration"),
    "every refresh has a monotonically increasing generation");
  assert.ok(client.includes("if(generation!==refreshGeneration)return;state="),
    "a slow pre-attack state response cannot overwrite fresher post-attack data");
  assert.match(client, /message\("Dano: "[\s\S]*?await refresh\(true\);\s*\}catch\(error\)/,
    "after a confirmed attack, force server-state reconciliation before releasing the lock");
  assert.ok(client.includes("finally{busy=false;updateAttackButton();}"),
    "the mutation lock is always released, including after a failed refresh");
});

test("the browser reuses a pending attack request ID after a network retry", async () => {
  const client = await readFile(new URL("../events.js", import.meta.url), "utf8");
  assert.ok(client.includes('sessionStorage.getItem("coi_angel_death_request")'));
  assert.ok(client.includes('sessionStorage.setItem("coi_angel_death_request",pendingRequestId)'));
  assert.ok(client.includes("requestId:pendingRequestId"));
  assert.ok(client.includes('sessionStorage.removeItem("coi_angel_death_request")'));
  assert.ok(client.includes('sessionStorage.getItem("coi_angel_death_units")'),
    "restore the original troops of an ambiguous previous attack");
  assert.ok(client.includes('sessionStorage.setItem("coi_angel_death_units",JSON.stringify(pendingAttackUnits))'),
    "persist the same troop payload as the idempotency key before sending");
  assert.ok(client.includes('sessionStorage.removeItem("coi_angel_death_units")'),
    "clear both only after a confirmed response");
  assert.ok(client.includes('units:pendingAttackUnits'),
    "retry must send the original army rather than new inputs with an old key");
  assert.ok(client.includes("const units=pendingReplay?pendingAttackUnits:"),
    "user cannot silently change army composition for a pending idempotency key");
});




test("event page includes accessible original boss artwork and reduced-motion support", async () => {
  const html = await readFile(new URL("../events.html", import.meta.url), "utf8");
  assert.ok(html.includes('role="img" aria-label="Anjo da Morte'));
  assert.ok(html.includes("death-wing"));
  assert.ok(html.includes("death-cloak"));
  assert.ok(html.includes("prefers-reduced-motion:reduce"));
});


test("event page shows the player's Death Essence inventory balance", async () => {
  const html = await readFile(new URL("../events.html", import.meta.url), "utf8");
  const client = await readFile(new URL("../events.js", import.meta.url), "utf8");
  assert.ok(html.includes('id="myEssence"'));
  assert.ok(client.includes('item.item_key==="death_essence"'));
});


test("Anjo da Morte top rewards exceed the largest existing gem collection reward", () => {
  const first=angelDeathRewardForRank(1),second=angelDeathRewardForRank(2),third=angelDeathRewardForRank(3);
  const top10=angelDeathRewardForRank(10),top50=angelDeathRewardForRank(50),top100=angelDeathRewardForRank(100);
  const participation=angelDeathRewardForRank(101);
  assert.ok(first.gems>5000&&second.gems>5000&&third.gems>5000&&top10.gems>5000);
  assert.ok(first.gems>second.gems&&second.gems>third.gems&&third.gems>top10.gems);
  assert.ok(top10.gems>top50.gems&&top50.gems>top100.gems&&top100.gems>participation.gems);
  assert.equal(participation.gems,100);
  assert.ok(first.deathEssence>top10.deathEssence&&top10.deathEssence>participation.deathEssence);
});

test("Anjo da Morte distribui as baixas pelo exército inteiro, sem punir pilhas pequenas", () => {
  const seed = 98765;
  const singleStack = simulateAngelDeathAttack({
    army: [{ unit_type: "militia", tier: 1, quantity: 10 }],
    castleLevel: 12,
    seed
  });
  const splitStacks = simulateAngelDeathAttack({
    army: Array.from({ length: 10 }, (_, index) => ({
      unit_type: "militia",
      tier: index + 1,
      quantity: 1
    })),
    castleLevel: 12,
    seed
  });

  assert.equal(splitStacks.totalTroops, 10);
  assert.equal(splitStacks.troopsLost, singleStack.troopsLost);
  assert.equal(splitStacks.troopsLost, Math.max(1, Math.floor(splitStacks.totalTroops * splitStacks.lossRate)));
  assert.equal(
    Object.values(splitStacks.losses).reduce((total, loss) => total + loss, 0),
    splitStacks.troopsLost
  );
  assert.ok(splitStacks.troopsLost < splitStacks.totalTroops);
  assert.ok(Object.values(splitStacks.losses).every(loss => loss === 0 || loss === 1));
});
