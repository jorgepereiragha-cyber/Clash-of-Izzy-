// Sideload gratuito: na ausencia de evidencia rigorosa, rejeitar publicacao.
const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export const FREE_ANDROID_CONTRACT="coi-android-free-v1";
export const COMMERCE_CREATION_PATHS=Object.freeze([
  "/api/store/purchase-request",
  "/api/store/checkout",
  "/api/store/pix-instructions",
  "/api/support/checkout",
  "/api/admin/purchase-requests/review",
  "/api/admin/gems"
]);

export function freeModeEnabled(env){
  return String(env?.ANDROID_FREE_RELEASE_MODE_ENABLED)==="true";
}
export function freeModeCommerceBlocked(request,env){
  if(!freeModeEnabled(env)||request.method!=="POST")return false;
  return COMMERCE_CREATION_PATHS.includes(new URL(request.url).pathname);
}
export async function freeAndroidReadiness(env){
  if(!env?.DB)return json({contract:FREE_ANDROID_CONTRACT,ready:false,reason:"D1 indisponível"},503);
  const on=freeModeEnabled(env);
  const paymentMethodsOff=!env.MP_ACCESS_TOKEN&&!env.MP_WEBHOOK_SECRET&&
    !env.NUBANK_PIX_KEY&&String(env.NUBANK_PIX_ENABLED)!=="true"&&
    String(env.NUBANK_PIX_RECEIVER_VERIFIED)!=="true";
  let pendingOrders=null,pendingSupportOrders=null,unfulfilledOrders=null;
  try{
    const tables=await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('purchase_requests','support_orders','mercadopago_orders')"
    ).all();
    const names=new Set((tables.results||[]).map(row=>String(row.name)));
    if(["purchase_requests","support_orders","mercadopago_orders"].every(name=>names.has(name))){
      const result=await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) AS n FROM purchase_requests WHERE status='pending'"),
        env.DB.prepare("SELECT COUNT(*) AS n FROM support_orders WHERE status='pending'"),
        env.DB.prepare("SELECT COUNT(*) AS n FROM mercadopago_orders WHERE fulfilled_at IS NULL AND status NOT IN ('cancelled','rejected','refunded')")
      ]);
      pendingOrders=Number(result[0]?.results?.[0]?.n);
      pendingSupportOrders=Number(result[1]?.results?.[0]?.n);
      unfulfilledOrders=Number(result[2]?.results?.[0]?.n);
    }
  }catch{
    // Colunas ausentes ou acesso falho: readiness deve continuar false.
  }
  const noOutstanding=[pendingOrders,pendingSupportOrders,unfulfilledOrders].every(n=>Number.isSafeInteger(n)&&n===0);
  const ready=on&&paymentMethodsOff&&noOutstanding;
  return json({contract:FREE_ANDROID_CONTRACT,ready,mode:ready?"free":"blocked",
    paymentsDisabled:paymentMethodsOff,
    checkoutCreationBlocked:on,
    blockedRoutes:COMMERCE_CREATION_PATHS,
    pendingOrders,pendingSupportOrders,unfulfilledOrders},200);
}
