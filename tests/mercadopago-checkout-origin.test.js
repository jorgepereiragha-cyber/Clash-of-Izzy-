import test from "node:test";
import assert from "node:assert/strict";
import { isTrustedMercadoPagoCheckoutUrl } from "../mercadopago-orders.js";

test("payment redirects accept Mercado Pago HTTPS hosts only", () => {
  for (const url of [
    "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123",
    "https://checkout.mercadopago.com.br/checkout",
    "https://mercadopago.com/checkout"
  ]) assert.equal(isTrustedMercadoPagoCheckoutUrl(url), true, url);

  for (const url of [
    "http://www.mercadopago.com.br/checkout",
    "https://mercadopago.com.br.evil.example/checkout",
    "https://mercadopago.com.br@evil.example/checkout",
    "https://payments.example.com/checkout",
    "https://mercadopago.com.br:8443/checkout",
    "javascript:alert(1)",
    "",
    null
  ]) assert.equal(isTrustedMercadoPagoCheckoutUrl(url), false, String(url));
});
