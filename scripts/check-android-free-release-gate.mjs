// Validacao fail-closed antes de assinar e imediatamente antes de publicar APK gratuito.
import {pathToFileURL} from "node:url";
export const ORIGIN="https://clash-of-izzy.jorgepereiragha.workers.dev";
export const REQUIRED_FREE_CONTRACT="coi-android-free-v1";
export const REQUIRED_BLOCKED_ROUTES=[
  "/api/store/purchase-request","/api/store/checkout","/api/store/pix-instructions",
  "/api/support/checkout","/api/admin/purchase-requests/review","/api/admin/gems"
];

export function assertFreeAndroidGate(contract,methods){
  if(contract?.contract!==REQUIRED_FREE_CONTRACT||contract.ready!==true||
     contract.mode!=="free"||contract.checkoutCreationBlocked!==true||
     contract.paymentsDisabled!==true||
     [contract.pendingOrders,contract.pendingSupportOrders,contract.unfulfilledOrders].some(n=>n!==0)||
     !Array.isArray(contract.blockedRoutes)||
     REQUIRED_BLOCKED_ROUTES.some(route=>!contract.blockedRoutes.includes(route))||
     methods?.mercadoPago!==false||methods?.nubankPix!==false)
    throw new Error("APK gratuito bloqueado: contrato do backend, ausencia de pedidos ou rotas financeiras nao comprovados.");
  return {ready:true,mode:"gratuito"};
}
export async function checkFreeAndroidGate(fetchImpl=fetch){
  async function get(path){
    const response=await fetchImpl(ORIGIN+path,{method:"GET",redirect:"error",
      headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
    if(!response||response.status!==200)throw new Error("Readiness gratuito indisponível: "+path);
    return response.json().catch(()=>null);
  }
  const [contract,methods]=await Promise.all([
    get("/api/android/free-release-readiness"),get("/api/store/payment-methods")
  ]);
  return assertFreeAndroidGate(contract,methods);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{await checkFreeAndroidGate();console.log("Contrato gratuito: backend bloqueia nova cobrança e não possui pedidos pendentes.");}
  catch(error){console.error(String(error?.message||error));process.exitCode=1}
}
