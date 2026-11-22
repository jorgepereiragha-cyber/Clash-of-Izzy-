import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateIds,audit,summary,normalizeToken} from "../scripts/cloudflare-remote-audit.mjs";
const read=async p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const prod=JSON.parse(await read("wrangler.jsonc"));
const staging=JSON.parse(await read("wrangler.preview-migrations.jsonc"));
test("Preview is isolated and invalid alias is blocked",()=>{
  const ids=validateIds(prod,staging);
  assert.notEqual(ids.prod.database_id,ids.preview.database_id);
  assert.throws(()=>validateIds(prod,{d1_databases:[{binding:"PREVIEW_DB",database_id:ids.prod.database_id}]}));
});
test("audit is read-only and cannot declare Paid or remote readiness without secrets",async()=>{
  const visits=[];
  const mock=async(url,opts)=>{visits.push({url,method:opts.method});return new Response("Unauthorized",{status:401})};
  const result=await audit({fetchImpl:mock,production:prod,staging});
  assert.equal(result.ready,false);
  assert.ok(visits.every(v=>v.method==="GET"));
  assert.ok(result.checks.find(v=>v.name==="Workers Paid - Billing"&&!v.ok));
  assert.match(summary(result),/não comprovada/);
});
test("production deployment requires paid confirmation separately from production authorization",async()=>{
  const file=await read(".github/workflows/deploy-cloudflare.yml");
  const workflow=await read(".github/workflows/cloudflare-remote-audit.yml");
  assert.match(file,/confirm_paid_plan:/);
  assert.match(file,/inputs\.confirm_paid_plan == true && inputs\.confirm_production == true/);
  assert.match(file,/github\.ref == 'refs\/heads\/main'/);
  assert.ok(file.indexOf("Verify remote Cloudflare before any D1 write")<file.indexOf("Capture D1 pre-deployment restore point"));
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/cloudflare-remote-audit\.mjs/);
  assert.doesNotMatch(workflow,/d1 migrations apply/);
});

test("normalizes Cloudflare GitHub token variants and rejects interior whitespace",()=>{
  assert.equal(normalizeToken(" Bearer test_token "), "test_token");
  assert.equal(normalizeToken(" 'test_token' "), "test_token");
  assert.equal(normalizeToken("invalid key"), "");
});

test("cloud-only diagnostic source is not published as a static asset",async()=>{
  const ignored=(await read(".assetsignore")).split(/\r?\n/);
  assert.ok(ignored.includes("scripts/cloudflare-remote-audit.mjs"));
});

test("auditoria pré-migração 0030 aceita somente três tabelas faltando com DB e sessão prontos",async()=>{
  const prodDb=prod.d1_databases.find(x=>x.binding==="DB");
  const stageDb=staging.d1_databases.find(x=>x.binding==="PREVIEW_DB");
  const goodMissing=["kingdom_dragons","kingdom_mailbox","master_bonus_claims"];
  function mockFor(health){
    const visits=[];
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
    const fetchImpl=async(url,options={})=>{
      visits.push({url,method:options.method});
      if(url.endsWith("/api/health"))return reply(health,health.ok?200:503);
      if(url.endsWith("/api/admin/health")||url.endsWith("/api/account/status"))return reply({error:"Sem sessão"},401);
      if(url.endsWith("/user/tokens/verify"))return reply({success:true,result:{status:"active"}});
      if(url.endsWith("/time_travel/bookmark"))return reply({success:true,result:{bookmark:"test-restore-point"}});
      if(url.endsWith("/subscriptions"))return reply({success:false},403);
      if(url.endsWith("/d1/database/"+prodDb.database_id))return reply({success:true,result:{uuid:prodDb.database_id,name:prodDb.database_name}});
      if(url.endsWith("/d1/database/"+stageDb.database_id))return reply({success:true,result:{uuid:stageDb.database_id,name:stageDb.database_name}});
      return reply({error:"Rota não esperada"},404);
    };
    return{visits,fetchImpl};
  }
  const base={ok:false,status:"not_ready",checks:{database:true,schema:false,session:true},missingTables:goodMissing};
  const args={production:prod,staging,token:"test-token",accountId:"a".repeat(32),allowPending0030:true};
  const valid=mockFor(base);
  const accepted=await audit({...args,fetchImpl:valid.fetchImpl});
  assert.equal(accepted.ready,true,JSON.stringify(accepted.checks));
  assert.ok(accepted.checks.find(row=>row.name==="Worker público e D1").detail.includes("0030"));
  assert.ok(valid.visits.every(x=>x.method==="GET"));
  const strict=await audit({...args,allowPending0030:false,fetchImpl:mockFor(base).fetchImpl});
  assert.equal(strict.ready,false);
  for(const health of [
    {...base,missingTables:["kingdom_dragons","kingdom_mailbox","outro"]},
    {...base,missingTables:["kingdom_dragons","kingdom_mailbox"]},
    {...base,checks:{...base.checks,session:false}},
    {...base,checks:{...base.checks,database:false}},
    {...base,status:"error"},
    {...base,ok:true}
  ]){
    const result=await audit({...args,fetchImpl:mockFor(health).fetchImpl});
    assert.equal(result.ready,false,JSON.stringify(health));
    assert.equal(result.checks.find(x=>x.name==="Worker público e D1").ok,false);
  }
});
test("deploy não relaxa a validação de saúde pós-migração",async()=>{
  const workflow=await read(".github/workflows/deploy-cloudflare.yml");
  const source=await read("scripts/cloudflare-remote-audit.mjs");
  const old=workflow.indexOf("COI_ALLOW_PENDING_0030:");
  const newCheck=workflow.indexOf("Verify live D1 schema and Android API contract after Worker deploy");
  const migrate=workflow.indexOf("Apply D1 migrations remotely");
  const deploy=workflow.indexOf("Deploy Worker and static assets");
  assert.ok(old>=0&&migrate>old&&deploy>migrate&&newCheck>deploy);
  const strict=workflow.slice(newCheck,workflow.indexOf("Smoke test production Worker",newCheck));
  assert.doesNotMatch(strict,/COI_ALLOW_PENDING_0030/);
  assert.match(strict,/check-android-release-server\.mjs/);
  assert.match(source,/allowPending0030:process\.env\.COI_ALLOW_PENDING_0030==="true"/);
});
