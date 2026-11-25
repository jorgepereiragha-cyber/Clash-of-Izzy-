import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assertProductionDeployConfig,CLOSED_FLAGS} from "../scripts/check-production-deploy-config.mjs";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const config=JSON.parse(await read("wrangler.jsonc"));
test("production config rejects wrong Worker, D1, migration path and Preview alias",()=>{
 assert.equal(assertProductionDeployConfig(config).productionConfigVerified,true);
 for(const mutate of [
  c=>c.name="other-worker",
  c=>c.main="portal-worker.js",
  c=>c.vars.ENVIRONMENT="preview",
  c=>c.d1_databases[0].database_id=c.previews.d1_databases[0].database_id,
  c=>c.d1_databases[0].database_name="wrong-db",
  c=>c.d1_databases[0].migrations_dir="beta/migrations",
  c=>c.d1_databases.push({...c.d1_databases[0]}),
  c=>c.previews.d1_databases[0].database_id=c.d1_databases[0].database_id.toUpperCase(),
  c=>c.vars.INVITE_ONLY="true"
 ]){const copy=structuredClone(config);mutate(copy);assert.throws(()=>assertProductionDeployConfig(copy));}
});
test("every commercial flag and the default gameplay flag must be explicitly false",()=>{
 for(const flag of CLOSED_FLAGS)for(const value of [undefined,true,false,"true","TRUE"]){
   const copy=structuredClone(config);copy.vars[flag]=value;
   assert.throws(()=>assertProductionDeployConfig(copy),/Unsafe production flag/);
 }
});
test("both deployment workflows pin approved SHA and guard target before any deploy or migration",async()=>{
 for(const path of [".github/workflows/deploy-cloudflare.yml",".github/workflows/deploy-worker-only.yml"]){
  const workflow=await read(path);
  assert.ok(workflow.includes("ref: ${{ github.sha }}"));
  const guard=workflow.indexOf("node scripts/check-production-deploy-config.mjs");
  const firstOperation=workflow.indexOf("npm install");
  assert.ok(guard>0&&firstOperation>guard,path);
 }
});
