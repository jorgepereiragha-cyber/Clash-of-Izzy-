// New charges require explicit approval; already-issued provider callbacks remain routable.
const NEW_CHARGE_ROUTES=new Set(["/api/store/checkout","/api/store/purchase-request","/api/store/pix-instructions","/api/support/checkout"]);
export function livePaymentsEnabled(env={}){
 return env.ENVIRONMENT==="production"&&env.LIVE_PAYMENTS_APPROVED==="true";
}
export function blocksNewCharge(path,method,env={}){
 return method==="POST"&&NEW_CHARGE_ROUTES.has(path)&&!livePaymentsEnabled(env);
}
