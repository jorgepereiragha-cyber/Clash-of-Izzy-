import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculatePetProgress } from "../pets.js";
import { simulateBattle } from "../game-adapter.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("migration adiciona pets por reino e mantém equipamento canônico", async () => {
  const migration = await read("migrations/0022_pets_and_battle_replays.sql");
  const worker = await read("worker.js");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pet_catalog/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS kingdom_pets/);
  assert.match(migration, /idx_kingdom_pets_one_active/);
  assert.match(migration, /kingdom_pet_feed_requests/);
  assert.match(migration, /INSERT OR IGNORE INTO kingdom_pets[\s\S]*SELECT id,'pet_raven'/);
  assert.match(migration, /ALTER TABLE battle_reports[\s\S]*replay_json/);
  assert.match(migration, /604800/);
  assert.match(worker, /kingdom_equipment/);
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS (equipment_catalog|player_equipment|player_materials)/);
});

test("progressão de mascotes sobe níveis e preserva experiência excedente", () => {
  assert.deepEqual(calculatePetProgress(1, 95, 10), { level: 2, experience: 5 });
  assert.deepEqual(calculatePetProgress(1, 0, 305), { level: 3, experience: 5 });
  assert.deepEqual(calculatePetProgress(50, 20, 100), { level: 50, experience: 120 });
});

test("passiva de Fenrir aumenta apenas o poder da infantaria", () => {
  const army = [{ unit_type: "militia", tier: 1, quantity: 500 }];
  const base = simulateBattle({ army, defenderLevel: 1, criticalSeed: 123, roll: 1 });
  const boosted = simulateBattle({
    army, defenderLevel: 1, criticalSeed: 123, roll: 1, infantryAttackBonusPercent: 8
  });
  assert.ok(boosted.attackerPower > base.attackerPower);
  const ranged = [{ unit_type: "archer", tier: 1, quantity: 500 }];
  const rangedBase = simulateBattle({ army: ranged, defenderLevel: 1, criticalSeed: 123, roll: 1 });
  const rangedBoosted = simulateBattle({
    army: ranged, defenderLevel: 1, criticalSeed: 123, roll: 1, infantryAttackBonusPercent: 8
  });
  assert.equal(rangedBoosted.attackerPower, rangedBase.attackerPower);
});

test("Worker liga pets, produção, marcha, combate e replay com autenticação", async () => {
  const worker = await read("worker.js");
  const rally = await read("rally.js");
  const replay = await read("battle-replay.js");
  assert.match(worker, /handlePetsRoute/);
  assert.match(worker, /getBattleReplay/);
  assert.match(worker, /getPetBonuses\(env,kingdomId\)/);
  assert.match(worker, /resourceProductionMultiplier/);
  assert.match(worker, /infantryAttackBonusPercent/);
  assert.match(worker, /has_replay/);
  assert.match(worker, /replay_expires_at<=\?/);
  assert.match(rally, /getPetBonuses/);
  assert.match(replay, /br\.attacker_kingdom_id=mine\.id OR br\.defender_kingdom_id=mine\.id/);
  assert.match(replay, /replay_expires_at>unixepoch\(\)/);
});

test("alimentação tem request_key e grava a deduplicação no D1", async () => {
  const pets = await read("pets.js");
  assert.match(pets, /request_key obrigatório/);
  assert.match(pets, /UNIQUE \(kingdom_id,request_key\)/);
  assert.match(pets, /kingdom_pet_feed_requests/);
  assert.match(pets, /changes\(\)>0/);
});
