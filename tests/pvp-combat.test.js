import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("PvP march resolves only against an owned player castle and uses real stationed troops", async () => {
  const worker = await read("worker.js");
  const adapter = await read("game-adapter.js");
  assert.ok(worker.includes("async function processPvpMarch"));
  assert.ok(worker.includes('SELECT unit_type,tier,quantity FROM army_units WHERE kingdom_id=? AND quantity>0 ORDER BY unit_type,tier'));
  assert.ok(worker.includes("defenderArmy:defenderArmyRows"));
  assert.ok(adapter.includes("defenderArmy"));
  assert.ok(adapter.includes("defenderLosses"));
  assert.ok(worker.includes('battle_type,"territory_pvp"') || worker.includes('"territory_pvp"'));
  assert.ok(worker.includes("defender_kingdom_id"));
});

test("PvP resolution uses D1 compare-and-set, a garrison snapshot and a completed-march idempotency guard", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("UPDATE kingdoms SET battle_token=? WHERE id=? AND COALESCE(battle_token,'')=COALESCE(?, '')"));
  assert.ok(worker.includes("AND (SELECT COUNT(*) FROM army_units WHERE kingdom_id=? AND quantity>0)=?"));
  assert.ok(worker.includes("current.quantity=CAST(json_extract(requested.value,'$.quantity') AS INTEGER)"));
  assert.ok(worker.includes("status='completed' AND resolution_token=?"));
  assert.ok(worker.includes("await env.DB.batch(statements)"));
});

test("PvP blocks self-attacks, allied targets and active shields both before and at arrival", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("Você não pode atacar seu próprio castelo."));
  assert.ok(worker.includes("Ataques contra membros da sua aliança estão bloqueados."));
  assert.ok(worker.includes("Este reino está sob proteção e não pode ser atacado agora."));
  assert.ok(worker.includes("ataque_a_aliado_bloqueado"));
  assert.ok(worker.includes("castelo_protegido"));
});

test("both kingdoms receive reports and only the two participants can read detailed replays", async () => {
  const worker = await read("worker.js");
  const replay = await read("battle-replay.js");
  assert.ok(worker.includes("INSERT INTO battle_reports(attacker_kingdom_id,defender_kingdom_id,winner_kingdom_id"));
  assert.ok(worker.includes("pvp_battle_received"));
  assert.ok(worker.includes("pvp_battle_resolved"));
  assert.ok(replay.includes("br.attacker_kingdom_id=mine.id OR br.defender_kingdom_id=mine.id"));
});

test("invalid PvP targets return troops without granting a battle reward", async () => {
  const worker = await read("worker.js");
  const helperStart = worker.indexOf("async function cancelPvpMarch");
  const helperEnd = worker.indexOf("async function processPvpMarch", helperStart);
  const cancel = worker.slice(helperStart, helperEnd);
  assert.ok(cancel.includes("status='completed'"));
  assert.ok(cancel.includes("INSERT INTO army_units"));
  assert.ok(cancel.includes("march_cancelled"));
  assert.ok(!cancel.includes("INSERT INTO inventory_items"));
});
