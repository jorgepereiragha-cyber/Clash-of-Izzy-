import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {livePaymentsEnabled,blocksNewCharge} from "../live-payment-gate.js";
import {DRAGON_INTEGRITY_SQL,verifyProductionDragonIntegrity} from "../scripts/verify-production-dragon-integrity.mjs";
test("production release cannot start new charges with secrets alone; existing webhooks remain routable",async()=>{
 const config=JSON.parse(await readFile(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
 assert.equal(config.vars.LIVE_PAYMENTS_APPROVED,"false");
 const env={...config.vars,MP_ACCESS_TOKEN:"fixture",MP_WEBHOOK_SECRET:"fixture"};
 assert.equal(livePaymentsEnabled(env),false);
 for(const route of ["/api/store/checkout","/api/store/purchase-request","/api/store/pix-instructions","/api/support/checkout"]){
  assert.equal(blocksNewCharge(route,"POST",env),true);
  assert.equal(blocksNewCharge(route,"POST",{...env,LIVE_PAYMENTS_APPROVED:"true"}),false);
  assert.equal(blocksNewCharge(route,"POST",{ENVIRONMENT:"preview",LIVE_PAYMENTS_APPROVED:"true"}),true);
 }
 assert.equal(blocksNewCharge("/api/webhook/mp","POST",env),false);
 const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 assert.ok(worker.indexOf("if(blocksNewCharge(")<worker.indexOf("const mpRouteResponse="));
 assert.match(worker,/mercadoPago:livePaymentsEnabled\(env\)/);
});
test("dragon migration preflight only reads fixed production D1 and rejects inconsistent history",async()=>{
 assert.match(DRAGON_INTEGRITY_SQL,/^SELECT COUNT/);
 assert.match(DRAGON_INTEGRITY_SQL,/LEFT JOIN kingdom_dragons/);
 assert.match(DRAGON_INTEGRITY_SQL,/typeof\(d.level\)/);
 const call=invalid=>verifyProductionDragonIntegrity({accountId:"fixture",token:"fixture",fetchImpl:async(url,options)=>{
  assert.match(url,/7e63af59-d9ff-4159-a9cf-b02e35b92605\/query$/);
  assert.deepEqual(JSON.parse(options.body),{sql:DRAGON_INTEGRITY_SQL});
  return {ok:true,json:async()=>({success:true,result:[{success:true,results:[{invalid}]}]})};
 }});
 assert.deepEqual(await call(0),{dragonIntegrityVerified:true});
 await assert.rejects(call(1),/not verified/);
 await assert.rejects(call(undefined),/not verified/);
});

test("Worker runtime denies every new charge before touching D1 when production approval is absent",async()=>{
 const {default:worker}=await import("../worker.js");
 const db=new Proxy({}, {get(){throw Error("payment gate must run before D1");}});
 for(const flag of [undefined,"false",true,"TRUE"]){
  const env={ENVIRONMENT:"production",LIVE_PAYMENTS_APPROVED:flag,DB:db,MP_ACCESS_TOKEN:"fixture",MP_WEBHOOK_SECRET:"fixture"};
  for(const path of ["/api/store/checkout","/api/store/purchase-request","/api/store/pix-instructions","/api/support/checkout"]){
   const res=await worker.fetch(new Request("https://fixture.invalid"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),env);
   assert.equal(res.status,503,path);
   assert.equal((await res.json()).code,"LIVE_PAYMENTS_DISABLED");
   assert.equal(res.headers.get("cache-control"),"no-store");
  }
 }
 const preview={ENVIRONMENT:"preview",LIVE_PAYMENTS_APPROVED:"true",DB:db};
 const denied=await worker.fetch(new Request("https://fixture.invalid/api/store/purchase-request",{method:"POST",body:"{}"}),preview);
 assert.equal(denied.status,503);
 assert.equal((await denied.json()).code,"LIVE_PAYMENTS_DISABLED");
});
