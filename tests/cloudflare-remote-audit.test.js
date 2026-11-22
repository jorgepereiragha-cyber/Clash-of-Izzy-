import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateIds,audit,summary,normalizeToken,normalizeAccountId} from "../scripts/cloudflare-remote-audit.mjs";
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
  const dailyOnboardingSupport={...base,missingTables:["daily_reward_claims","onboarding_bonus_claims","support_orders"]};
  const pendingCore={...args,allowPending0037to0039:true};
  const coreApproved=await audit({...pendingCore,fetchImpl:mockFor(dailyOnboardingSupport).fetchImpl});
  assert.equal(coreApproved.ready,true,JSON.stringify(coreApproved.checks));
  assert.ok(coreApproved.checks.find(row=>row.name==="Worker público e D1").detail.includes("0037-0039"));
  const coreNotAuthorized=await audit({...args,fetchImpl:mockFor(dailyOnboardingSupport).fetchImpl});
  assert.equal(coreNotAuthorized.ready,false);
  for(const missing of [
    ["daily_reward_claims"],
    ["daily_reward_claims","onboarding_bonus_claims"],
    ["daily_reward_claims","onboarding_bonus_claims","support_orders","unknown_table"],
  ]){
    const denied=await audit({...pendingCore,fetchImpl:mockFor({...base,missingTables:missing}).fetchImpl});
    assert.equal(denied.ready,false,"only the complete authorized 0037-0039 group is accepted");
  }
  for(const checks of [
    {...base.checks,database:false},
    {...base.checks,session:false},
    {...base.checks,schema:true},
  ]){
    const denied=await audit({...pendingCore,fetchImpl:mockFor({...dailyOnboardingSupport,checks}).fetchImpl});
    assert.equal(denied.ready,false,"readiness protections remain mandatory");
  }
  const combinedOldAndNew=await audit({...pendingCore,allowPending0034:true,
    fetchImpl:mockFor({...base,missingTables:["realm_openings",...dailyOnboardingSupport.missingTables]}).fetchImpl});
  assert.equal(combinedOldAndNew.ready,true,"authorized legacy and current groups can coexist");
  const strict=await audit({...args,allowPending0030:false,fetchImpl:mockFor(base).fetchImpl});
  assert.equal(strict.ready,false);
  const missingGoogle={...base,missingTables:["google_account_links","google_auth_challenges"]};
  const approvedGoogle=await audit({...args,allowPending0033:true,fetchImpl:mockFor(missingGoogle).fetchImpl});
  assert.equal(approvedGoogle.ready,true,JSON.stringify(approvedGoogle.checks));
  assert.ok(approvedGoogle.checks.find(row=>row.name==="Worker público e D1").detail.includes("0033"));
  const rejectedWithoutFlag=await audit({...args,fetchImpl:mockFor(missingGoogle).fetchImpl});
  assert.equal(rejectedWithoutFlag.ready,false);
  const throneOnly={...base,missingTables:["realm_thrones","throne_assaults"]};
  const throneAllowed=await audit({...args,allowPending0035:true,fetchImpl:mockFor(throneOnly).fetchImpl});
  assert.equal(throneAllowed.ready,true,JSON.stringify(throneAllowed.checks));
  const throneDenied=await audit({...args,fetchImpl:mockFor(throneOnly).fetchImpl});
  assert.equal(throneDenied.ready,false);
  const allPending={...base,missingTables:["realm_openings","google_account_links","google_auth_challenges","realm_thrones","throne_assaults"]};
  const allApproved=await audit({...args,allowPending0033:true,allowPending0034:true,allowPending0035:true,
    fetchImpl:mockFor(allPending).fetchImpl});
  assert.equal(allApproved.ready,true,JSON.stringify(allApproved.checks));
  const rogue=await audit({...args,allowPending0033:true,allowPending0034:true,allowPending0035:true,
    fetchImpl:mockFor({...allPending,missingTables:[...allPending.missingTables,"other_table"]}).fetchImpl});
  assert.equal(rogue.ready,false);
  const realmOnly={...base,missingTables:["realm_openings"]};
  const realmAllowed=await audit({...args,allowPending0034:true,fetchImpl:mockFor(realmOnly).fetchImpl});
  assert.equal(realmAllowed.ready,true,JSON.stringify(realmAllowed.checks));
  const both={...base,missingTables:["realm_openings","google_account_links","google_auth_challenges"]};
  const combined=await audit({...args,allowPending0033:true,allowPending0034:true,fetchImpl:mockFor(both).fetchImpl});
  assert.equal(combined.ready,true,JSON.stringify(combined.checks));
  assert.ok(combined.checks.find(row=>row.name==="Worker público e D1").detail.includes("0033+0034"));
  const forbidden=await audit({...args,allowPending0033:true,allowPending0034:true,
    fetchImpl:mockFor({...both,missingTables:[...both.missingTables,"unknown_table"]}).fetchImpl});
  assert.equal(forbidden.ready,false);
  for(const invalid of [
    ["google_account_links"],["google_auth_challenges"],["google_account_links","outra_tabela"]
  ]){
    const denied=await audit({...args,allowPending0033:true,fetchImpl:mockFor({...missingGoogle,missingTables:invalid}).fetchImpl});
    assert.equal(denied.ready,false,JSON.stringify(invalid));
  }
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
  assert.doesNotMatch(strict,/COI_ALLOW_PENDING_0030|COI_ALLOW_PENDING_0033|COI_ALLOW_PENDING_0034|COI_ALLOW_PENDING_0035|COI_ALLOW_PENDING_0037_0039/);
  assert.match(workflow.slice(old,migrate),/COI_ALLOW_PENDING_0037_0039: "true"/);
  assert.match(strict,/check-android-release-server\.mjs/);
  assert.match(source,/allowPending0030:process\.env\.COI_ALLOW_PENDING_0030==="true"/);
  assert.match(source,/allowPending0033:process\.env\.COI_ALLOW_PENDING_0033==="true"/);
  assert.match(source,/allowPending0034:process\.env\.COI_ALLOW_PENDING_0034==="true"/);
  assert.match(source,/allowPending0035:process\.env\.COI_ALLOW_PENDING_0035==="true"/);
  assert.match(source,/allowPending0037to0039:process\.env\.COI_ALLOW_PENDING_0037_0039==="true"/);
});

test("normaliza account ID sem expor valor e mantém formato de 32 caracteres",()=>{
  const upper="A".repeat(32);
  assert.equal(normalizeAccountId('  "'+upper+'"  '),"a".repeat(32));
  assert.equal(normalizeAccountId(" ID inválido "),"id inválido");
});

test("auditoria identifica qual secret Cloudflare precisa de correção",async()=>{
  const unauthorized=async()=>new Response("Unauthorized",{status:401});
  const accountId="a".repeat(32);
  const tokenMissing=await audit({fetchImpl:unauthorized,production:prod,staging,token:"",accountId});
  const first=tokenMissing.checks.find(c=>c.name==="Secrets GitHub");
  assert.equal(first.ok,false);
  assert.match(first.detail,/CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(first.detail,/CLOUDFLARE_ACCOUNT_ID/);

  const accountMissing=await audit({fetchImpl:unauthorized,production:prod,staging,token:"token",accountId:"bad"});
  const second=accountMissing.checks.find(c=>c.name==="Secrets GitHub");
  assert.equal(second.ok,false);
  assert.match(second.detail,/CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(second.detail,/CLOUDFLARE_API_TOKEN/);
});

test("core-only production D1 workflow stages exclusively 0037-0039 and records restore point",async()=>{
  const workflow=await read(".github/workflows/repair-production-d1-core.yml");
  const fullDeploy=await read(".github/workflows/deploy-cloudflare.yml");
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/confirm_production == true && inputs\.confirm_preview == true/);
  assert.match(workflow,/inputs\.confirm_database_id == '7e63af59-d9ff-4159-a9cf-b02e35b92605'/);
  assert.match(workflow,/environment:\s*\n\s*name: production/);
  assert.match(workflow,/group: clash-of-izzy-cloudflare-production/);
  assert.match(workflow,/int\(match\.group\(1\)\)<=36/);
  assert.match(workflow,/migrations_dir"\]="\.coi-essential-0037-0039"/);
  assert.match(workflow,/0037_daily_login_rewards\.sql/);
  assert.match(workflow,/0038_onboarding_bonus\.sql/);
  assert.match(workflow,/0039_support_orders\.sql/);
  assert.match(workflow,/last!="0036_4x_read_indexes\.sql"/);
  assert.match(workflow,/time_travel\/bookmark/);
  const preflight=workflow.indexOf("Auditar Worker, isolamento");
  const history=workflow.indexOf("Verificar historico remoto");
  const backup=workflow.indexOf("Capturar bookmark Time Travel");
  const apply=workflow.indexOf("Aplicar somente migrations essenciais");
  const verify=workflow.indexOf("Verificar prontidao remota SEM allowlist");
  assert.ok(preflight>=0&&history>preflight&&backup>history&&apply>backup&&verify>apply);
  assert.match(workflow.slice(verify),/node scripts\/cloudflare-remote-audit\.mjs/);
  assert.doesNotMatch(workflow.slice(verify),/COI_ALLOW_PENDING_/);
  assert.doesNotMatch(workflow,/wrangler[^\n]* deploy(?! --dry-run)/);
  assert.match(fullDeploy,/Bloquear migrations comerciais pendentes/);
  assert.match(fullDeploy,/0044_reconcile_level_packs\.sql/);
  assert.ok(fullDeploy.indexOf("Bloquear migrations comerciais pendentes")<
    fullDeploy.indexOf("Apply D1 migrations remotely"));
});
