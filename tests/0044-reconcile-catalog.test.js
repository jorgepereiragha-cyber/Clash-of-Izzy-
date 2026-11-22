import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");

test("0044 only updates precisely known legacy catalog values, not customized or pending prices", async () => {
  const sql = await read("migrations/0044_reconcile_level_packs.sql");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE vip_packages (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        price_brl REAL NOT NULL,
        gems INTEGER NOT NULL
      );
      CREATE TABLE purchase_requests (
        id INTEGER PRIMARY KEY,
        product_kind TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        status TEXT NOT NULL
      );
      INSERT INTO vip_packages(id,name,price_brl,gems) VALUES
        (1,'Pacote Marques Real',89.90,8000),
        (2,'Pacote Duque Imperial',129.90,12000),
        (3,'Pacote Principe Soberano',175.00,17000),
        (4,'Pacote Rei Supremo',299.90,60000),
        (5,'Pacote Imperador Eterno',299.90,30000),
        (6,'Pacote Lord Iniciante',9.90,500);
      INSERT INTO purchase_requests(id,product_kind,product_id,status)
        VALUES (100,'vip_package',2,'pending');
    `);
    db.exec(sql);
    const list = db.prepare(
      "SELECT id,ROUND(price_brl*100) AS cents,gems FROM vip_packages ORDER BY id"
    ).all().map(({id,cents,gems})=>[Number(id),Number(cents),Number(gems)]);
    assert.deepEqual(list, [
      [1,9990,10000],  // expected legacy pair: corrected
      [2,12990,12000], // pending paid order: unchanged for manual review
      [3,17500,17000], // custom price: unchanged
      [4,29990,60000], // already canonical: unchanged
      [5,49990,100000],// expected legacy pair: corrected
      [6,990,500]      // P1: untouched
    ]);
    db.exec(sql);
    const again = db.prepare(
      "SELECT id,ROUND(price_brl*100) AS cents,gems FROM vip_packages ORDER BY id"
    ).all().map(({id,cents,gems})=>[Number(id),Number(cents),Number(gems)]);
    assert.deepEqual(again,list,"0044 must be idempotent");
    db.exec("DELETE FROM purchase_requests WHERE id=100");
    db.exec(sql);
    const p5=db.prepare("SELECT ROUND(price_brl*100) AS cents,gems FROM vip_packages WHERE id=2").get();
    assert.equal(Number(p5.cents),14990);
    assert.equal(Number(p5.gems),20000);
  } finally {
    db.close();
  }
});

test("never include 0043_align alongside canonical 0043_fix and conditional 0044", async () => {
  const filenames = await readdir(new URL("../migrations/",import.meta.url));
  assert.ok(filenames.includes("0044_reconcile_level_packs.sql"));
  assert.equal(filenames.includes("0043_align_level_pack_catalog.sql"),false);
  const canonical=filenames.filter(f=>/^0043_.*\.sql$/.test(f));
  assert.ok(canonical.length <= 1);
  if(canonical.length)assert.deepEqual(canonical,["0043_fix_vip_catalog.sql"]);
  const sql=await read("migrations/0044_reconcile_level_packs.sql");
  const statements=sql.replace(/^\s*--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean);
  assert.equal(statements.length,5);
  for(const statement of statements){
    assert.match(statement,/^UPDATE vip_packages\s+SET price_brl=/);
    assert.match(statement,/WHERE name='[^']+'\s+AND ROUND\(price_brl\*100\)=\d+\s+AND gems=\d+/);
    assert.match(statement,/AND NOT EXISTS\s*\(/);
    assert.match(statement,/r\.status='pending'/);
  }
});
