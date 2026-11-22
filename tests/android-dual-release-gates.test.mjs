import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  COMMERCE_CREATION_PATHS,freeModeCommerceBlocked,
  freeAndroidReadiness,FREE_ANDROID_CONTRACT
} from "../android-free-mode.js";
import {
  assertFreeAndroidGate,checkFreeAndroidGate,REQUIRED_BLOCKED_ROUTES,ORIGIN
} from "../scripts/check-android-free-release-gate.mjs";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const modesOff={mercadoPago:false,nubankPix:false};
function contract(){return {
  contract:FREE_ANDROID_CONTRACT,ready:true,mode:"free",checkoutCreationBlocked:true,
  paymentsDisabled:true,blockedRoutes:REQUIRED_BLOCKED_ROUTES,
  pendingOrders:0,pendingSupportOrders:0,unfulfilledOrders:0
};}
function mockDB(orders=[0,0,0],complete=true){
  return {
    prepare(query){
      return {
        bind(){return this},
        async all(){return {results:(complete?["purchase_requests","support_orders","mercadopago_orders"]:["purchase_requests"]).map(name=>({name}))}}
      };
    },
    async batch(){return orders.map(n=>({results:[{n}]}))}
  };
}
test("free-release mode defaults off, blocks all recognized commerce mutation paths and never blocks provider callbacks",()=>{
  for(const path of COMMERCE_CREATION_PATHS){
    const req=new Request("https://example.test"+path,{method:"POST"});
    assert.equal(freeModeCommerceBlocked(req,{ANDROID_FREE_RELEASE_MODE_ENABLED:"true"}),true,path);
    assert.equal(freeModeCommerceBlocked(req,{ANDROID_FREE_RELEASE_MODE_ENABLED:"false"}),false,path);
  }
  assert.equal(freeModeCommerceBlocked(new Request("https://example.test/api/webhook/mp",{method:"POST"}),{
    ANDROID_FREE_RELEASE_MODE_ENABLED:"true"}),false);
});
test("backend readiness fails closed on disabled flag, credentials, missing schema and pending orders",async()=>{
  const safe={ANDROID_FREE_RELEASE_MODE_ENABLED:"true",DB:mockDB()};
  assert.equal((await (await freeAndroidReadiness(safe)).json()).ready,true);
  for(const env of [
    {...safe,ANDROID_FREE_RELEASE_MODE_ENABLED:"false"},
    {...safe,MP_ACCESS_TOKEN:"secret"},
    {...safe,NUBANK_PIX_ENABLED:"true"},
    {...safe,DB:mockDB([1,0,0])},
    {...safe,DB:mockDB([0,1,0])},
    {...safe,DB:mockDB([0,0,1])},
    {...safe,DB:mockDB([0,0,0],false)}
  ])assert.equal((await (await freeAndroidReadiness(env)).json()).ready,false);
});
test("release gate requires explicit dual GET proof and never trusts two booleans alone",async()=>{
  assert.deepEqual(assertFreeAndroidGate(contract(),modesOff),{ready:true,mode:"gratuito"});
  for(const broken of [
    null,{}, {...contract(),ready:false}, {...contract(),pendingOrders:1},
    {...contract(),pendingSupportOrders:null},{...contract(),checkoutCreationBlocked:false},
    {...contract(),blockedRoutes:[]}
  ])assert.throws(()=>assertFreeAndroidGate(broken,modesOff));
  assert.throws(()=>assertFreeAndroidGate(contract(),{mercadoPago:true,nubankPix:false}));
  const paths=[];
  const result=await checkFreeAndroidGate(async(url,options)=>{
    paths.push({url,method:options.method});
    const data=url.endsWith("/api/android/free-release-readiness")?contract():modesOff;
    return new Response(JSON.stringify(data),{status:200});
  });
  assert.equal(result.ready,true);
  assert.deepEqual(paths.map(p=>p.url),[
    ORIGIN+"/api/android/free-release-readiness",ORIGIN+"/api/store/payment-methods"
  ]);
  assert.ok(paths.every(p=>p.method==="GET"));
  await assert.rejects(checkFreeAndroidGate(async()=>new Response("{}",{status:503})));
});
test("official release retains BOTH commercial gates and independently checks free mode twice",async()=>{
  const [flow,worker,config,ignore]=await Promise.all([
    read(".github/workflows/publicar-apk-android.yml"),read("worker.js"),
    read("wrangler.jsonc"),read(".assetsignore")
  ]);
  assert.equal(flow.split("node scripts/check-commercial-store.mjs").length-1,2);
  assert.equal(flow.split("node scripts/check-android-free-release-gate.mjs").length-1,2);
  assert.match(flow,/inputs\.modo == 'comercial'/);
  assert.match(flow,/inputs\.modo == 'gratuito'/);
  assert.match(flow,/ANDROID_RELEASE_CERT_SHA256/);
  assert.match(flow,/PUBLICAR_APK_OFICIAL/);
  assert.match(worker,/freeModeCommerceBlocked\(request,env\)/);
  assert.match(worker,/freeAndroidReadiness\(env\)/);
  assert.equal(JSON.parse(config).vars.ANDROID_FREE_RELEASE_MODE_ENABLED,"false");
  assert.match(ignore,/android-free-mode\.js/);
});
