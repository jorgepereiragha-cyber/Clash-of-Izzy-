import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0013_api_rate_limits.sql", import.meta.url), "utf8");

test("same-origin API does not publish wildcard CORS headers", () => {
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Headers/);
  assert.match(worker, /request\.method==="OPTIONS"\)return new Response\(null,\{status:405/);
});

test("rate limits protect account creation, game reads/actions, store and admin login", () => {
  for (const scope of [
    "store-catalog-ip",
    "game-start-ip",
    "game-state-player",
    "game-action-player",
    "game-action-network",
    "admin-login-ip",
    "admin-login-account",
  ]) {
    assert.ok(worker.includes(scope), "missing rate limit scope: " + scope);
  }
  assert.match(worker, /Retry-After/);
});

test("rate-limit identifiers are private and the server module is not a public asset", () => {
  assert.match(ignore, /api-rate-limit\.js/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS api_rate_limits/);
  assert.match(migration, /rate_key TEXT PRIMARY KEY/);
  assert.match(worker, /DELETE FROM api_rate_limits WHERE expires_at/);
});
