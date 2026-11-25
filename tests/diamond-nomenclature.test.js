import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
test("nomenclatura pública Diamantes sem renomear o contrato gems", () => {
  for (const path of ["kingdom.html","market.html","market.js","apoie.html","public-portal/apoie.html","admin.html","arena.html","events.html","equipment-ui.html","equipment-system.js","master-pack.js"]) {
    const text = read(path);
    assert.match(text, /\bdiamantes\b/i, path);
    assert.doesNotMatch(text, /\bgemas\b/i, path);
  }
  assert.match(read("kingdom.html"), /"💎","Diamantes","gems",state\?\.player\?\.gems/);
  assert.match(read("admin.html"), /\/admin\/gems/);
  assert.equal(read("apoie.html"), read("public-portal/apoie.html"));
});
