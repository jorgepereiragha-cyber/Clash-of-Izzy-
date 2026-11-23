// Additional explicit release gate. Secrets alone must never enable new real-money checkout.
// Keep webhook settlement independent, so a temporary sales pause does not strand paid orders.
export function mercadoPagoNewCheckoutEnabled(env) {
  return env?.MP_PAYMENTS_ENABLED === "true" &&
    Boolean(env?.MP_ACCESS_TOKEN && env?.MP_WEBHOOK_SECRET);
}
