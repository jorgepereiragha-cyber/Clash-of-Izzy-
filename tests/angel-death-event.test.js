import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ANGEL_DEATH_EVENT,
  getAngelDeathWeekendWindow,
  simulateAngelDeathAttack,
  angelDeathRewardForRank,
  sameAngelDeathAttackUnits
} from "../angel-death-event.js";

test("replayed event attacks require the identical saved troop composition", () => {
  const snapshot={militia_1:{quantity:8,loss:1},archer_2:{quantity:4,loss:0}};
  assert.equal(sameAngelDeathAttackUnits(snapshot,{militia_1:8,archer_2:4}),true);
  assert.equal(sameAngelDeathAttackUnits(snapshot,{archer_2:4,militia_1:"8",knight_1:0}),true);
  assert.equal(sameAngelDeathAttackUnits(snapshot,{militia_1:8,archer_2:5}),false);
  assert.equal(sameAngelDeathAttackUnits(snapshot,{militia_1:8}),false);
  assert.equal(sameAngelDeathAttackUnits(snapshot,{militia_1:8,archer_2:4,knight_1:1}),false);
  assert.equal(sameAngelDeathAttackUnits(snapshot,null),false);
  assert.equal(sameAngelDeathAttackUnits(snapshot,{militia_1:"NaN",archer_2:4}),false);
});

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
  assert.match(client, /const resultMessage="Dano: "[\s\S]*?const refreshed=await refresh\(true\);[\s\S]*?\}catch\(error\)/,
    "after a confirmed attack, force server-state reconciliation before releasing the lock");
  assert.ok(client.includes("loadValhallaEventConfig().catch(()=>valhallaConfig)"),
    "an optional event catalog failure must not suppress the authoritative fight scoreboard");
  assert.ok(client.includes('if(!refreshed)message(resultMessage+'),
    "a confirmed attack must not look unprocessed when only post-attack refresh fails");
  assert.ok(client.includes("finally{busy=false;updateAttackButton();}"),
    "the mutation lock is always released, including after a failed refresh");
});

test("events page survives blocked localStorage and never creates a guest kingdom while recovering auth", async () => {
  const client=await readFile(new URL("../events.js",import.meta.url),"utf8");
  assert.ok(client.includes("function readEventSession()"));
  assert.match(client,/try\{const saved=localStorage\.getItem\("coi_game_token"\)/);
  assert.match(client,/try\{const saved=sessionStorage\.getItem\("coi_game_token"\)/);
  assert.ok(client.includes('account.href="/account.html"'));
  assert.ok(client.includes("Nenhuma tropa será enviada."));
  assert.ok(!client.includes('if(!token){location.replace("/kingdom.html");}'));
  assert.ok(!client.includes('request("/game/start"'));
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
  assert.ok(client.includes('sessionStorage.setItem("coi_angel_death_event_id",String(pendingEventId))'),
    "bind attack retries to their original event cycle");
  assert.ok(client.includes("currentEventId!==pendingEventId"),
    "never apply a previous weekend retry to a new active event");
  assert.ok(client.includes('sessionStorage.removeItem("coi_angel_death_event_id")'),
    "release event identity after success or detected rollover");
  const page = await readFile(new URL("../events.html", import.meta.url), "utf8");
  assert.ok(page.includes('id="discardPendingAttack"'), "provide explicit recovery for legacy pending requests");
  assert.ok(client.includes('const legacy=Boolean(pendingRequestId&&!pendingEventId)'),
    "unscoped legacy request IDs must never silently replay into a new weekend");
  assert.ok(client.includes('$("attack").disabled=busy||legacy'),
    "require explicit acknowledgment before creating a new attack after a legacy retry");
  assert.ok(client.includes('$("discardPendingAttack").addEventListener("click"'),
    "allow the player to discard a local retry only after a clear confirmation");
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

test("Anjo da Morte: an existing attack cannot settle twice after a rejected insert",async()=>{
  const {DatabaseSync}=await import("node:sqlite");
  const {appendAngelDeathAttackSettlement}=await import("../worker.js");
  const db=new DatabaseSync(":memory:");
  try{
    db.exec(`
      CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
      CREATE TABLE world_events(id INTEGER PRIMARY KEY,boss_hp_remaining INTEGER,boss_defeated_at TEXT);
      CREATE TABLE world_event_attacks(event_id INTEGER,kingdom_id INTEGER,request_id TEXT,damage INTEGER,score INTEGER,UNIQUE(event_id,kingdom_id,request_id));
      CREATE TABLE world_event_participants(event_id INTEGER,kingdom_id INTEGER,first_attack_at TEXT,last_attack_at TEXT,score INTEGER DEFAULT 0,damage INTEGER DEFAULT 0,attacks INTEGER DEFAULT 0,troops_lost INTEGER DEFAULT 0,UNIQUE(event_id,kingdom_id));
      INSERT INTO world_events VALUES(1,1000,NULL);
    `);
    const adapter={prepare(sql){return {bind(...args){return {sql,args}}}}};
    const instant="2026-11-27T22:00:00.000Z";
    const execute=(requestId,actionId,damage,troopsLost)=>{
      const statements=[adapter.prepare("INSERT OR IGNORE INTO world_event_attacks VALUES(1,2,?,?,?)").bind(requestId,damage,damage)];
      appendAngelDeathAttackSettlement(adapter,statements,{eventId:1,kingdomId:2,requestId,instant,troopsLost,actionId});
      db.exec("BEGIN");
      try{for(const {sql,args} of statements)db.prepare(sql).run(...args);db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}
    };
    execute("first","guard1",100,4);
    execute("first","guard2",100,4);
    execute("second","guard3",50,2);
    assert.equal(db.prepare("SELECT boss_hp_remaining FROM world_events").get().boss_hp_remaining,850);
    assert.deepEqual({...db.prepare("SELECT score,damage,attacks,troops_lost FROM world_event_participants").get()},{score:150,damage:150,attacks:2,troops_lost:6});
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM world_event_attacks").get().n,2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events").get().n,0);
  }finally{db.close();}
});
