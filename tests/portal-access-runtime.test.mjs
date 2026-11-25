import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const html=readFileSync(new URL("../public-portal/portal.html",import.meta.url),"utf8");
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const root="https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases/download/";
const name="clash-of-izzy-access.apk";
function release(n,changes={}){
 const tag="android-access-v"+n;
 return {draft:false,prerelease:true,tag_name:tag,assets:[name,name+".sha256"].map(name=>({name,state:"uploaded",size:100,browser_download_url:root+tag+"/"+name})),...changes};
}
async function render(releases){
 const nodes=new Map();
 function node(id){
  if(!nodes.has(id)){
   const attrs=new Map([["aria-disabled","true"]]);
   nodes.set(id,{hidden:true,textContent:"",addEventListener(){},setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k);if(k==="href")delete this.href},getAttribute:k=>attrs.get(k)});
  }
  return nodes.get(id);
 }
 runInNewContext(script,{document:{getElementById:node},navigator:{},URL,AbortController,setTimeout,clearTimeout,
  fetch:async url=>url.endsWith("/latest")?{ok:false}:{ok:true,json:async()=>releases}});
 await new Promise(resolve=>setImmediate(resolve));
 return {button:node("download-invite"),hash:node("invite-checksum"),official:node("download-apk"),status:node("invite-download-status")};
}
test("portal executes real script: selects newest numeric access version independently of commercial APK",async()=>{
 const r=await render([release(2),release(11),release(20,{draft:true}),release(30,{prerelease:false}),null]);
 assert.equal(r.button.href,root+"android-access-v11/"+name);
 assert.equal(r.hash.href,r.button.href+".sha256");
 assert.equal(r.button.getAttribute("aria-disabled"),undefined);
 assert.equal(r.official.getAttribute("aria-disabled"),"true");
});
test("portal fails closed on missing, ambiguous or untrusted files",async()=>{
 const incomplete=release(1);incomplete.assets.pop();
 const malicious=release(1);malicious.assets[0].browser_download_url=malicious.assets[0].browser_download_url.replace("github.com","github.com:444");
 const duplicate=release(1);duplicate.assets.push({...duplicate.assets[0]});
 const incorrect=release(1);incorrect.assets[0].browser_download_url=root+"android-access-v9/"+name;
 for(const payload of [[],null,[incomplete],[malicious],[duplicate],[incorrect],[release(1,{draft:true})]]){
  const r=await render(payload);assert.equal(r.button.href,undefined);assert.equal(r.button.getAttribute("aria-disabled"),"true");assert.equal(r.hash.hidden,true);
 }
});
