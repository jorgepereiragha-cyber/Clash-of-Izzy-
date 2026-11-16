import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations/0019_valhalla_mode.sql", import.meta.url), "utf8");

test("Valhalla migration is additive and keeps the event disabled", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS game_config/);
  assert.match(migration, /\('valhalla_mode_active',\s*'0'\)/);
  assert.match(migration, /\('valhalla_resource_multiplier',\s*'5\.0'\)/);
  assert.match(migration, /\('valhalla_speed_multiplier',\s*'0\.2'\)/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bUPDATE\s+(players|kingdoms|army_units)\b/i);
});

test("Valhalla progress is attached to kingdom state, not player identity", () => {
  assert.match(migration, /ALTER TABLE kingdoms ADD COLUMN valhalla_rank/);
  assert.match(migration, /ALTER TABLE kingdoms ADD COLUMN destiny_runes/);
  assert.match(migration, /ALTER TABLE kingdoms ADD COLUMN valhalla_title/);
  assert.doesNotMatch(migration, /ALTER TABLE players/i);
});

test("event troop and hero catalogs do not alter permanent army or owned-hero tables", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS valhalla_troop_catalog/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS valhalla_troops/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS valhalla_hero_catalog/);
  assert.doesNotMatch(migration, /INSERT\s+OR\s+IGNORE\s+INTO\s+(army_units|heroes)\b/i);
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS troop_types\b/i);
});

test("rune transactions and daily grants have database-enforced idempotency", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS valhalla_rune_ledger/);
  assert.match(migration, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS valhalla_daily_rewards/);
  assert.match(migration, /PRIMARY KEY \(kingdom_id, reward_date\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS valhalla_purchases/);
  assert.match(migration, /request_key TEXT NOT NULL UNIQUE/);
  assert.doesNotMatch(migration, /destiny_runes\s*=\s*.*gems|gems\s*=\s*.*destiny_runes/i);
});

test("Valhalla stores include catalog, temporary buffs, Wild Hunt and season rewards", () => {
  for (const table of [
    "valhalla_catalog",
    "valhalla_buffs",
    "valhalla_wild_hunt",
    "valhalla_wild_hunt_attacks",
    "valhalla_leaderboard",
    "valhalla_rewards_claimed",
  ]) assert.match(migration, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
  for (const id of ["einherjar", "valkyrie_mounted", "asgard_archer", "fenrir_beast"]) assert.ok(migration.includes("'" + id + "'"));
  for (const id of ["odin_awakened", "thor_ragnarok", "freya_vanir", "loki_chaos", "valhalla_king"]) assert.ok(migration.includes("'" + id + "'"));
});