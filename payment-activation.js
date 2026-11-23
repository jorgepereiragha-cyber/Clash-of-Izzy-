// Fail closed: provisioning credentials never authorizes charging players.
// This flag must be explicitly enabled only after sandbox and reconciliation gates.
export function paymentsEnabled(env) {
  return env?.PAYMENTS_LIVE_ENABLED === "true";
}
export function mercadoPagoCheckoutEnabled(env) {
  return paymentsEnabled(env) && Boolean(env?.MP_ACCESS_TOKEN && env?.MP_WEBHOOK_SECRET);
}
export function nubankCheckoutEnabled(env, legacyReady) {
  return paymentsEnabled(env) && Boolean(legacyReady);
}
