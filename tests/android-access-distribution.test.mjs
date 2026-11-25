import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkAccessServer,HEALTH_URL} from "../scripts/check-android-access-server.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const health={ok:true,status:"ready",androidApiContract:"eldoria-android-v1",checks:{database:true,session:true,schema:true},missingTables:[],missingTriggers:[]};
function mock(body=health,location="/beta-access.html",status=200){return async url=>url===HEALTH_URL?Response.json(body,{status}):new Response(null,{status:302,headers:{location}});}
test("access distribution requires real readiness and closed invitation gate",async()=>{
 await checkAccessServer(mock());
 await assert.rejects(checkAccessServer(mock({...health,missingTriggers:["trigger"]})));
 await assert.rejects(checkAccessServer(mock({...health,missingTriggers:undefined})));
 await assert.rejects(checkAccessServer(mock(health,"/kingdom.html")));
 await assert.rejects(checkAccessServer(mock(health,"https://other.example/beta-access.html")));
 await assert.rejects(checkAccessServer(mock(health,"/beta-access.html",503)));
});
test("public name is clean; technical identity remains distinct",()=>{
 const gradle=read("android-sideload/app/build.gradle");
 assert.doesNotMatch(gradle,/appLabel: 'Clash of Izzy Beta'/);
 assert.match(gradle,/applicationIdSuffix '\.beta'/);
 assert.doesNotMatch(read("beta-access.html"),/Beta fechado|Entrar no beta|Servidor beta/i);
 assert.equal(read("portal.html"),read("public-portal/portal.html"));
 const portal=read("portal.html");
 assert.match(portal,/id="download-invite" aria-disabled="true"/);
 assert.match(portal,/r\.prerelease === true/);
 assert.match(portal,/release\.tag_name \+ "\/" \+ expected/);
 const workflow=read(".github/workflows/android-beta-apk.yml");
 assert.match(workflow,/inputs\.publish_invite_installer == true/);
 assert.match(workflow,/--prerelease --draft --latest=false/);
 assert.match(workflow,/node scripts\/check-android-access-server\.mjs/);
});
