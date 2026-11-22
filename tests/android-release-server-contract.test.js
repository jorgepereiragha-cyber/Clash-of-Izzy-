import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAndroidReleaseServer, checkAndroidReleaseServer, LIVE_API_URL, REQUIRED_ANDROID_CONTRACT } from '../scripts/check-android-release-server.mjs';

const healthy = () => ({ok:true,status:'ready',androidApiContract:REQUIRED_ANDROID_CONTRACT,checks:{database:true,session:true,schema:true},missingTables:[]});

test('accepts only complete ready Android contract', () => {
  assert.deepEqual(assertAndroidReleaseServer(healthy(),200),{compatible:true,contract:REQUIRED_ANDROID_CONTRACT});
});
test('rejects non-200 HTTP status and malformed payload', () => {
  for (const status of [0,201,301,401,429,500,503]) assert.throws(()=>assertAndroidReleaseServer(healthy(),status));
  for (const payload of [null,undefined,false,'ready',[]]) assert.throws(()=>assertAndroidReleaseServer(payload,200));
});
test('rejects absent or mismatched Android contract', () => {
  for (const value of [undefined,'eldoria-android-v0','',null]) { const health=healthy();health.androidApiContract=value;assert.throws(()=>assertAndroidReleaseServer(health,200)); }
});
test('fails closed on each backend gate', () => {
  for (const gate of ['database','session','schema']) for (const value of [false,null,undefined,1]) {const health=healthy();health.checks[gate]=value;assert.throws(()=>assertAndroidReleaseServer(health,200));}
  for (const value of [false,null,1]) {const health=healthy();health.ok=value;assert.throws(()=>assertAndroidReleaseServer(health,200));}
  for (const value of ['degraded',null,undefined]) {const health=healthy();health.status=value;assert.throws(()=>assertAndroidReleaseServer(health,200));}
});
test('rejects missingTables absent, invalid, or nonempty', () => {
  for (const value of [undefined,null,{},'none',['players']]) {const health=healthy();health.missingTables=value;assert.throws(()=>assertAndroidReleaseServer(health,200));}
});
test('uses fixed HTTPS health endpoint and safe fetch options', async () => {
  let seen;
  const result=await checkAndroidReleaseServer(async (url,opts)=>{seen={url,opts};return {status:200,json:async()=>healthy()};});
  assert.equal(result.compatible,true);
  assert.equal(seen.url,LIVE_API_URL);
  assert.match(seen.url,/^https:\/\//);
  assert.equal(seen.opts.method,'GET');
  assert.equal(seen.opts.redirect,'error');
  assert.equal(seen.opts.headers.Accept,'application/json');
  assert.ok(seen.opts.signal);
});
test('rejects failed JSON parsing and missing response', async () => {
  await assert.rejects(checkAndroidReleaseServer(async()=>({status:200,json:async()=>{throw new SyntaxError('invalid JSON');}})));
  await assert.rejects(checkAndroidReleaseServer(async()=>null));
});
test('rejects fetch network failures', async () => {
  await assert.rejects(checkAndroidReleaseServer(async()=>{throw new Error('network offline');}),/network offline/);
});
