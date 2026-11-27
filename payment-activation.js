// Explicit fail-closed gates for new sales; webhook settlement remains independent.
export function commercialSalesEnabled(env) {
  return env?.COMMERCIAL_SALES_ENABLED === "true";
}

export function manualWhatsappOrdersEnabled(env) {
  return commercialSalesEnabled(env) && env?.MANUAL_WHATSAPP_ENABLED === "true";
}

export function mercadoPagoNewCheckoutEnabled(env) {
  return commercialSalesEnabled(env) &&
    env?.MP_PAYMENTS_ENABLED === "true" &&
    Boolean(env?.MP_ACCESS_TOKEN && env?.MP_WEBHOOK_SECRET);
}
