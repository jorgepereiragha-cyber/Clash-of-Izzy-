import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {handleAdminLaunchCenter,launchGate} from "../admin-launch-center.js";
import {handleValhallaAdmin} from "../valhalla-admin.js";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const actor={scope:"admin",sub:"admin"};

test("central Master and Valhalla fail closed without verified admin actor",async()=>{
  const invalid=[null,{scope:"game",sub:"admin"},{scope:"admin",sub:"player"}];
  for(const candidate of invalid){
    assert.equal((await handleAdminLaunchCenter({DB:{}},candidate)).status,401);
    assert.equal((await handleValhallaAdmin(new Request("https://example.test/api/valhalla-admin/status"),{DB:{}},{},candidate)).status,401);
  }
});

test("launch center never declares revenue or commercial GO from configuration alone",async()=>{
  const decision=launchGate({coreSchema:true,supportSchema:true,paymentConfigured:true,apkPublished:true});
  assert.equal(decision.status,"NO_GO");
  assert.ok(decision.blockers.some(b=>b.includes("Sandbox")));
  assert.ok(decision.blockers.some(b=>b.includes("Android físico")));
});

test("read-only launch controller queries SELECT only and does not reveal secrets",async()=>{
  const sql=[];
  const db={
    prepare(query){
      sql.push(query);
      return {
        bind(){return this},
        async all(){return {results:["players","kingdoms","battle_reports","alliances","purchase_requests","mercadopago_orders","support_orders","d1_migrations"].map(name=>({name}))}},
        async first(){
          if(query.includes("d1_migrations"))return {name:"0044_reconcile_level_packs.sql"};
          return {total_pending:3,pix_pending:1,mp_pending:2,nominal_day_cents:399,nominal_week_cents:399};
        }
      };
    }
  };
  const result=await handleAdminLaunchCenter({
    DB:db,MP_ACCESS_TOKEN:"dont-leak",MP_WEBHOOK_SECRET:"dont-leak",
    NUBANK_PIX_ENABLED:"false",LEVEL_PACKS_PUBLIC_ENABLED:"false"
  },actor,{fetchImpl:async()=>({status:404,headers:new Headers(),json:async()=>({})})});
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.status,"NO_GO");
  assert.equal(data.pending.total,3);
  assert.equal(data.recordedApproved.nominalDayCents,399);
  assert.equal(data.recordedApproved.verifiedSettlement,false);
  assert.equal(data.apk.published,false);
  assert.equal(data.schema.pendingMigrations,null);
  assert.ok(sql.every(q=>q.startsWith("SELECT ")));
  assert.ok(!JSON.stringify(data).includes("dont-leak"));
});

test("only Master can GET launch-center and Valhalla propagates actor",async()=>{
  const [worker,admin,ignore]=await Promise.all([read("worker.js"),read("admin.html"),read(".assetsignore")]);
  assert.match(worker,/url\.pathname==="\/api\/admin\/launch-center"&&request\.method==="GET"/);
  assert.match(worker,/handleAdminLaunchCenter\(env,payload\)/);
  assert.match(worker,/handleValhallaAdmin\(request,env,body,payload\)/);
  assert.match(admin,/id="launchGate"/);
  assert.match(admin,/id="launchSummary"/);
  assert.match(admin,/refreshLaunchCenter\(\)/);
  assert.match(admin,/NO-GO/);
  assert.match(ignore,/admin-launch-center\.js/);
});
