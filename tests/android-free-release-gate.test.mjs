import test from "node:test";
import assert from "node:assert/strict";
import { assertFreeDistribution, checkFreeDistribution } from "../scripts/check-android-free-release.mjs";

test("free APK release requires both methods explicitly disabled", () => {
  assert.equal(assertFreeDistribution({ mercadoPago:false, nubankPix:false }), true);
  for (const methods of [null, {}, [], {mercadoPago:true,nubankPix:false},
    {mercadoPago:false,nubankPix:true}, {mercadoPago:0,nubankPix:false},
    {mercadoPago:false,nubankPix:null}]) {
    assert.throws(() => assertFreeDistribution(methods));
  }
});
test("release gate only performs read-only GET", async () => {
  let calls=0;
  await checkFreeDistribution(async (url, options) => {
    calls++;
    assert.match(url, /\/api\/store\/payment-methods$/);
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"error");
    return {status:200,json:async()=>({mercadoPago:false,nubankPix:false})};
  });
  assert.equal(calls,1);
});
test("HTTP errors and ambiguous JSON block publication", async () => {
  await assert.rejects(checkFreeDistribution(async()=>({status:503})));
  await assert.rejects(checkFreeDistribution(async()=>({status:200,json:async()=>({mercadoPago:false})})));
  await assert.rejects(checkFreeDistribution(async()=>({status:200,json:async()=>{throw Error("invalid JSON")}})));
});
