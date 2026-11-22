// Release-only public check. Never creates orders, reads secrets, or edits production.
import {pathToFileURL} from "node:url";

export const COMMERCIAL_STORE_ORIGIN="https://clash-of-izzy.jorgepereiragha.workers.dev";
export const REQUIRED_OFFERS=Object.freeze([
  Object.freeze({name:"Pacote Inicial de Eldoria",priceCents:399,gems:35,daily:true}),
  Object.freeze({name:"Pacote Diário de Eldoria",priceCents:999,gems:100,daily:true}),
  Object.freeze({name:"Pacote Premium Diário de Eldoria",priceCents:4999,gems:600,daily:true}),
  Object.freeze({name:"VIP Bronze",priceCents:5000,gems:500}),
  Object.freeze({name:"VIP Prata",priceCents:10000,gems:1200}),
  Object.freeze({name:"VIP Ouro",priceCents:25000,gems:3500}),
  Object.freeze({name:"VIP Diamante",priceCents:50000,gems:8000}),
  Object.freeze({name:"VIP Lendário",priceCents:100000,gems:18000}),
  Object.freeze({name:"Pacote Master de Eldoria",priceCents:39900,gems:10000,master:true})
]);

function cents(value){
  const number=Number(value);
  return Number.isFinite(number)&&number>0?Math.round(number*100):0;
}

export function assertCommercialStore(catalog,methods){
  const errors=[];
  if(!catalog||typeof catalog!=="object"||!Array.isArray(catalog.packages)){
    throw new Error("O catálogo de produção não retornou uma lista de pacotes.");
  }
  if(!methods||typeof methods!=="object"){
    throw new Error("O backend não confirmou os meios de pagamento.");
  }
  const found=[];
  for(const expected of REQUIRED_OFFERS){
    const matches=catalog.packages.filter(x=>x&&x.name===expected.name);
    if(matches.length!==1){
      errors.push(expected.name+": esperado exatamente um produto publicado");
      continue;
    }
    const item=matches[0];
    if(cents(item.price_brl)!==expected.priceCents || Number(item.gems)!==expected.gems){
      errors.push(expected.name+": preço ou gemas não correspondem ao catálogo aprovado");
      continue;
    }
    if(expected.daily&&Number(item.dailyLimitHours)!==24){
      errors.push(expected.name+": limite de 24 horas não confirmado");
      continue;
    }
    if(expected.master&&(item.oneTime!==true||!item.bonus)){
      errors.push(expected.name+": entrega única e bônus Master não confirmados");
      continue;
    }
    found.push(expected.name);
  }
  if(!Array.isArray(catalog.skins)||catalog.skins.length<6){
    errors.push("As seis skins iniciais não aparecem no catálogo");
  }
  if(methods.mercadoPago!==true){
    errors.push("Checkout Mercado Pago desabilitado ou sem configuração confirmada");
  }
  if(methods.nubankPix!==true){
    errors.push("Pix Nubank assistido desabilitado ou sem verificação do recebedor");
  }
  if(errors.length){
    throw new Error("Release comercial bloqueada: "+errors.join("; "));
  }
  return {ready:true,packages:found.length,skins:catalog.skins.length,
    mercadoPago:true,nubankPix:true};
}

async function fetchJson(fetchImpl,path){
  const response=await fetchImpl(COMMERCIAL_STORE_ORIGIN+path,{
    method:"GET",redirect:"error",headers:{Accept:"application/json"},
    signal:AbortSignal.timeout(12000)
  });
  if(!response||response.status!==200){
    throw new Error("API pública indisponível em "+path+" (HTTP "+String(response?.status||0)+").");
  }
  const value=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"){
    throw new Error("Resposta JSON inválida em "+path+".");
  }
  return value;
}

export async function checkCommercialStore(fetchImpl=fetch){
  const [catalog,methods]=await Promise.all([
    fetchJson(fetchImpl,"/api/store/catalog"),
    fetchJson(fetchImpl,"/api/store/payment-methods")
  ]);
  return assertCommercialStore(catalog,methods);
}

async function main(){
  try{
    const result=await checkCommercialStore();
    console.log("Catálogo comercial publicado: "+result.packages+
      " pacotes / "+result.skins+" skins; Mercado Pago e Nubank Pix habilitados.");
    console.log("IMPORTANTE: configuração informada pelo backend não comprova transação real. Exigir teste de conciliação antes de vender.");
  }catch(error){
    console.error("APK comercial ainda não autorizado: "+String(error?.message||error));
    process.exitCode=1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
