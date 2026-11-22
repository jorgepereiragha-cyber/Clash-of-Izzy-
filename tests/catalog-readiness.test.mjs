import test from "node:test";
import assert from "node:assert/strict";
import {REQUIRED_OFFERS} from "../scripts/check-commercial-store.mjs";
import {assertCatalogReady,checkCatalog} from "../scripts/check-catalog-readiness.mjs";

function valid() {
  return {packages:REQUIRED_OFFERS.map(x=>({
    name:x.name,price_brl:x.priceCents/100,gems:x.gems,
    ...(x.daily?{dailyLimitHours:24}:{}),
    ...(x.master?{oneTime:true,bonus:{gems:1}}:{})
  })),skins:Array.from({length:6},(_,i)=>({id:i+1}))};
}
test("valid catalog does not assert payment readiness",()=>{
  assert.deepEqual(assertCatalogReady(valid()),{
    catalogReady:true,packages:REQUIRED_OFFERS.length,skins:6,paymentsVerified:false
  });
});
test("missing and duplicate offers are rejected",()=>{
  const missing=valid();missing.packages.pop();
  assert.throws(()=>assertCatalogReady(missing),/exactly one/);
  const duplicate=valid();duplicate.packages.push({...duplicate.packages[0]});
  assert.throws(()=>assertCatalogReady(duplicate),/exactly one/);
});
test("price, daily limit, master entitlement and skins are checked",()=>{
  for (const mutate of [
    x=>{x.packages[0].price_brl=0},
    x=>{x.packages[0].dailyLimitHours=12},
    x=>{x.packages.at(-1).oneTime=false},
    x=>{x.skins=[]}
  ]) {const x=valid();mutate(x);assert.throws(()=>assertCatalogReady(x));}
});
test("HTTP errors reject without exposing payment state",async()=>{
  await assert.rejects(checkCatalog(async()=>({status:503})),/HTTP 503/);
});
test("catalog fetch uses GET and refuses redirects",async()=>{
  let seen;
  const result=await checkCatalog(async(url,opts)=>{
    seen={url,opts};return {status:200,json:async()=>valid()};
  });
  assert.equal(seen.opts.method,"GET");
  assert.equal(seen.opts.redirect,"error");
  assert.equal(result.paymentsVerified,false);
});
