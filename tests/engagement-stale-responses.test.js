import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../player-engagement.js",import.meta.url),"utf8");
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
  const nodes=new Map(), events=new Map(), pending=[];
  let auth="account-a";
  function node(){
    return {hidden:false,disabled:false,textContent:"",children:[],listeners:new Map(),
      addEventListener(name,fn){this.listeners.set(name,fn);},
      append(...items){this.children.push(...items);},
      replaceChildren(...items){this.children=items;},
      setAttribute(){},click(){return this.listeners.get("click")?.();}};
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  vm.runInNewContext(source,{
    document:{getElementById:get,createElement:node},
    window:{localStorage:{getItem:()=>auth},sessionStorage:{getItem:()=>null}},
    crypto:{randomUUID:()=>"test"},
    addEventListener:(event,fn)=>events.set(event,fn),
    fetch:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}))
  });
  function settle(request,data){request.resolve({ok:true,json:async()=>data});}
  function refresh(){events.get("pageshow")();return pending.splice(0);}
  function complete(requests,claimed){
    for(const request of requests){
      settle(request,request.url.endsWith("/onboarding")?{claimed:true}:
        {claimed,day:1,reward:{gems:50},rewards:[{day:1,gems:50}]});
    }
  }
  return {get,pending,settle,refresh,complete,setAuth:value=>{auth=value;}};
}

test("late GET cannot re-enable a reward after a newer response",async()=>{
  const h=harness(), older=h.refresh(), newer=h.refresh();
  h.complete(newer,true);await flush();
  assert.equal(h.get("dailyClaim").disabled,true);
  h.complete(older,false);await flush();
  assert.equal(h.get("dailyClaim").disabled,true);
  assert.match(h.get("dailyStatus").textContent,/já recebida/);
});

test("a pre-claim refresh cannot overwrite a completed claim",async()=>{
  const h=harness();
  h.complete(h.refresh(),false);await flush();
  assert.equal(h.get("dailyClaim").disabled,false);
  const older=h.refresh();
  const claimed=h.get("dailyClaim").click();
  const post=h.pending.splice(0).find(r=>r.url.endsWith("/daily-reward"));
  assert.equal(post.options.method,"POST");
  h.settle(post,{success:true});await claimed;await flush();
  const current=h.pending.splice(0).filter(r=>r.options.method==="GET");
  assert.equal(current.length,2);
  h.complete(current,true);await flush();
  h.complete(older,false);await flush();
  assert.equal(h.get("dailyClaim").disabled,true);
});

test("responses from a previous account cannot replace the current account UI",async()=>{
  const h=harness(), older=h.refresh();
  h.setAuth("account-b");
  const newer=h.refresh();
  assert.ok(newer.every(r=>r.options.headers.Authorization==="Bearer account-b"));
  h.complete(newer,true);await flush();
  h.complete(older,false);await flush();
  assert.equal(h.get("dailyClaim").disabled,true);
  h.setAuth("");
  h.refresh();
  assert.equal(h.get("dailyRewardsPanel").hidden,true);
});
