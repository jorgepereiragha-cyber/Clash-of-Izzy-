import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { LEVEL_PACKS, levelPacksEnabledForPlayer, levelPackPriceApproved } from "../level-packs.js";
import { handleValhallaShop } from "../valhalla-shop.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const migrations = await Promise.all([
  read("migrations/0043_fix_vip_catalog.sql"),
  read("migrations/0044_reconcile_level_packs.sql")
]);

function signatures(sql) {
  const updates = sql.match(/UPDATE vip_packages\b[\s\S]*?;/g) || [];
  return updates.map(stmt => {
    const name = stmt.match(/\bname='([^']+)'/);
    const updated = stmt.match(/\bSET\s+price_brl=([0-9.]+)\s*,\s*gems=(\d+)/);
    const original = stmt.match(/\bROUND\(price_brl\*100\)=(\d+)\s+AND\s+gems=(\d+)/);
    assert.ok(name && updated && original, "Invalid catalog reconciliation SQL");
    assert.match(stmt, /\bNOT\s+EXISTS\s*\(/);
    assert.match(stmt, /r\.status='pending'/);
    return [name[1], Number(updated[1]), Number(updated[2]), Number(original[1]), Number(original[2])];
  });
}

test("0043 and 0044 have identical guarded legacy corrections and retain distinct ledger filenames", () => {
  const [first, second] = migrations.map(signatures);
  assert.equal(first.length, 5);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(p=>p[0])).size, 5);
});

test("0043 followed by 0044 is idempotent; pending and custom catalog rows stay untouched", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE vip_packages(id INTEGER PRIMARY KEY, name TEXT UNIQUE, price_brl REAL, gems INTEGER);
      CREATE TABLE purchase_requests(id INTEGER PRIMARY KEY,product_kind TEXT,product_id INTEGER,status TEXT);
      INSERT INTO vip_packages VALUES
        (1,'Pacote Marques Real',89.90,8000),
        (2,'Pacote Duque Imperial',129.90,12000),
        (3,'Pacote Principe Soberano',175.00,17000),
        (4,'Pacote Rei Supremo',229.90,23000),
        (5,'Pacote Imperador Eterno',299.90,30000),
        (6,'Pacote Lord Iniciante',9.90,500);
      INSERT INTO purchase_requests VALUES(100,'vip_package',2,'pending');
    `);
    const snapshot=()=>db.prepare("SELECT id,ROUND(price_brl*100) AS cents,gems FROM vip_packages ORDER BY id")
      .all().map(row=>[Number(row.id),Number(row.cents),Number(row.gems)]);
    db.exec(migrations[0]);
    const after43=snapshot();
    db.exec(migrations[1]);
    assert.deepEqual(snapshot(),after43,"0044 cannot apply another update after 0043");
    db.exec(migrations[1]);
    assert.deepEqual(snapshot(),after43,"replay cannot change balances or prices");
    assert.deepEqual(after43,[
      [1,9990,10000],[2,12990,12000],[3,17500,17000],
      [4,29990,60000],[5,49990,100000],[6,990,500]
    ]);
    db.exec("DELETE FROM purchase_requests WHERE id=100");
    db.exec(migrations[1]);
    assert.deepEqual(snapshot()[1],[2,14990,20000],"pending order removal permits exact legacy correction");
  } finally { db.close(); }
});

test("P1-P3 prices and rewards are complete and 4X guard remains required", () => {
  for (const [index,cents,gems] of [[0,990,500],[1,2990,2000],[2,5990,5000]]) {
    const pack=LEVEL_PACKS[index];
    assert.equal(pack.priceCents,cents);
    assert.equal(pack.gems,gems);
    assert.ok(Object.values(pack.resources).some(qty=>Number.isSafeInteger(qty)&&qty>0));
    assert.equal(levelPackPriceApproved({},pack),true);
  }
  assert.equal(levelPackPriceApproved({},LEVEL_PACKS[3]),false);
  assert.equal(levelPacksEnabledForPlayer({
    LEVEL_PACKS_ENABLED:"true",LEVEL_PACKS_PUBLIC_ENABLED:"true",GAME_4X_SYSTEMS_ENABLED:"false"
  },"test-id"),false);
});

test("Valhalla handler is complete, exported and fails closed when D1 is unavailable", async () => {
  assert.equal(typeof handleValhallaShop,"function");
  const script=await read("valhalla-shop.js");
  for (const route of ["/api/game/valhalla-shop/catalog","/api/game/valhalla-shop/history","/api/game/valhalla-shop/buy"])
    assert.ok(script.includes(route),route);
  const response=await handleValhallaShop(
    new Request("https://eldoria.invalid/api/game/valhalla-shop/catalog"),{}, "player");
  assert.equal(response.status,503);
});

test("Shop UI never renders NaN prices or blank resource separators, and disables invalid offers", async () => {
  const arena=await read("arena.html");
  assert.match(arena,/Number\.isFinite\(priceValue\)&&priceValue>0/);
  assert.match(arena,/Number\.isSafeInteger\(gemsValue\)&&gemsValue>0/);
  assert.match(arena,/resourceText\?' · '\+resourceText:''/);
  assert.match(arena,/Preço indisponível/);
  assert.match(arena,/!validPrice\|\|!validGems/);
});
