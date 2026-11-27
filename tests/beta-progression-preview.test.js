import test from "node:test";
import assert from "node:assert/strict";
import { betaProgressionPreview } from "../scripts/beta-progression-preview.js";
import { LEVEL_PACKS } from "../level-packs.js";
import { MASTER_PACK_BONUSES } from "../master-pack.js";
import { betaPaymentDisabled } from "../beta-access.js";

test("beta preview uses canonical progression prices and rewards without exposing purchase IDs",()=>{
 const env={ENVIRONMENT:"beta",LEVEL_PACKS_ENABLED:"false",MASTER_PACK_ENABLED:"false"};
 const preview=betaProgressionPreview(env);
 assert.equal(preview.previewOnly,true);
 assert.equal(preview.purchaseEnabled,false);
 assert.equal(preview.packages.length,9);
 for(const [i,pack] of LEVEL_PACKS.entries()){
  const actual=preview.packages[i];
  assert.equal(actual.name,pack.name);
  assert.equal(actual.price_brl,pack.priceCents/100);
  assert.equal(actual.gems,pack.gems);
  assert.deepEqual(actual.levelPack.resources,pack.resources);
  assert.equal(actual.levelPack.priceProvisional,pack.level>=40);
  assert.equal(Object.hasOwn(actual,"id"),false);
 }
 assert.deepEqual(preview.packages[8].bonus,MASTER_PACK_BONUSES);
 assert.equal(betaProgressionPreview({ENVIRONMENT:"production"}),null);
 assert.equal(betaPaymentDisabled("/api/store/purchase-request","POST",env),true);
});
