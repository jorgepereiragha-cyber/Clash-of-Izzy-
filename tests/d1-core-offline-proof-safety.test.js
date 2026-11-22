import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkedCliArgs } from "../scripts/prove-d1-core-offline.mjs";

const read=async p=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("real Wrangler D1 proof forbids any remote or production database access",async()=>{
  const script=await read("scripts/prove-d1-core-offline.mjs");
  const ci=await read(".github/workflows/ci.yml");
  assert.match(script,/databaseId = "00000000-0000-4000-8000-000000000001"/);
  assert.match(script,/databaseName = "coi-core-repair-offline-fixture"/);
  assert.match(script,/mkdtemp\(join\(tmpdir\(\)/);
  assert.match(script,/await rm\(tmp, \{ recursive: true, force: true \}\)/);
  assert.match(script,/cli\(\["--config", initialConfig, "d1", "migrations", "apply", binding, \.\.\.opts\]\)/);
  assert.match(script,/cli\(\["--config", onlyEssentialConfig, "d1", "migrations", "apply", binding, \.\.\.opts\]\)/);
  assert.match(ci,/run: node scripts\/prove-d1-core-offline\.mjs/);
  assert.doesNotMatch(script,/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|wrangler\.jsonc/);
  assert.doesNotMatch(script,/d1 migrations apply clash-of-izzy-db --remote/);
});

test("CLI validation rejects any remote, preview, deploy or missing local-only flag",()=>{
  const good=["--config","fixture.jsonc","d1","migrations","apply","OFFLINE_DB",
    "--local","--persist-to","/tmp/test"];
  assert.deepEqual(checkedCliArgs(good),good);
  for(const bad of [
    good.filter(arg=>arg!=="--local"),
    good.filter(arg=>arg!=="--persist-to"),
    [...good,"--remote"],
    [...good,"--preview"],
    [...good,"deploy"],
    [...good,"clash-of-izzy-db"]
  ])assert.throws(()=>checkedCliArgs(bad),/Only isolated local|forbidden/);
});
