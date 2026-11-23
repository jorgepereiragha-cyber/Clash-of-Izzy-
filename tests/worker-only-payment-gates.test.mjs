import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ORIGIN, PATH, assertNoLivePaymentMethods, assertWorkerOnlyPaymentState
} from "../scripts/check-worker-only-payment-state.mjs";
import { assertArenaPaymentOptionsSafe } from "../scripts/production-smoke.js";

const source = async path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Worker-only checkout gate blocks any non-false or ambiguous payment status", () => {
  assert.deepEqual(assertNoLivePaymentMethods({mercadoPago:false,nubankPix:false}),
    {workerOnlyPaymentsDisabled:true,methodsChecked:2});
  for(const state of [
    null, [], {}, {mercadoPago:true,nubankPix:false},
    {mercadoPago:false,nubankPix:true}, {mercadoPago:0,nubankPix:false},
    {mercadoPago:"false",nubankPix:false}, {mercadoPago:false},
    {mercadoPago:false,nubankPix:null}
  ]) assert.throws(() => assertNoLivePaymentMethods(state), /Worker-only release blocked/);
});

test("Worker-only payment status audit does only GET over fixed HTTPS origin, no redirects", async () => {
  let calls=0;
  const result=await assertWorkerOnlyPaymentState(async (url,options) => {
    calls++;
    assert.equal(url, ORIGIN + PATH);
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"error");
    assert.equal(options.headers["Cache-Control"],"no-cache");
    return {status:200,json:async()=>({mercadoPago:false,nubankPix:false})};
  });
  assert.equal(calls,1);
  assert.equal(result.workerOnlyPaymentsDisabled,true);
});

test("Worker-only payment audit fails closed on HTTP errors and invalid JSON", async () => {
  await assert.rejects(assertWorkerOnlyPaymentState(async()=>({status:503})),/status unavailable/);
  await assert.rejects(assertWorkerOnlyPaymentState(async()=>({status:200,json:async()=>{throw Error("bad json")}})),/must explicitly be false/);
  await assert.rejects(assertWorkerOnlyPaymentState(async()=>({status:200,json:async()=>({mercadoPago:true,nubankPix:false})})),/must explicitly be false/);
});

test("production arena smoke detects enabled Pix and legacy payment options", async () => {
  assert.equal(assertArenaPaymentOptionsSafe('<option value="pix" disabled>Nubank</option>'),true);
  assert.equal(assertArenaPaymentOptionsSafe("<option disabled value='pix'>Pix</option>"),true);
  assert.equal(assertArenaPaymentOptionsSafe("<option value='pix' disabled='disabled'>Pix</option>"),true);
  assert.equal(assertArenaPaymentOptionsSafe("<option value='mercadopago_link'>Mercado Pago</option>"),true);
  assert.throws(()=>assertArenaPaymentOptionsSafe('<option value="pix">Pix</option>'),/iniciar desabilitada/);
  assert.throws(()=>assertArenaPaymentOptionsSafe("<option value=pix>Pix</option>"),/iniciar desabilitada/);
  assert.throws(()=>assertArenaPaymentOptionsSafe("<option value='manual' disabled>Manual</option>"),/legadas/);
  assert.throws(()=>assertArenaPaymentOptionsSafe("<option value='bank_transfer'>TED</option>"),/legadas/);
  assert.equal(assertArenaPaymentOptionsSafe(await source("arena.html")),true);
});

test("protected Worker-only deployment audits payment state before and after publishing", async () => {
  const workflow=await source(".github/workflows/deploy-worker-only.yml");
  const first=workflow.indexOf("node scripts/check-worker-only-payment-state.mjs");
  const publish=workflow.indexOf("run: npx wrangler --config wrangler.jsonc deploy\n");
  const last=workflow.lastIndexOf("node scripts/check-worker-only-payment-state.mjs");
  assert.ok(first>0&&publish>first&&last>publish);
  assert.equal(workflow.split("node scripts/check-worker-only-payment-state.mjs").length-1,2);
  assert.match(workflow,/environment:\s*\n\s*name: production/);
  assert.match(workflow,/confirm_worker_publish:/);
  assert.doesNotMatch(workflow,/d1 migrations apply[^\n]*--remote/);
  assert.doesNotMatch(workflow,/d1 execute[^\n]*--remote/);
  const assets=await source(".assetsignore");
  assert.ok(assets.split(/\r?\n/).includes("scripts/check-worker-only-payment-state.mjs"));
});

test("production smoke never follows unexpected redirects or silently skips payment-option checks", async()=>{
  const smoke=await source("scripts/production-smoke.js");
  assert.match(smoke,/redirect: "manual"/);
  assert.match(smoke,/Redirecionamento inesperado no smoke GET/);
  assert.doesNotMatch(smoke,/redirect: "follow"/);
  assert.match(smoke,/assertArenaPaymentOptionsSafe\(arena\)/);
});
