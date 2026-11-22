// Read-only catalog validation, independent of payment-provider activation.
import {REQUIRED_OFFERS} from "./check-commercial-store.mjs";
import {pathToFileURL} from "node:url";

export function assertCatalogReady(catalog) {
  const errors=[];
  if (!catalog || !Array.isArray(catalog.packages)) throw new Error("Catalog packages missing");
  for (const expected of REQUIRED_OFFERS) {
    const matches=catalog.packages.filter(p=>p && p.name===expected.name);
    if (matches.length!==1) {errors.push(expected.name+": expected exactly one offer");continue;}
    const item=matches[0];
    const amount=Number(item.price_brl);
    if (!Number.isFinite(amount) || Math.round(amount*100)!==expected.priceCents ||
        Number(item.gems)!==expected.gems) errors.push(expected.name+": price/gems mismatch");
    if (expected.daily && Number(item.dailyLimitHours)!==24)
      errors.push(expected.name+": daily limit mismatch");
    if (expected.master && (item.oneTime!==true || !item.bonus))
      errors.push(expected.name+": master entitlement mismatch");
  }
  if (!Array.isArray(catalog.skins) || catalog.skins.length<6)
    errors.push("At least six skins required");
  if (errors.length) throw new Error("Catalog not ready: "+errors.join("; "));
  return {catalogReady:true, packages:REQUIRED_OFFERS.length, skins:catalog.skins.length,
    paymentsVerified:false};
}

export async function checkCatalog(fetchImpl=fetch, origin="https://clash-of-izzy.jorgepereiragha.workers.dev") {
  const response=await fetchImpl(origin+"/api/store/catalog",{
    method:"GET",redirect:"error",headers:{Accept:"application/json"},
    signal:AbortSignal.timeout(12000)
  });
  if (response?.status!==200) throw new Error("Catalog HTTP "+String(response?.status??0));
  return assertCatalogReady(await response.json());
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const result=await checkCatalog();
    console.log(JSON.stringify(result));
    console.log("Catalog only: payment reconciliation and Android signing remain separate release gates.");
  } catch(error) {
    console.error(String(error?.message??error));
    process.exitCode=1;
  }
}
