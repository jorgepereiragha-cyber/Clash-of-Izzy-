import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  assertCommercialStore,checkCommercialStore,COMMERCIAL_STORE_ORIGIN,REQUIRED_OFFERS
} from "../scripts/check-commercial-store.mjs";

const goodCatalog=()=>({
  packages:REQUIRED_OFFERS.map(x=>({
    name:x.name,price_brl:x.priceCents/100,gems:x.gems,
    ...(x.daily?{dailyLimitHours:24}:{}),
    ...(x.master?{oneTime:true,bonus:{resources:true}}:{})
  })),
  skins:Array.from({length:6},(_,i)=>({id:i+1}))
});
const methods={mercadoPago:true,nubankPix:true};

test("publicação aprova nove pacotes com preço, gemas, cooldown e seis skins",()=>{
  const ready=assertCommercialStore(goodCatalog(),methods);
  assert.deepEqual(ready,{ready:true,packages:9,skins:6,mercadoPago:true,nubankPix:true});
});

test("não considera banco informado como checkout/conciliacao concluídos",()=>{
  for(const payment of [
    {mercadoPago:false,nubankPix:true},
    {mercadoPago:true,nubankPix:false},
    {mercadoPago:false,nubankPix:false},
    {}
  ]){
    assert.throws(()=>assertCommercialStore(goodCatalog(),payment),/Release comercial bloqueada/);
  }
});

test("bloqueia ausência, duplicação e preço ou bônus incorretos",()=>{
  const absent=goodCatalog();
  absent.packages.splice(0,1);
  assert.throws(()=>assertCommercialStore(absent,methods),/Pacote Inicial de Eldoria/);

  const duplicated=goodCatalog();
  duplicated.packages.push({...duplicated.packages[0]});
  assert.throws(()=>assertCommercialStore(duplicated,methods),/exatamente um produto/);

  const priced=goodCatalog();
  priced.packages[1].price_brl=0.99;
  assert.throws(()=>assertCommercialStore(priced,methods),/preço ou gemas/);

  const badGems=goodCatalog();
  badGems.packages[2].gems=601;
  assert.throws(()=>assertCommercialStore(badGems,methods),/preço ou gemas/);

  const noCooldown=goodCatalog();
  noCooldown.packages[0].dailyLimitHours=0;
  assert.throws(()=>assertCommercialStore(noCooldown,methods),/24 horas/);

  const noMaster=goodCatalog();
  noMaster.packages.at(-1).oneTime=false;
  assert.throws(()=>assertCommercialStore(noMaster,methods),/bônus Master/);

  const noSkins=goodCatalog();
  noSkins.skins=[];
  assert.throws(()=>assertCommercialStore(noSkins,methods),/seis skins/);
});

test("consulta API pública exclusivamente por GET e falha fechado em rede ou JSON inválido",async()=>{
  const visits=[];
  const mock=async(url,opts)=>{
    visits.push({url,method:opts.method,redirect:opts.redirect});
    const value=url.endsWith("/api/store/catalog")?goodCatalog():methods;
    return new Response(JSON.stringify(value),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  const result=await checkCommercialStore(mock);
  assert.equal(result.ready,true);
  assert.deepEqual(visits.map(x=>x.url),[
    COMMERCIAL_STORE_ORIGIN+"/api/store/catalog",
    COMMERCIAL_STORE_ORIGIN+"/api/store/payment-methods"
  ]);
  assert.ok(visits.every(x=>x.method==="GET"&&x.redirect==="error"));
  await assert.rejects(checkCommercialStore(async()=>new Response("{}",{status:503})),/API pública indisponível/);
  await assert.rejects(checkCommercialStore(async()=>new Response("<html>",{status:200})),/Resposta JSON inválida/);
});

test("workflow de APK exige o gate comercial antes da assinatura e da publicação",async()=>{
  const flow=await readFile(new URL("../.github/workflows/publicar-apk-android.yml",import.meta.url),"utf8");
  const ignore=await readFile(new URL("../.assetsignore",import.meta.url),"utf8");
  const commands=flow.split("node scripts/check-commercial-store.mjs").length-1;
  assert.equal(commands,2,"gate deve ser validado antes da compilação e novamente antes de publicar");
  const first=flow.indexOf("node scripts/check-commercial-store.mjs");
  const signing=flow.indexOf("Validar assinatura privada de release");
  const second=flow.lastIndexOf("node scripts/check-commercial-store.mjs");
  const release=flow.indexOf("Publicar release oficial com APK e checksum");
  assert.ok(first>0&&first<signing&&second>signing&&second<release);
  assert.ok(ignore.split(/\r?\n/).includes("scripts/check-commercial-store.mjs"));
  assert.doesNotMatch(flow,/MP_ACCESS_TOKEN:\s*\$\{\{/);
});
