import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Mercador de Eldoria oferece trocas rotativas e usa estoque persistente por reino", async () => {
  const worker = await read("worker.js");
  const runtime = await read("migrations/0009_runtime_tables.sql");
  const page = await read("market.html");
  const ui = await read("market.js");
  assert.match(worker, /const MERCHANT_EXCHANGE_POOL=/);
  assert.match(worker, /function merchantExchangeOffers\(cycle\)/);
  assert.match(worker, /type==="merchant_exchange"/);
  assert.match(worker, /UPDATE merchant_stock SET stock=stock-1 WHERE kingdom_id=\? AND cycle_id=\? AND item_id=\? AND stock>0/);
  assert.match(worker, /INSERT INTO shop_inventory\(kingdom_id,item_id,quantity\) SELECT \?,\?,\?/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS merchant_stock/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS shop_inventory/);
  assert.match(page, /id="merchant-exchanges"/);
  assert.match(ui, /type:"merchant_exchange"/);
});

test("Loja de Heróis só vende fragmentos para heróis pertencentes ao reino", async () => {
  const worker = await read("worker.js");
  const migration = await read("migrations/0009_runtime_tables.sql");
  const page = await read("market.html");
  const ui = await read("market.js");
  assert.match(worker, /const HERO_FRAGMENT_SHOP=/);
  assert.match(worker, /async function getHeroShopState/);
  assert.match(worker, /type==="hero_shop_buy"/);
  assert.match(worker, /SELECT rarity,fragments FROM hero_inventory WHERE kingdom_id=\? AND hero_key=\?/);
  assert.match(worker, /A loja só vende fragmentos de heróis que você já recrutou/);
  assert.match(worker, /UPDATE hero_inventory SET fragments=fragments\+\?/);
  assert.match(migration, /PRIMARY KEY \(kingdom_id, hero_key\)/);
  assert.match(page, /id="hero-offers"/);
  assert.match(ui, /type:"hero_shop_buy"/);
});

test("aceleradores são consumidos apenas na fila compatível e o prazo é recalculado no Worker", async () => {
  const worker = await read("worker.js");
  const migration = await read("migrations/0016_strategy_queues_and_mage.sql");
  const page = await read("market.html");
  const ui = await read("market.js");
  assert.match(worker, /type==="queue_speedup"/);
  assert.match(worker, /construction:\{acc_5min:300,acc_1h:3600,acc_8h:28800,acc_1d:86400\}/);
  assert.match(worker, /training:\{train_1h:3600,train_8h:28800\}/);
  assert.match(worker, /research:\{res_1h:3600,res_8h:28800\}/);
  assert.match(worker, /UPDATE shop_inventory SET quantity=quantity-\?/);
  assert.match(worker, /UPDATE kingdom_queues SET completes_at=\?/);
  assert.match(migration, /CREATE TABLE kingdom_queues/);
  assert.match(page, /id="active-queues"/);
  assert.match(ui, /type:"queue_speedup"/);
});

test("mercado aparece na navegação e fica disponível no shell offline", async () => {
  const nav = await read("navigation.js");
  const sw = await read("sw.js");
  const page = await read("market.html");
  assert.match(nav, /Mercador & Heróis/);
  assert.match(nav, /\/market\.html/);
  assert.match(sw, /clash-of-izzy-shell-v39/);
  for (const asset of ["/market.html","/market.js","/market.css"]) assert.ok(sw.includes('"'+asset+'"'), "asset offline ausente: "+asset);
  assert.match(page, /lang="pt-BR"/);
  assert.match(page, /id="market-status"/);
});
