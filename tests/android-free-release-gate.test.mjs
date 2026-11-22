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

test("advisory free-mode probe cannot replace release workflow safeguards", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow=await readFile(new URL("../.github/workflows/publicar-apk-android.yml",import.meta.url),"utf8");
  const gradle=await readFile(new URL("../android-sideload/app/build.gradle",import.meta.url),"utf8");
  const diagnostic=await readFile(new URL("../scripts/check-android-free-release.mjs",import.meta.url),"utf8");
  const commercialChecks=(workflow.match(/run: node scripts\/check-commercial-store\.mjs/g)||[]).length;
  assert.equal(commercialChecks,2,"commercial release still checks the store twice");
  assert.doesNotMatch(workflow,/run: node scripts\/check-android-free-release\.mjs/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/ANDROID_RELEASE_CERT_SHA256/);
  assert.match(workflow,/assembleRelease/);
  assert.doesNotMatch(workflow,/assembleDebug|debug\.keystore/);
  assert.doesNotMatch(gradle,/debug\.keystore|androiddebugkey/);
  assert.match(gradle,/if \(releaseSigningAvailable\)/);
  assert.match(diagnostic,/DIAGNOSTIC ONLY/);
  assert.match(diagnostic,/APK publication NOT authorized/);
});
