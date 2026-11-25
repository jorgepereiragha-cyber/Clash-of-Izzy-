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
async function render(releases,commercial=null){
 const nodes=new Map();
 function node(id){
  if(!nodes.has(id)){
   const attrs=new Map([["aria-disabled","true"]]);
   nodes.set(id,{hidden:true,textContent:"",addEventListener(){},setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k);if(k==="href")delete this.href},getAttribute:k=>attrs.get(k)});
  }
  return nodes.get(id);
 }
 runInNewContext(script,{document:{getElementById:node},navigator:{},URL,AbortController,setTimeout,clearTimeout,
  fetch:async url=>url.endsWith("/latest")?(commercial===null?{ok:false}:{ok:true,json:async()=>commercial}):{ok:true,json:async()=>releases}});
 await new Promise(resolve=>setImmediate(resolve));
 return {button:node("download-invite"),hash:node("invite-checksum"),official:node("download-apk"),officialHash:node("checksum-link"),status:node("invite-download-status")};
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

const commercialName="clash-of-izzy-android.apk";
function commercialRelease(){
 const tag="v1.2.3";
 return {draft:false,prerelease:false,tag_name:tag,assets:[commercialName,commercialName+".sha256"].map(name=>({name,state:"uploaded",size:100,browser_download_url:root+tag+"/"+name}))};
}
test("portal runtime: official APK and checksum must be an exact unique pair",async()=>{
 const valid=commercialRelease();
 const r=await render([release(11)],valid);
 assert.equal(r.official.href,root+"v1.2.3/"+commercialName);
 assert.equal(r.officialHash.href,r.official.href+".sha256");
 assert.equal(r.officialHash.hidden,false);
 assert.equal(r.official.getAttribute("aria-disabled"),undefined);
 assert.equal(r.button.href,root+"android-access-v11/"+name);
});
test("portal runtime: commercial download fails closed on invalid release metadata or assets",async()=>{
 const cases=[];
 for(const change of [
  x=>{x.draft=true},x=>{x.prerelease=true},x=>{delete x.draft},x=>{x.assets.pop()},
  x=>{x.assets.push({...x.assets[0]})},x=>{x.assets[0].size=0},x=>{x.assets[0].size=1.5},
  x=>{x.assets[0].state="new"},x=>{x.assets[0].browser_download_url+="?redirect=1"},
  x=>{x.assets[0].browser_download_url+="/extra"},x=>{x.assets[0].browser_download_url=x.assets[0].browser_download_url.replace("github.com","evil.example")},
  x=>{x.assets[1].browser_download_url=x.assets[1].browser_download_url.replace("v1.2.3","v9.9.9")}
 ]){const x=commercialRelease();change(x);cases.push(x)}
 for(const x of cases){
  const r=await render([release(11)],x);
  assert.equal(r.official.href,undefined);
  assert.equal(r.official.getAttribute("aria-disabled"),"true");
  assert.equal(r.officialHash.hidden,true);
  assert.equal(r.button.href,root+"android-access-v11/"+name);
 }
});
