import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("tabelas auxiliares do jogo são versionadas na migração 0008", async () => {
  const migration = await readFile(new URL("../migrations/0008_runtime_tables.sql", import.meta.url), "utf8");
  for (const table of [
    "hero_inventory",
    "hero_summon_history",
    "kingdom_cosmetics",
    "kingdom_cosmetic_wallet",
    "kingdom_collection_claims",
    "shop_inventory",
    "merchant_stock"
  ]) {
    assert.match(migration, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
  }
});

test("requisições do jogo não executam DDL para criar tabelas", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.doesNotMatch(worker, /CREATE TABLE IF NOT EXISTS (hero_inventory|hero_summon_history|kingdom_cosmetics|kingdom_cosmetic_wallet|kingdom_collection_claims|shop_inventory|merchant_stock)/);
  assert.doesNotMatch(worker, /ensureHeroTables|ensureShopTables/);
  assert.match(worker, /INSERT OR IGNORE INTO kingdom_cosmetic_wallet/);
});
