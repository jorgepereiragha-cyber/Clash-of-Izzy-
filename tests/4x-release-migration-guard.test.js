import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("P1-P8 migration 0043 has only one approved canonical file", async () => {
  const names = (await readdir(new URL("../migrations/", import.meta.url)))
    .filter(name => /^0043_.*\.sql$/.test(name));

  // The legacy main intentionally contains some distinct 0002/0004/0012
  // migrations. Do not reject all duplicate numeric prefixes globally.
  assert.ok(
    names.length <= 1,
    "Multiple migrations with prefix 0043 can apply conflicting catalog corrections: " + names.join(", ")
  );

  assert.doesNotMatch(names.join(","), /0043_align_level_pack_catalog\.sql/,
    "Unconditional catalog update from stale PR #238 must not reach main");

  if (names.length === 1) {
    assert.equal(names[0], "0043_fix_vip_catalog.sql",
      "Change this release gate only after commercial and D1 Preview approval");
    const sql = await readFile(new URL("../migrations/" + names[0], import.meta.url), "utf8");
    assert.doesNotMatch(sql, /INSERT\s+OR\s+REPLACE/i);
    const statements = sql.split(";").map(s => s.trim()).filter(s => /^UPDATE\s+vip_packages\b/i.test(s));
    assert.equal(statements.length, 5);
    for (const stmt of statements) {
      assert.match(stmt, /WHERE\s+name='[^']+'\s+AND\s+ROUND\(price_brl\*100\)=\d+\s+AND\s+gems=\d+\s*$/i,
        "catalog corrective UPDATE must guard both old price and old gems");
    }
  }
});
