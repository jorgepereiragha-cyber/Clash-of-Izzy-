import test from "node:test";
import assert from "node:assert/strict";
import {assertCommercialStore, checkCommercialStore, REQUIRED_OFFERS} from "../scripts/check-commercial-store.mjs";

function catalog(){
  return {
    packages: REQUIRED_OFFERS.map(x=>({
      name:x.name,price_brl:x.priceCents/100,gems:x.gems,
      ...(x.daily?{dailyLimitHours:24}:{}),
      ...(x.master?{oneTime:true,bonus:{gems:1}}:{})
    })),
    skins:Array.from({length:6},(_,i)=>({name:"Skin "+i}))
  };
}
const methods={mercadoPago:true,nubankPix:true};

test("catalogue integrity does not authorize a disabled payment method",()=>{
  assert.throws(()=>assertCommercialStore(catalog(),{...methods,mercadoPago:false}),/Mercado Pago/);
  assert.throws(()=>assertCommercialStore(catalog(),{...methods,nubankPix:false}),/Nubank/);
});

test("rejects duplicate offers and changed prices",()=>{
  const duplicate=catalog();
  duplicate.packages.push({...duplicate.packages[0]});
  assert.throws(()=>assertCommercialStore(duplicate,methods),/exatamente um/);
  const changed=catalog();
  changed.packages[0].price_brl=4.99;
  assert.throws(()=>assertCommercialStore(changed,methods),/preço ou gemas/);
});

test("rejects absent Master bonus and insufficient skins",()=>{
  const noBonus=catalog();
  noBonus.packages.find(x=>x.name==="Pacote Master de Eldoria").bonus=null;
  assert.throws(()=>assertCommercialStore(noBonus,methods),/bônus Master/);
  const noSkins=catalog();
  noSkins.skins.pop();
  assert.throws(()=>assertCommercialStore(noSkins,methods),/seis skins/);
});

test("commercial audit only performs two read-only GET requests",async()=>{
  const requests=[];
  const fakeFetch=async(url,options)=>{
    requests.push({url,options});
    return {status:200,json:async()=>url.endsWith("/catalog")?catalog():methods};
  };
  const result=await checkCommercialStore(fakeFetch);
  assert.equal(result.packages,9);
  assert.equal(requests.length,2);
  assert.deepEqual(requests.map(r=>new URL(r.url).pathname).sort(),[
    "/api/store/catalog","/api/store/payment-methods"
  ]);
  for(const {url,options} of requests){
    assert.equal(new URL(url).protocol,"https:");
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"manual");
    assert.equal(options.body,undefined);
  }
});

test("audit fails closed on API errors and malformed JSON",async()=>{
  await assert.rejects(checkCommercialStore(async()=>({status:503,json:async()=>({})})),/indisponível/);
  await assert.rejects(checkCommercialStore(async()=>({status:200,json:async()=>null})),/JSON inválida/);
});
