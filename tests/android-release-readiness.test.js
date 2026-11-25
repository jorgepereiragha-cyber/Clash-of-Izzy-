import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertAndroidReleaseServer,
  checkAndroidReleaseServer,
  LIVE_API_URL, REQUIRED_ANDROID_CONTRACT
} from "../scripts/check-android-release-server.mjs";

const ready = () => ({
  ok: true, status: "ready", androidApiContract: REQUIRED_ANDROID_CONTRACT,
  checks: { database: true, session: true, schema: true },
  missingTables: []
});

test("release só aprova servidor Android com contrato atual e esquema D1 completo",()=>{
  assert.equal(LIVE_API_URL, "https://clash-of-izzy.jorgepereiragha.workers.dev/api/health");
  assert.deepEqual(assertAndroidReleaseServer(ready(),200),
    { compatible:true, contract:REQUIRED_ANDROID_CONTRACT });
  const before = ready();
  delete before.androidApiContract;
  assert.throws(()=>assertAndroidReleaseServer(before,200),/contrato de Eldoria/);
  assert.throws(()=>assertAndroidReleaseServer({...ready(),androidApiContract:"old-web"},200),/contrato de Eldoria/);
  assert.throws(()=>assertAndroidReleaseServer(ready(),503),/API de produção/);
  assert.throws(()=>assertAndroidReleaseServer(null,200),/API de produção/);
});

test("release bloqueia schema incompleto, segredo ausente e resposta sem tabelas",()=>{
  const notReady = {...ready(), checks:{ database:true, session:false, schema:true }};
  assert.throws(()=>assertAndroidReleaseServer(notReady,200),/não está pronto/);
  assert.throws(()=>assertAndroidReleaseServer({...ready(),missingTables:["kingdom_mailbox"]},200),/tabelas D1 ausentes/);
  assert.throws(()=>assertAndroidReleaseServer({...ready(),missingTables:undefined},200),/tabelas D1 ausentes/);
  assert.throws(()=>assertAndroidReleaseServer({...ready(),ok:false},200),/não está pronto/);
});

test("verificador lê exclusivamente health HTTPS do Worker real e rejeita JSON inválido",async()=>{
  let captured = null;
  const good = await checkAndroidReleaseServer(async (url,options)=>{
    captured={url,options};
    return new Response(JSON.stringify(ready()),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  });
  assert.equal(good.compatible,true);
  assert.equal(captured.url,LIVE_API_URL);
  assert.equal(captured.options.method,"GET");
  assert.equal(captured.options.redirect,"manual");
  assert.equal(captured.options.headers.Accept,"application/json");
  await assert.rejects(checkAndroidReleaseServer(async()=>new Response("<html>fail</html>",{
    status:200, headers:{"Content-Type":"text/html"}
  })),/Resposta JSON inválida/);
});

test("Worker anuncia o contrato e APK oficial exige o health antes e depois do build",async()=>{
  const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
  const workflow=await readFile(new URL("../.github/workflows/publicar-apk-android.yml",import.meta.url),"utf8");
  const ignore=await readFile(new URL("../.assetsignore",import.meta.url),"utf8");
  const magic='androidApiContract:"'+REQUIRED_ANDROID_CONTRACT+'"';
  assert.ok(worker.includes(magic));
  assert.equal(workflow.split("node scripts/check-android-release-server.mjs").length-1,2);
  assert.ok(ignore.split(/\r?\n/).includes("scripts/check-android-release-server.mjs"));
  assert.ok(workflow.includes("Validar assinatura privada de release"));
  assert.ok(workflow.includes("ANDROID_RELEASE_CERT_SHA256"));
});
