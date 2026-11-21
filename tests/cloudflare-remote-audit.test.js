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
