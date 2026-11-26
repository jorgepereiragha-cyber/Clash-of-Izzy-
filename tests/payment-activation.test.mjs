import test from "node:test";
import assert from "node:assert/strict";
import { paymentsEnabled, mercadoPagoCheckoutEnabled, nubankCheckoutEnabled } from "../payment-activation.js";

test("credentials alone never activate Mercado Pago", () => {
  const env={MP_ACCESS_TOKEN:"synthetic",MP_WEBHOOK_SECRET:"synthetic"};
  assert.equal(paymentsEnabled(env),false);
  assert.equal(mercadoPagoCheckoutEnabled(env),false);
  assert.equal(mercadoPagoCheckoutEnabled({...env,PAYMENTS_LIVE_ENABLED:"TRUE"}),false);
  assert.equal(mercadoPagoCheckoutEnabled({...env,PAYMENTS_LIVE_ENABLED:true}),false);
});
test("explicit flag still requires both Mercado Pago credentials", () => {
  assert.equal(mercadoPagoCheckoutEnabled({PAYMENTS_LIVE_ENABLED:"true"}),false);
  assert.equal(mercadoPagoCheckoutEnabled({PAYMENTS_LIVE_ENABLED:"true",MP_ACCESS_TOKEN:"synthetic"}),false);
  assert.equal(mercadoPagoCheckoutEnabled({PAYMENTS_LIVE_ENABLED:"true",MP_ACCESS_TOKEN:"synthetic",MP_WEBHOOK_SECRET:"synthetic"}),true);
});
test("Nubank remains blocked unless explicit flag and legacy configuration both pass", () => {
  assert.equal(nubankCheckoutEnabled({PAYMENTS_LIVE_ENABLED:"false"},true),false);
  assert.equal(nubankCheckoutEnabled({PAYMENTS_LIVE_ENABLED:"true"},false),false);
  assert.equal(nubankCheckoutEnabled({PAYMENTS_LIVE_ENABLED:"true"},true),true);
});
