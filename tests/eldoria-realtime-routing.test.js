import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ELDORIA_ROOM_SHARDS, shardForPlayerId, roomNameForShard, parseRealtimeShard }
  from "../scripts/eldoria-realtime-routing.js";

test("1,000 synthetic identities spread evenly across eight presence rooms", () => {
  assert.equal(ELDORIA_ROOM_SHARDS, 8);
  const distribution = Array.from({ length: 8 }, () => 0);
  for (let i = 0; i < 1000; i++) {
    const playerId = "izzy_" + i.toString(16).padStart(32, "0");
    distribution[shardForPlayerId(playerId)]++;
  }
  assert.deepEqual(distribution, [125, 125, 125, 125, 125, 125, 125, 125]);
  assert.ok(Math.max(...distribution) <= 200);
  // Synthetic routing only: 1,000 online sessions and Cloudflare Paid must be tested separately.
});

test("room routing validates identities and rejects unbounded shard names", () => {
  assert.equal(roomNameForShard(null), "eldoria");
  assert.equal(roomNameForShard(0), "eldoria-shard-0");
  assert.equal(roomNameForShard(7), "eldoria-shard-7");
  assert.equal(parseRealtimeShard(null), null);
  assert.equal(parseRealtimeShard("0"), 0);
  assert.equal(parseRealtimeShard("7"), 7);
  for (const v of ["8", "-1", "01", "0/../../x", "", "NaN", "null", "0&room=1"]) {
    assert.throws(() => parseRealtimeShard(v));
  }
  for (const bad of ["izzy_test", "izzy_" + "x".repeat(32), "izzy_" + "a".repeat(31), ""]) {
    assert.throws(() => shardForPlayerId(bad));
  }
  for (const bad of [-1, 8, 1000, NaN, "1", 0.5]) {
    assert.throws(() => roomNameForShard(bad));
  }
});

test("Worker binds only vetted rooms, protects tickets, and supports old clients", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const client = await readFile(new URL("../scripts/eldoria-realtime-client.js", import.meta.url), "utf8");
  const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
  assert.match(worker, /gameIdentity\(request,env\)/);
  assert.match(worker, /X-COI-Shard-Support/);
  assert.match(worker, /shardForPlayerId\(playerId\)/);
  assert.match(worker, /parseRealtimeShard\(url\.searchParams\.get\("room"\)\)/);
  assert.match(worker, /getAll\("room"\)\.length>1/);
  assert.match(worker, /roomNameForShard\(shard\)/);
  assert.match(client, /"\?room=" \+ room/);
  assert.ok(ignore.split("\n").some(line => line.trim() === "scripts/eldoria-realtime-routing.js"));
});
