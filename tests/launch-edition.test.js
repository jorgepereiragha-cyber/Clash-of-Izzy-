import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("auth session lookup is one D1 query and preserves guest/Google/password semantics", async () => {
  const worker = await read("worker.js");
  const helperStart = worker.indexOf("async function sessionVersionForPlayer(env,playerId)");
  const helperEnd = worker.indexOf("async function gameIdentity(", helperStart);
  const helper = worker.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.ok(helper.includes("COALESCE(a.session_version,g.session_version) AS version"));
  assert.ok(helper.includes("LEFT JOIN player_accounts a ON a.player_id=p.id"));
  assert.ok(helper.includes("LEFT JOIN google_account_links g ON g.player_id=p.id"));
  assert.ok(helper.includes("return row?.version ?? undefined;"), "guests without account keep unversioned tokens");
  assert.equal((helper.match(/env.DB.prepare\\(/g) || []).length, 1);
  const identityStart = worker.indexOf("async function gameIdentity(");
  const identityEnd = worker.indexOf("async function ensureKingdom(", identityStart);
  const identity = worker.slice(identityStart, identityEnd);
  assert.ok(identity.includes("const version=await sessionVersionForPlayer(env,String(p.sub));"));
  assert.ok(identity.includes("if(!Number.isSafeInteger(p.av)||p.av!==Number(version))return null;"));
});


test("launch preserves one kingdom per player and existing kingdoms in map 1", async () => {
  const worker = await read("worker.js");
  const schema = await read("migrations/0002_world.sql");
  const sharedRealm = await read("migrations/0026_single_shared_realm.sql");
  assert.ok(schema.includes("player_id INTEGER NOT NULL UNIQUE REFERENCES players(id)"));
  assert.ok(worker.includes("const existingPlayerId=await gameIdentity(request,env)"));
  assert.ok(worker.includes("SELECT 1 FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?"));
  assert.ok(worker.includes("const sessionVersion=await sessionVersionForPlayer(env,existingPlayerId);"));
  assert.ok(worker.includes("if(sessionVersion!==undefined)payload.av=Number(sessionVersion);"));
  assert.ok(worker.includes("resumed:true"));
  assert.ok(sharedRealm.includes("map_region = 1"));
  const progressive=await read("migrations/0034_progressive_realms.sql");
  assert.ok(progressive.includes("realm_openings"));
  assert.doesNotMatch(progressive,/DROP TABLE|DELETE FROM kingdoms/i);
});

test("the launch store exposes only six paid skins and blocks new requests for unreleased skins", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("const INITIAL_PAID_SKIN_LIMIT = 6"));
  assert.ok(worker.includes('skin_edition:"initial",skin_limit:INITIAL_PAID_SKIN_LIMIT'));
  assert.ok(worker.includes("WHERE id=? AND id IN (SELECT id FROM skins ORDER BY id LIMIT ?)"));
  assert.ok(worker.includes("WHERE name=? AND id IN (SELECT id FROM skins ORDER BY id LIMIT ?)"));
  assert.ok(worker.includes("Esta skin está bloqueada para uma atualização futura."));
  assert.ok(worker.includes("Skin não cadastrada ou bloqueada na edição inicial."));
});

test("global search filters unreleased paid skins from FTS and fallback queries", async () => {
  const worker = await read("worker.js");
  const filter = "d.entity_type<>'skin' OR CAST(d.entity_key AS INTEGER) IN (SELECT id FROM skins ORDER BY id LIMIT ?)";
  assert.equal(worker.split(filter).length - 1, 3);
  assert.ok(worker.includes("SELECT name FROM skins WHERE id IN (SELECT id FROM skins ORDER BY id LIMIT ?)"));
});
