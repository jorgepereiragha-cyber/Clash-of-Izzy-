import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker from "../worker.js";
import {
  FREE_FIRST_MODE_FLAG, PAID_ORDER_CREATION_PATHS,
  freeFirstModeEnabled,blockNewPaidOrders,visiblePaymentMethods
} from "../free-first-payment-policy.js";

const env = () => ({
  DB:{},
  GAME_FREE_FIRST_MODE_ENABLED:"true",
  MP_ACCESS_TOKEN:"test-token-not-for-production",
  MP_WEBHOOK_SECRET:"test-webhook-not-for-production",
  NUBANK_PIX_KEY:"not-a-real-pix-key",
  NUBANK_PIX_ENABLED:"true",
  NUBANK_PIX_RECEIVER_VERIFIED:"true"
});

test("free-first must be explicitly true, not inferred from absent payment secrets",()=>{
  assert.equal(FREE_FIRST_MODE_FLAG,"GAME_FREE_FIRST_MODE_ENABLED");
  for(const value of [undefined,false,true,"false","TRUE","1","yes",""]){
    assert.equal(freeFirstModeEnabled({GAME_FREE_FIRST_MODE_ENABLED:value}),false);
  }
  assert.equal(freeFirstModeEnabled({GAME_FREE_FIRST_MODE_ENABLED:"true"}),true);
  assert.equal(freeFirstModeEnabled({}),false);
});

test("all new paid-order entry points are blocked including manual WhatsApp",()=>{
  assert.deepEqual([...PAID_ORDER_CREATION_PATHS].sort(),[
    "/api/store/checkout",
    "/api/store/pix-instructions",
    "/api/store/purchase-request",
    "/api/support/checkout"
  ].sort());
  for(const path of PAID_ORDER_CREATION_PATHS){
    assert.equal(blockNewPaidOrders(env(),"POST",path),true,path);
    assert.equal(blockNewPaidOrders(env(),"GET",path),false,path);
    assert.equal(blockNewPaidOrders({},"POST",path),false,path);
  }
  assert.equal(blockNewPaidOrders(env(),"POST","/api/webhook/mp"),false);
  assert.equal(blockNewPaidOrders(env(),"POST","/api/admin/purchase-requests/review"),false);
  assert.equal(blockNewPaidOrders(env(),"POST","/api/game/action"),false);
});

test("Worker routes fail closed before parsing orders, billing, authentication or writing D1",async()=>{
  for(const path of PAID_ORDER_CREATION_PATHS){
    const response=await worker.fetch(new Request("https://clash-of-izzy.invalid"+path,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({paymentMethod:"manual_whatsapp",itemId:1,requestKey:"test123456789012"})
    }),env());
    assert.equal(response.status,503,path);
    const data=await response.json();
    assert.equal(data.code,"FREE_FIRST_PAYMENTS_DISABLED",path);
  }
});

test("advertised methods cannot be enabled while free-first is active",async()=>{
  assert.deepEqual(visiblePaymentMethods(env(),true),{
    mercadoPago:false,nubankPix:false,freeFirstMode:true
  });
  const response=await worker.fetch(new Request("https://clash-of-izzy.invalid/api/store/payment-methods"),env());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    mercadoPago:false,nubankPix:false,freeFirstMode:true
  });
  const noMode=visiblePaymentMethods({
    MP_ACCESS_TOKEN:"token",MP_WEBHOOK_SECRET:"secret"
  },true);
  assert.equal(noMode.freeFirstMode,false);
  assert.equal(noMode.mercadoPago,true);
  assert.equal(noMode.nubankPix,true);
});

test("free-first cannot silently turn on or replace commercial Android release gate",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/publicar-apk-android.yml",import.meta.url),"utf8");
  const ignore=readFileSync(new URL("../.assetsignore",import.meta.url),"utf8");
  const src=readFileSync(new URL("../worker.js",import.meta.url),"utf8");
  const block=src.indexOf("blockNewPaidOrders(env,request.method,url.pathname)");
  const routed=src.indexOf("handleMercadoPagoRoute(request,env");
  assert.ok(block>0&&block<routed,"orders must be gated before checkout");
  assert.equal((workflow.match(/node scripts\/check-commercial-store\.mjs/g)||[]).length,2);
  assert.doesNotMatch(workflow,/run: node scripts\/check-android-free-release\.mjs/);
  assert.match(ignore,/free-first-payment-policy\.js/);
});
