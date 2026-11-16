import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations/0020_referral_tracking.sql", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");

test("referral tracking links existing player records and permits only one referrer per new player", () => {
  assert.match(migration, /referrer_player_id INTEGER NOT NULL REFERENCES players\(id\)/);
  assert.match(migration, /referred_player_id INTEGER NOT NULL UNIQUE REFERENCES players\(id\)/);
  assert.match(migration, /CHECK \(referrer_player_id <> referred_player_id\)/);
  assert.doesNotMatch(migration, /destiny_runes|gems\s*=/i);
});

test("referral link endpoint requires a valid game session and signup records only an existing referrer", () => {
  assert.match(worker, /\/api\/game\/referral\/link/);
  assert.match(worker, /gameIdentity\(request,env\)/);
  assert.match(worker, /INSERT OR IGNORE INTO referral_tracking/);
  assert.match(worker, /referrer\.player_id/);
});
