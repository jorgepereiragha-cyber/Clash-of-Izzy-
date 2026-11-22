import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  BINDINGS_TO_AUDIT,evaluateCommercialBindings,auditCommercialBindings,reportCommercialBindings
} from "../scripts/audit-cloudflare-commerce.mjs";
const config=[
  {name:"DB",type:"d1",id:"db-private"},
  {name:"SESSION_SECRET",type:"secret_text",text:"private-session"},
  {name:"MP_ACCESS_TOKEN",type:"secret_text",text:"private-mp-access"},
  {name:"MP_WEBHOOK_SECRET",type:"secret_text",text:"private-mp-webhook"},
  {name:"NUBANK_PIX_KEY",type:"secret_text",text:"private-bank-identifier"},
  {name:"NUBANK_PIX_ENABLED",type:"plain_text",text:"true"},
  {name:"NUBANK_PIX_RECEIVER_VERIFIED",type:"plain_text",text:"true"},
  {name:"GOOGLE_WEB_CLIENT_ID",type:"secret_text",text:"private-google-id"}
];
test("analisa todos os bindings sem copiar valor bancário/secret para o relatório",()=>{
  const rows=evaluateCommercialBindings(config);
  assert.equal(rows.length,BINDINGS_TO_AUDIT.length);
  assert.ok(rows.every(x=>x.ok));
  const report=reportCommercialBindings(rows);
  for(const marker of [
    "private-session","private-mp-access","private-mp-webhook","private-bank-identifier","private-google-id","db-private"
  ])assert.ok(!report.includes(marker),"valor sensível vazado: "+marker);
  assert.ok(report.includes("NUBANK_PIX_RECEIVER_VERIFIED"));
});

test("reporta as causas exatas de bindings ausentes ou flags desativadas",()=>{
  const rows=evaluateCommercialBindings(config.filter(x=>x.name!=="MP_WEBHOOK_SECRET").map(x=>
    x.name==="NUBANK_PIX_ENABLED"?{...x,text:"false"}:x
  ));
  assert.ok(rows.find(x=>x.name==="MP_WEBHOOK_SECRET").state==="AUSENTE");
  assert.ok(rows.find(x=>x.name==="NUBANK_PIX_ENABLED").state==="DESATIVADO");
  assert.ok(rows.some(x=>!x.ok));
  const secretFlag=evaluateCommercialBindings(config.map(x=>
    x.name==="NUBANK_PIX_RECEIVER_VERIFIED"?{...x,type:"secret_text"}:x
  ));
  assert.equal(secretFlag.find(x=>x.name==="NUBANK_PIX_RECEIVER_VERIFIED").state,
    "PRESENTE, VALOR NÃO VERIFICÁVEL");
  assert.throws(()=>evaluateCommercialBindings({}),/lista de bindings/);
});

test("Cloudflare API: apenas GET, sem revelar credenciais no resultado",async()=>{
  const visits=[];
  const mock=async(url,options)=>{
    visits.push({url,method:options.method,headers:options.headers});
    return new Response(JSON.stringify({success:true,result:{bindings:config}}),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  const rows=await auditCommercialBindings({
    fetchImpl:mock,accountId:"a".repeat(32),token:" Bearer private-token "
  });
  assert.ok(rows.every(x=>x.ok));
  assert.equal(visits[0].method,"GET");
  assert.match(visits[0].url,/\/workers\/scripts\/clash-of-izzy\/settings$/);
  assert.equal(visits[0].headers.Authorization,"Bearer private-token");
  await assert.rejects(auditCommercialBindings({
    fetchImpl:async()=>new Response("no permission",{status:403}),
    accountId:"a".repeat(32),token:"private-token"
  }),/HTTP 403/);
});

test("o diagnóstico fica fora dos assets públicos e nunca atualiza configurações",async()=>{
  const [ignore,workflow,code]=await Promise.all([
    readFile(new URL("../.assetsignore",import.meta.url),"utf8"),
    readFile(new URL("../.github/workflows/auditar-comercio-cloudflare.yml",import.meta.url),"utf8"),
    readFile(new URL("../scripts/audit-cloudflare-commerce.mjs",import.meta.url),"utf8")
  ]);
  assert.ok(ignore.split(/\r?\n/).includes("scripts/audit-cloudflare-commerce.mjs"));
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/node scripts\/audit-cloudflare-commerce\.mjs/);
  assert.match(workflow,/branches: \[main\]/);
  assert.doesNotMatch(workflow,/wrangler deploy|d1 migrations apply|PUT |PATCH |POST /);
  assert.doesNotMatch(code,/method:"(?:POST|PUT|PATCH|DELETE)"/);
});
