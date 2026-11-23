import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFreeAndroidDistribution,checkFreeAndroidDistribution,ORIGIN} from '../scripts/check-free-android-distribution.mjs';

test('accepts only explicitly disabled checkout methods',()=>{
  assert.deepEqual(assertFreeAndroidDistribution({mercadoPago:false,nubankPix:false}),{freeDistribution:true,checkoutEnabled:false});
  for(const value of [null,{},[],{mercadoPago:true,nubankPix:false},{mercadoPago:false,nubankPix:true},{mercadoPago:0,nubankPix:false},{mercadoPago:false,nubankPix:null}]) {
    assert.throws(()=>assertFreeAndroidDistribution(value));
  }
});
test('uses read-only endpoint and rejects invalid status and JSON',async()=>{
  let called=0;
  const ok=await checkFreeAndroidDistribution(async (url,opts)=>{
    called++; assert.equal(url,ORIGIN+'/api/store/payment-methods'); assert.equal(opts.method,'GET'); assert.equal(opts.redirect,'error');
    return {status:200,json:async()=>({mercadoPago:false,nubankPix:false})};
  });
  assert.equal(called,1); assert.equal(ok.checkoutEnabled,false);
  await assert.rejects(checkFreeAndroidDistribution(async()=>({status:503,json:async()=>({})})));
  await assert.rejects(checkFreeAndroidDistribution(async()=>({status:200,json:async()=>{throw Error('bad json')}})));
});
