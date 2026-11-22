import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateAdminGemGrant,grantAdminGems,MAX_ADMIN_GEM_GRANT} from "../admin-gem-grants.js";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("Master gems reject malformed, huge and unauthenticated grants",async()=>{
  const good={playerId:"izzy_0123456789abcdef0123456789abcdef",amount:500,reason:"Premiação auditada",request_key:"admin-gem-request-0000001"};
  assert.deepEqual(validateAdminGemGrant(good),{
    playerId:good.playerId,amount:good.amount,reason:good.reason,requestKey:good.request_key
  });
  for(const bad of [
    {...good,amount:0},{...good,amount:1.5},{...good,amount:MAX_ADMIN_GEM_GRANT+1},
    {...good,request_key:""},{...good,reason:"abc"},{...good,playerId:"a' OR 1=1"}
  ]) assert.equal(validateAdminGemGrant(bad),null);
  const denied=await grantAdminGems({DB:{}},good,{scope:"game",sub:"user"});
  assert.equal(denied.status,401);
});

test("admin gem credit has transactional unique ledger, no secret leakage and client confirmation",async()=>{
  const [worker,migration,admin,ignore]=await Promise.all([
    read("worker.js"),read("migrations/0045_admin_gem_grant_ledger.sql"),
    read("admin.html"),read(".assetsignore")
  ]);
  assert.match(migration,/request_key TEXT PRIMARY KEY/);
  assert.match(migration,/REFERENCES players\(id\) ON DELETE RESTRICT/);
  const statements=migration.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n").replace(/ON DELETE RESTRICT/g,"");
  assert.doesNotMatch(statements,/\b(?:DROP|UPDATE|DELETE|REPLACE)\b/i);
  assert.match(worker,/grantAdminGems\(env,body,payload\)/);
  assert.match(worker,/"admin_gem_grants"/);
  assert.match(admin,/crypto\.randomUUID\(\)/);
  assert.match(admin,/request_key:requestKey/);
  assert.match(admin,/if\(!confirm\(/);
  assert.match(admin,/Máx|máx|1000000/);
  assert.match(ignore,/admin-gem-grants\.js/);
});
