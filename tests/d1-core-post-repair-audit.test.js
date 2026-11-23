import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  PRODUCTION_D1_ID, CORE_MIGRATIONS, READ_ONLY_SQL, canonicalBaseline,
  verifyCoreRepairSnapshot, auditProductionCore
} from "../scripts/verify-d1-core-repair-readonly.mjs";

const root = new URL("../", import.meta.url);
const files = await readdir(new URL("../migrations/", import.meta.url));
const baseline = canonicalBaseline(files);
const snapshot = {
  history: [...baseline, ...CORE_MIGRATIONS],
  tables: ["players", "daily_reward_claims", "onboarding_bonus_claims", "support_orders"],
  indexes: ["idx_daily_reward_claims_latest", "idx_support_orders_paid"],
  foreignKeyViolations: [],
  migrationFiles: files
};

test("real repository has 39 historical D1 files and a correct core repair definition", () => {
  assert.equal(baseline.length, 39);
  assert.equal(baseline.at(-1), "0036_4x_read_indexes.sql");
  const result = verifyCoreRepairSnapshot(snapshot);
  assert.equal(result.resultingHistoryCount, 42);
  assert.equal(result.productionWritesPerformed, 0);
  assert.equal(result.commercialMigrationsDetected, false);
  assert.deepEqual(result.essentialMigrations, [...CORE_MIGRATIONS]);
});

test("post-repair verifier blocks incomplete, reordered, duplicated and commercial migration states", () => {
  const variants = [
    {history: snapshot.history.slice(0,-1)},
    {history: [...baseline, CORE_MIGRATIONS[1], CORE_MIGRATIONS[0], CORE_MIGRATIONS[2]]},
    {history: [...baseline, CORE_MIGRATIONS[0], CORE_MIGRATIONS[0], CORE_MIGRATIONS[2]]},
    {history: [...baseline.slice(1), baseline[1], ...CORE_MIGRATIONS]},
    {history: [...snapshot.history,"0040_support_packages.sql"]},
    {tables: snapshot.tables.slice(0,-1)},
    {indexes: snapshot.indexes.slice(0,-1)},
    {foreignKeyViolations:[{table:"players",rowid:1,parent:"kingdoms",fkid:0}]},
    {foreignKeyViolations: null}
  ];
  for (const change of variants) {
    assert.throws(() => verifyCoreRepairSnapshot({...snapshot,...change}), Error,
      "Expected fail-closed rejection for " + JSON.stringify(change));
  }
});

function fakeRemote(resultBySql, visits) {
  return async (url, opts) => {
    visits.push({url,method:opts.method,request:JSON.parse(opts.body),redirect:opts.redirect});
    const payload = resultBySql[JSON.parse(opts.body).sql];
    if (!payload) return new Response("no", {status:404});
    return new Response(JSON.stringify({success:true,result:[{results:payload,success:true}]}),
      {status:200,headers:{"Content-Type":"application/json"}});
  };
}

test("cloud audit sends exclusively approved read-only queries to the fixed production UUID", async () => {
  const visits=[];
  const rowData = {
    [READ_ONLY_SQL.history]: snapshot.history.map(name=>({name})),
    [READ_ONLY_SQL.tables]: snapshot.tables.map(name=>({name})),
    [READ_ONLY_SQL.indexes]: snapshot.indexes.map(name=>({name})),
    [READ_ONLY_SQL.integrity]: []
  };
  const result = await auditProductionCore({
    fetchImpl:fakeRemote(rowData,visits),
    accountId:"a".repeat(32),token:"Bearer fake-test-token",migrationFiles:files
  });
  assert.equal(result.status,"core-repair-verified-read-only");
  assert.equal(visits.length,4);
  assert.deepEqual(visits.map(v=>v.request.sql),Object.values(READ_ONLY_SQL));
  for(const visit of visits){
    assert.equal(visit.method,"POST"); // D1 query API uses POST even for SELECT/PRAGMA
    assert.equal(visit.redirect,"error");
    assert.ok(visit.url.includes("/d1/database/"+PRODUCTION_D1_ID+"/query"));
    assert.ok(/^SELECT |^PRAGMA foreign_key_check$/.test(visit.request.sql));
    assert.ok(!/\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|REPLACE|RESTORE)\b/i.test(visit.request.sql));
  }
});

test("missing credentials, corrupt D1 response and incomplete query all fail closed", async () => {
  const args = {migrationFiles:files,accountId:"a".repeat(32),token:"test-token"};
  await assert.rejects(auditProductionCore({...args,token:"bad token"}));
  await assert.rejects(auditProductionCore({...args,accountId:"not-an-account"}));
  await assert.rejects(auditProductionCore({...args,fetchImpl:async()=>new Response("Unauthorized",{status:403})}));
  await assert.rejects(auditProductionCore({...args,fetchImpl:async()=>new Response(JSON.stringify({success:true,result:[{}]}),{status:200})}));
  await assert.rejects(auditProductionCore({...args,fetchImpl:fakeRemote({[READ_ONLY_SQL.history]: []},[])}));
});

test("protected repair executes verifier strictly after remote apply and before health checks", async () => {
  const workflow = await readFile(new URL("../.github/workflows/repair-production-d1-core.yml",import.meta.url),"utf8");
  const standalone = await readFile(new URL("../.github/workflows/verify-d1-core-post-repair-readonly.yml",import.meta.url),"utf8");
  const apply=workflow.indexOf("Aplicar somente migrations essenciais ate 0039 em producao");
  const audit=workflow.indexOf("node scripts/verify-d1-core-repair-readonly.mjs");
  const health=workflow.indexOf("Verificar prontidao remota SEM allowlist");
  assert.ok(apply>=0 && audit>apply && health>audit);
  assert.match(workflow,/environment:\s*\n\s*name: production/);
  assert.match(workflow,/time_travel\/bookmark/);
  assert.match(standalone,/workflow_dispatch:/);
  assert.match(standalone,/if: github\.ref == 'refs\/heads\/main'/);
  assert.match(standalone,/node scripts\/verify-d1-core-repair-readonly\.mjs/);
  assert.match(standalone,/node scripts\/check-android-release-server\.mjs/);
  assert.doesNotMatch(standalone,/d1 migrations apply|wrangler[^\n]* deploy|time-travel restore/);
});
