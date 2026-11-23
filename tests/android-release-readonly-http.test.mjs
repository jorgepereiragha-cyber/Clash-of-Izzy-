import test from "node:test";
import assert from "node:assert/strict";
import {readReleaseJson} from "../scripts/release-readonly-http.mjs";
import {checkAndroidReleaseServer, REQUIRED_ANDROID_CONTRACT} from "../scripts/check-android-release-server.mjs";
import {checkCommercialStore} from "../scripts/check-commercial-store.mjs";
import {checkFreeDistribution} from "../scripts/check-android-free-release.mjs";

const ready = () => ({
  ok:true,status:"ready",androidApiContract:REQUIRED_ANDROID_CONTRACT,
  checks:{database:true,session:true,schema:true},missingTables:[]
});
const response=(value,status=200)=>({
  status,
  json:async()=>value
});
test("every release preflight uses GET with manual redirects and fixed HTTPS paths",async()=>{
  const calls=[];
  await checkAndroidReleaseServer(async(url,options)=>{
    calls.push({url,options});
    return response(ready());
  });
  await checkFreeDistribution(async(url,options)=>{
    calls.push({url,options});
    return response({mercadoPago:false,nubankPix:false});
  });
  for(const {url,options} of calls){
    assert.equal(new URL(url).protocol,"https:");
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"manual");
    assert.equal(options.body,undefined);
  }
});
test("redirect 301/302/307/308 is blocked without following or retrying",async()=>{
  for(const status of [301,302,307,308]){
    let n=0;
    await assert.rejects(readReleaseJson(async()=>{n++;return response({},status);},
      "https://example.invalid/api/health"),/Redirecionamento HTTP bloqueado/);
    assert.equal(n,1);
  }
});
test("opaque redirected responses fail closed",async()=>{
  await assert.rejects(readReleaseJson(async()=>({
    status:0,type:"opaqueredirect",json:async()=>({})
  }),"https://example.invalid/api/store/catalog"),/Redirecionamento HTTP bloqueado/);
});
test("HTTP 503 fails once, without GET retries",async()=>{
  let n=0;
  await assert.rejects(readReleaseJson(async()=>{n++;return response({},503);},
    "https://example.invalid/api/health"),/HTTP 503/);
  assert.equal(n,1);
});
test("transient network failure is retried at most twice, with sanitized diagnostics",async()=>{
  let n=0;
  const value=await readReleaseJson(async()=>{
    n++;
    if(n<3)throw Object.assign(new TypeError("secret=must-not-appear"),{cause:{code:"ECONNRESET"}});
    return response({ok:true});
  },"https://example.invalid/api/health");
  assert.equal(n,3);
  assert.equal(value.value.ok,true);

  n=0;
  await assert.rejects(readReleaseJson(async()=>{
    n++;
    throw Object.assign(new Error("token=SECRET-DO-NOT-LOG"),{cause:{code:"ECONNRESET"}});
  },"https://example.invalid/api/health"),error=>{
    assert.equal(n,3);
    assert.match(error.message,/3 tentativas/);
    assert.match(error.message,/ECONNRESET/);
    assert.doesNotMatch(error.message,/SECRET|token=/);
    return true;
  });
});
test("untrusted URL query and credentials are rejected before network",async()=>{
  for(const url of [
    "https://example.invalid/api/health?token=private",
    "https://u:p@example.invalid/api/health",
    "http://example.invalid/api/health",
    "https://example.invalid/api/health#fragment"
  ]){
    let n=0;
    await assert.rejects(readReleaseJson(async()=>{n++;return response({});},url),
      /Endpoint do gate de release inválido/);
    assert.equal(n,0);
  }
});
test("invalid JSON and arrays are rejected without retry",async()=>{
  for(const value of [null,[],false,"bad"]){
    let n=0;
    await assert.rejects(readReleaseJson(async()=>{n++;return response(value);},
      "https://example.invalid/api/health"),/Resposta JSON inválida/);
    assert.equal(n,1);
  }
  await assert.rejects(readReleaseJson(async()=>({status:200,json:async()=>{throw Error("bad");}}),
    "https://example.invalid/api/health"),/Resposta JSON inválida/);
});
test("server and store redirect cannot be misinterpreted as readiness",async()=>{
  await assert.rejects(checkAndroidReleaseServer(async()=>response(ready(),302)),
    /Redirecionamento HTTP bloqueado/);
  await assert.rejects(checkCommercialStore(async()=>response({packages:[]},307)),
    /Redirecionamento HTTP bloqueado/);
});
