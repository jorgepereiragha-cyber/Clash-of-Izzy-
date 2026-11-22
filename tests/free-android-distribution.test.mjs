import test from "node:test";
import assert from "node:assert/strict";
import { assertFreeDistribution, checkFreeDistribution } from "../scripts/check-free-android-distribution.mjs";
test("only explicitly disabled payment methods permit free APK", () => {
  assert.deepEqual(assertFreeDistribution({mercadoPago:false,nubankPix:false}), {freeDistribution:true,paymentsEnabled:false});
  for (const methods of [null, {}, {mercadoPago:true,nubankPix:false}, {mercadoPago:false,nubankPix:true}, {mercadoPago:0,nubankPix:false}, []]) {
    assert.throws(() => assertFreeDistribution(methods));
  }
});
test("only read-only GET and HTTP 200 are accepted", async () => {
  let called=false;
  const result=await checkFreeDistribution(async (url,opts)=>{
    called=true; assert.match(url,/\/api\/store\/payment-methods$/); assert.equal(opts.method,"GET");
    return {status:200,json:async()=>({mercadoPago:false,nubankPix:false})};
  });
  assert.equal(called,true); assert.equal(result.freeDistribution,true);
  await assert.rejects(checkFreeDistribution(async()=>({status:503,json:async()=>({mercadoPago:false,nubankPix:false})})));
  await assert.rejects(checkFreeDistribution(async()=>({status:200,json:async()=>{throw Error("bad json")}})));
});
