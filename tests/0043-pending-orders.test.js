import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

test("0043 protects pending requests and customized prices before catalog migration", async () => {
  const sql = await readFile(new URL("../migrations/0043_fix_vip_catalog.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /INSERT\s+OR\s+REPLACE/i);
  const clauses = sql.replace(/^\s*--[^\n]*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean);
  assert.equal(clauses.length,5);
  for (const clause of clauses) {
    assert.match(clause, /^UPDATE vip_packages SET/);
    assert.match(clause, /ROUND\(price_brl\*100\)=\d+ AND gems=\d+/);
    assert.match(clause, /AND NOT EXISTS\s*\(/);
    assert.match(clause, /r\.product_id=vip_packages\.id/);
    assert.match(clause, /r\.status='pending'/);
  }
  const db=new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE vip_packages (id INTEGER PRIMARY KEY, name TEXT UNIQUE, price_brl REAL, gems INTEGER);
      CREATE TABLE purchase_requests (id INTEGER PRIMARY KEY,product_kind TEXT,product_id INTEGER,status TEXT);
      INSERT INTO vip_packages VALUES
        (1,'Pacote Marques Real',89.90,8000),
        (2,'Pacote Duque Imperial',129.90,12000),
        (3,'Pacote Principe Soberano',175.00,17000),
        (4,'Pacote Rei Supremo',299.90,60000),
        (5,'Pacote Imperador Eterno',299.90,30000);
      INSERT INTO purchase_requests VALUES (77,'vip_package',2,'pending');
    `);
    db.exec(sql);
    const rows=db.prepare("SELECT id, ROUND(price_brl*100) AS cents,gems FROM vip_packages ORDER BY id")
      .all().map(x=>[Number(x.id),Number(x.cents),Number(x.gems)]);
    assert.deepEqual(rows,[
      [1,9990,10000],
      [2,12990,12000],  // Pending order, do not change.
      [3,17500,17000],  // Customized price, do not change.
      [4,29990,60000],  // Canonical price, do not change.
      [5,49990,100000]
    ]);
    db.exec(sql);
    const after=db.prepare("SELECT id, ROUND(price_brl*100) AS cents,gems FROM vip_packages ORDER BY id")
      .all().map(x=>[Number(x.id),Number(x.cents),Number(x.gems)]);
    assert.deepEqual(after,rows);
  } finally { db.close(); }
});
