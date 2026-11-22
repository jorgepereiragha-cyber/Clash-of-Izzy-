import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("R$ 3,99 starter package is seeded exactly once with an honest reward", async () => {
  const migration = await read("migrations/0031_entry_package_399.sql");
  assert.match(migration, /INSERT OR IGNORE INTO vip_packages\(name, price_brl, gems\)/);
  assert.match(migration, /\('Pacote Inicial de Eldoria', 3\.99, 35\)/);
  assert.equal((migration.match(/Pacote Inicial de Eldoria/g)||[]).length, 1);
  assert.doesNotMatch(migration, /INSERT INTO (?:players|kingdoms|player_skins)|UPDATE players/i);
});

test("the store uses D1 catalog price and grants its gems only after verified settlement", async () => {
  const worker = await read("worker.js");
  const arena = await read("arena.html");
  const provider = await read("mercadopago-orders.js");
  assert.match(worker, /SELECT id,name,price_brl,gems FROM vip_packages ORDER BY price_brl,name/);
  assert.match(worker, /SELECT id,name,price_brl,gems FROM vip_packages WHERE id=\?/);
  assert.match(worker, /item\.price_brl/);
  assert.match(worker, /kind==="vip_package"\?Number\(item\.gems\|\|0\):0/);
  assert.match(worker, /UPDATE players SET gems=gems\+\?/);
  assert.match(worker, /changes\(\)=1 AND EXISTS\(SELECT 1 FROM purchase_requests/);
  assert.match(provider, /actualCents === expectedCents/);
  assert.match(provider, /paidCents === expectedCents/);
  assert.match(arena, /price\.textContent='R\$ '\+Number\(item\.price_brl\)\.toFixed\(2\)\.replace\('\.',','\)/);
  assert.match(arena, /Number\(item\.gems\|\|0\)\.toLocaleString\('pt-BR'\)\+' gemas após confirmação'/);
});
