import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("recompensa de coleção é idempotente sob requisições concorrentes", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const start = worker.indexOf('if(type==="cosmetic_claim")');
  const end = worker.indexOf('}else if(type==="seasonal_buy")', start);
  assert.ok(start >= 0 && end > start, "bloco de resgate de coleção encontrado");
  const claim = worker.slice(start, end);
  assert.match(claim, /INSERT INTO kingdom_collection_claims[\s\S]*ON CONFLICT\(kingdom_id,collection_id\) DO NOTHING/);
  assert.match(claim, /UPDATE players SET gems=gems\+\? WHERE id=\? AND changes\(\)>0/);
  assert.match(claim, /UPDATE kingdom_cosmetic_wallet SET shards=shards\+\? WHERE kingdom_id=\? AND changes\(\)>0/);
  assert.match(claim, /if\(!result\[0\]\?\.meta\?\.changes\)return json\(\{error:"Esta recompensa já foi resgatada\."/);
  assert.ok(claim.indexOf("INSERT INTO kingdom_collection_claims") < claim.indexOf("UPDATE players SET gems"));
});
