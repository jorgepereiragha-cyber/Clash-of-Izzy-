import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("D1 identity is declared once and kept aligned across Wrangler, package scripts and production workflow", async () => {
  const config = JSON.parse(await read("wrangler.jsonc"));
  const pkg = JSON.parse(await read("package.json"));
  const workflow = await read(".github/workflows/deploy-cloudflare.yml");
  const db = (config.d1_databases || []).find(entry => entry.binding === "DB");

  assert.ok(db, "wrangler.jsonc must declare the DB binding");
  assert.equal(db.database_name, "clash-of-izzy-db");
  assert.equal(db.migrations_dir, "migrations");
  assert.match(db.database_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  assert.match(pkg.scripts["db:migrate:local"], /--config wrangler\.jsonc d1 migrations apply clash-of-izzy-db --local/);
  assert.match(pkg.scripts["db:migrate:remote"], /--config wrangler\.jsonc d1 migrations apply clash-of-izzy-db --remote/);
  assert.match(workflow, new RegExp("D1_DATABASE_ID: " + db.database_id));
  assert.match(workflow, /--config wrangler\.jsonc d1 migrations apply clash-of-izzy-db --remote/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*push:/m, "production deploy must remain manually gated");
});

test("the initial world migration creates the kingdom table used by the Worker", async () => {
  const migration = await read("migrations/0002_world.sql");
  const worker = await read("worker.js");
  const config = JSON.parse(await read("wrangler.jsonc"));

  assert.match(migration, /CREATE TABLE IF NOT EXISTS kingdoms\s*\(/i);
  assert.equal(config.d1_databases.find(entry => entry.binding === "DB").migrations_dir, "migrations");
  assert.match(worker, /SELECT id FROM kingdoms WHERE player_id=\?/);
  assert.match(worker, /"kingdoms"/);
  assert.match(worker, /missingTables=requiredTables\.filter/);
});

test("public health and Core Loop validators fail closed when D1 schema or session is missing", async () => {
  const worker = await read("worker.js");
  const smoke = await read("scripts/production-smoke.js");
  const validator = await read("scripts/validate-core-loop.sh");

  assert.match(worker, /checks\.session=Boolean\(env\.SESSION_SECRET\)/);
  assert.match(worker, /checks\.schema=missingTables\.length===0/);
  assert.match(smoke, /health\.checks\?\.database\s*===\s*true/);
  assert.match(smoke, /health\.checks\?\.schema\s*===\s*true/);
  assert.match(validator, /VALIDAÇÃO READ-ONLY CONCLUÍDA/);
  assert.match(validator, /--mutate-training/);
  assert.match(validator, /ALLOW_GAME_MUTATIONS:-/);
  assert.match(validator, /Digite TREINAR/);
});

test("the main game surfaces reuse the same session, state and action contracts", async () => {
  const kingdom = await read("kingdom.html");
  const world = await read("world-map.js");
  const navigation = await read("navigation.js");
  const alliance = await read("alliance.html");
  const equipment = await read("equipment-system.js");

  assert.match(kingdom, /request\("\/game\/state"\)/);
  assert.match(kingdom, /request\("\/game\/action"/);
  assert.match(world, /request\("\/game\/state"\)/);
  assert.match(world, /request\("\/game\/action"/);
  assert.match(navigation, /fetch\("\/api\/game\/search\?"/);
  assert.match(alliance, /request\("\/game\/search\?"/);
  assert.match(equipment, /request\("\/game\/state"/);
  assert.match(equipment, /request\("\/game\/action"/);
  for (const source of [kingdom, world, navigation, alliance, equipment]) {
    assert.ok(source.includes("coi_game_token") || source.includes('"/game/state"') || source.includes('"/game/action"'));
  }
});

test("every frontend player-discovery surface uses the shared global search endpoint", async () => {
  const kingdom = await read("kingdom.html");
  const navigation = await read("navigation.js");
  const alliance = await read("alliance.html");

  assert.match(kingdom, /type:"players"/);
  assert.match(kingdom, /request\("\/game\/search\?\+params\.toString\(\)"/);
  assert.match(navigation, /type:"all",limit:"8"/);
  assert.match(alliance, /request\("\/game\/search\?\+params\.toString\(\)"/);
});
