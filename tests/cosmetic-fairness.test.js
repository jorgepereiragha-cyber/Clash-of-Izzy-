import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../equipment-ui.html", import.meta.url), "utf8");
const client = await readFile(new URL("../equipment-system.js", import.meta.url), "utf8");

function block(startMarker, endMarker) {
  const start = worker.indexOf(startMarker);
  const end = worker.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "catalog boundaries must exist");
  return worker.slice(start, end);
}

test("standard, seasonal and fused skins are cosmetic-only", () => {
  for (const [start, end] of [
    ["const COSMETIC_SKINS={", "const COSMETIC_COLLECTIONS=["],
    ["const SEASONAL_COSMETICS=[", "const SKIN_FUSIONS=["],
    ["const SKIN_FUSIONS=[", "async function ensureCosmeticDefaults"]
  ]) {
    assert.doesNotMatch(block(start, end), /\\b(?:atk|def|attack|defense|special)\\s*:/i);
  }
});

test("the six Norse deity skins are present in the existing cosmetic catalog", () => {
  for (const marker of ['n1:{name:"Odin', 'n2:{name:"Thor', 'n3:{name:"Freyja', 'n4:{name:"Loki', 'n5:{name:"Týr', 'n6:{name:"Heimdall', 'id:"col_norse"']) assert.ok(worker.includes(marker), "missing Norse skin or collection: " + marker);
});

test("skin purchases and seasonal purchases debit gems and insert ownership atomically", () => {
  assert.match(worker, /type==="cosmetic_buy"/);
  assert.match(worker, /UPDATE players SET gems=gems-\\? WHERE id=\\? AND gems>=\\? AND NOT EXISTS/);
  assert.match(worker, /INSERT INTO kingdom_cosmetics\\(kingdom_id,item_id,kind\\) SELECT/);
  assert.match(worker, /WHERE changes\\(\\)>0/);
});

test("skin fusion debits fragments and consumes three inputs in one D1 batch", () => {
  assert.match(worker, /UPDATE kingdom_cosmetic_wallet SET shards=shards-50/);
  assert.match(worker, /SELECT COUNT\\(\\*\\) FROM kingdom_cosmetics/);
  assert.match(worker, /DELETE FROM kingdom_cosmetics WHERE kingdom_id=\\? AND item_id=\\? AND changes\\(\\)>0/);
});

test("the equipment screen exposes the Norse skin shop and collection reward", () => {
  assert.ok(ui.includes('id="norse-skin-list"'));
  assert.ok(ui.includes('id="claim-norse-collection"'));
  assert.ok(client.includes('type:"cosmetic_buy"'));
  assert.ok(client.includes('type:"cosmetic_claim"'));
});
