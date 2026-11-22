import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { auditPreview, canonicalHistory, normalizeToken } from "../scripts/check-d1-preview-readonly.mjs";

const migrationFiles = await readdir(new URL("../migrations", import.meta.url));
const expected = canonicalHistory(migrationFiles);
const requiredTables = ["players","kingdom_buildings","daily_reward_claims","onboarding_bonus_claims","support_orders"];
const sqlResponses = (opts = {}) => ({
  "SELECT name FROM d1_migrations ORDER BY id":
    (opts.history || expected).map(name => ({name})),
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('players','daily_reward_claims','onboarding_bonus_claims','support_orders','kingdom_buildings')":
    (opts.tables || requiredTables).map(name => ({name})),
  "SELECT COUNT(*) AS n FROM players":
    [{n:opts.players ?? 0}]
});
const mock = (opts = {}) => {
  const queries = [];
  const rows = sqlResponses(opts);
  const fetchImpl = async (url, request) => {
    assert.match(url, /\/d1\/database\/6674c0ac-3636-4e57-bff8-23cf60ab9637\/query$/);
    assert.equal(request.method, "POST");
    const {sql} = JSON.parse(request.body);
    assert.ok(Object.hasOwn(rows,sql), "Unexpected SQL: " + sql);
    assert.match(sql,/^SELECT /);
    queries.push(sql);
    return new Response(JSON.stringify({success:true,result:[{results:rows[sql]}]}),
      {status:200,headers:{"Content-Type":"application/json"}});
  };
  return {fetchImpl, queries};
};
const check = opts => {
  const fx = mock(opts);
  return auditPreview({fetchImpl:fx.fetchImpl,token:"Bearer audit-example",accountId:"a".repeat(32),
    migrationFiles}).then(result => ({...result,queries:fx.queries}));
};

test("D1 Preview audit does not modify production, and requires 0041 plus zero players", async () => {
  const data = await check();
  assert.equal(data.safeToReview4XPreviewSmoke,true);
  assert.equal(data.latestMigration,"0041_4x_industries_defenses_progression.sql");
  assert.equal(data.playerCount,0);
  assert.equal(data.productionAccess,false);
  assert.equal(data.productionWrites,0);
  assert.equal(data.queries.length,3);
  assert.equal(data.queries.every(q=>q.startsWith("SELECT ")),true);
});

test("D1 Preview audit blocks absent schema, stale 0041, payment schema and real players", async () => {
  const without0041=expected.filter(name=>name!=="0041_4x_industries_defenses_progression.sql");
  for(const opts of [
    {history:without0041},
    {history:expected.concat(["0042_level_packs_p1_p8.sql"])},
    {history:expected.slice(0,-1).concat(["unexpected.sql"])},
    {tables:requiredTables.filter(name=>name!=="support_orders")},
    {players:1},
  ]) {
    const result=await check(opts);
    assert.equal(result.safeToReview4XPreviewSmoke,false,JSON.stringify(opts));
  }
});

test("D1 Preview audit rejects bad credentials and malformed API responses",async()=>{
  assert.throws(()=>normalizeToken("a b"));
  await assert.rejects(()=>auditPreview({fetchImpl:async()=>new Response("unauthorized",{status:401}),
    token:"token",accountId:"bad",migrationFiles}),/account id/);
  await assert.rejects(()=>auditPreview({fetchImpl:async()=>new Response("denied",{status:403}),
    token:"token",accountId:"a".repeat(32),migrationFiles}),/HTTP 403/);
});

test("D1 Preview workflow cannot deploy or apply production SQL",async()=>{
  const yaml = await readFile(new URL("../.github/workflows/d1-preview-readonly-health.yml",import.meta.url),"utf8");
  assert.match(yaml,/workflow_dispatch:/);
  assert.match(yaml,/branches: \[main\]/);
  assert.match(yaml,/node scripts\/check-d1-preview-readonly\.mjs/);
  assert.doesNotMatch(yaml,/d1 migrations apply|wrangler\s+deploy|time-travel restore/);
});
