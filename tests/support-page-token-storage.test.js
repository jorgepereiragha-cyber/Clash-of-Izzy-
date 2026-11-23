import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const main=await readFile(new URL("../apoie.html",import.meta.url),"utf8");
const portal=await readFile(new URL("../public-portal/apoie.html",import.meta.url),"utf8");

function testSessionFallback(html, local, session){
 const start=html.indexOf("function readSupportToken(){");
 const end=html.indexOf("async function loadStats()",start);
 assert.ok(start>=0&&end>start,"protected support token reader exists");
 return vm.runInNewContext(html.slice(start,end)+String.fromCharCode(10)+"readSupportToken()",{
  window:{localStorage:local,sessionStorage:session}
 });
}

test("both support pages use identical read-only token fallback",()=>{
 assert.equal(main,portal,"public portal copy should not diverge");
 const denied={getItem(){throw new Error("SecurityError")}};
 const valid={getItem(key){return key==="coi_game_token"?"existing-session":null}};
 for(const html of [main,portal]){
  assert.equal(testSessionFallback(html,denied,valid),"existing-session");
  assert.equal(testSessionFallback(html,valid,denied),"existing-session");
  assert.equal(testSessionFallback(html,denied,denied),"");
  assert.ok(html.includes("const token=readSupportToken;"));
 }
});
