import vm from "node:vm";
import { readFile } from "node:fs/promises";

const src = (await readFile(new URL("../rally-ui.js", import.meta.url), "utf8")).replace(/^import .*;\n/gm, "");

function runRallySession(storages) {
  const status={ textContent:"",classList:{toggle() {}} };
  const captured=[],listeners={};
  const document={hidden:false,getElementById:id=>id==="rally-status"?status:null,addEventListener(){}};
  const window={...storages,setInterval() {},addEventListener(name,callback){listeners[name]=callback;}};
  const fetch=async(path,options)=>{
    captured.push({path,authorization:options.headers.Authorization});
    return {ok:true,async json(){return {nodes:[],rallies:[],in_alliance:false}}};
  };
  vm.runInNewContext(src,{window,document,fetch,console}, {filename:"rally-ui.js"});
  return {status,captured,listeners};
}

import test from "node:test";
import assert from "node:assert/strict";

test("rally uses sessionStorage when localStorage access raises SecurityError", async () => {
  const client=runRallySession({
    localStorage:{getItem(){throw new Error("SecurityError")}},
    sessionStorage:{getItem(){return "valid-session-only"}}
  });
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(client.captured.length,1);
  assert.equal(client.captured[0].path,"/api/game/rally/world");
  assert.ok(client.captured.every(entry=>entry.authorization==="Bearer valid-session-only"));
  assert.match(client.status.textContent,/sincronizados/);
});

test("rally shows actionable storage error without sending unauthorized requests", async () => {
  const client=runRallySession({
    localStorage:{getItem(){throw new Error("SecurityError")}},
    sessionStorage:{getItem(){throw new Error("SecurityError")}}
  });
  await Promise.resolve();
  assert.deepEqual(client.captured,[]);
  assert.match(client.status.textContent,/bloqueou o armazenamento/);
});

test("rally refreshes nodes on realtime invalidation without duplicate concurrent requests",async()=>{
 const client=runRallySession({localStorage:{getItem(){return "valid-token"}}});
 for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(client.captured.length,1);
 client.listeners["coi:refresh-resource-nodes"]();
 client.listeners["coi:refresh-resource-nodes"]();
 for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(client.captured.length,2);
});
