// Explicit business-mode switch. Default is legacy behavior until an approved
// production deploy sets GAME_FREE_FIRST_MODE_ENABLED="true".
// Never use merely absent payment credentials to infer free-first mode.
export const FREE_FIRST_MODE_FLAG = "GAME_FREE_FIRST_MODE_ENABLED";

export const PAID_ORDER_CREATION_PATHS = Object.freeze([
  "/api/store/checkout",
  "/api/support/checkout",
  "/api/store/purchase-request",
  "/api/store/pix-instructions"
]);
const paidOrderPaths = new Set(PAID_ORDER_CREATION_PATHS);

export function freeFirstModeEnabled(env) {
  return env?.[FREE_FIRST_MODE_FLAG] === "true";
}

export function blockNewPaidOrders(env, method, pathname) {
  return freeFirstModeEnabled(env) && method === "POST" && paidOrderPaths.has(pathname);
}

// Public status never announces providers as usable while the free-first lock
// is enabled, even if legacy credentials remain configured.
export function visiblePaymentMethods(env, nubankPixEnabled = false) {
  const freeFirstMode = freeFirstModeEnabled(env);
  return {
    mercadoPago: !freeFirstMode && Boolean(env?.MP_ACCESS_TOKEN && env?.MP_WEBHOOK_SECRET),
    nubankPix: !freeFirstMode && nubankPixEnabled === true,
    freeFirstMode
  };
}
