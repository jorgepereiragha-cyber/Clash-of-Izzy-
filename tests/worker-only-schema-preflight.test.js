import test from "node:test";
import assert from "node:assert/strict";
import {verifyWorkerOnlySchema,HISTORY_SQL} from "../scripts/check-worker-only-schema.mjs";
const files=["0045_equipment_enhancement.sql","0046_individual_dragon_progression.sql","0047_special_city_buildings.sql","0048_admin_gem_grant_ledger.sql"];
const config={accountId:"a".repeat(32),token:"test-token",migrationFiles:files};
function stub(names,{success=true,status=200,querySuccess=true}={}){
 return async (url,options)=>{
   assert.match(url,/\/d1\/database\/7e63af59-d9ff-4159-a9cf-b02e35b92605\/query$/);
   assert.equal(options.method,"POST");
   assert.equal(options.redirect,"error");
   assert.deepEqual(JSON.parse(options.body),{sql:HISTORY_SQL});
   return Response.json({success,result:[{success:querySuccess,results:names.map(name=>({name}))}]},{status});
 };
}
test("accepts exact migration membership even when historical ordering differs",async()=>{
 assert.deepEqual(await verifyWorkerOnlySchema({...config,fetchImpl:stub([...files].reverse())}),{schemaHistoryVerified:true,appliedMigrations:4});
});
test("blocks a healthy old Worker from publishing against pending, duplicate or unknown migrations",async()=>{
 await assert.rejects(verifyWorkerOnlySchema({...config,fetchImpl:stub(files.slice(0,-1))}),/Missing: 0048_admin_gem_grant_ledger.sql/);
 await assert.rejects(verifyWorkerOnlySchema({...config,fetchImpl:stub([...files,files[0]])}),/duplicate entries: 1/);
 await assert.rejects(verifyWorkerOnlySchema({...config,fetchImpl:stub([...files,"0049_unknown.sql"])}),/unexpected: 0049_unknown.sql/);
});
test("fails closed on unavailable credentials, invalid history and provider errors",async()=>{
 await assert.rejects(verifyWorkerOnlySchema({...config,accountId:"invalid",fetchImpl:()=>{throw Error("must not fetch")}}),/credentials missing or invalid/);
 await assert.rejects(verifyWorkerOnlySchema({...config,migrationFiles:[],fetchImpl:()=>{throw Error("must not fetch")}}),/manifest invalid/);
 await assert.rejects(verifyWorkerOnlySchema({...config,fetchImpl:stub(files,{status:403})}),/history query failed/);
 await assert.rejects(verifyWorkerOnlySchema({...config,fetchImpl:stub(files,{querySuccess:false})}),/Invalid D1 history/);
});
