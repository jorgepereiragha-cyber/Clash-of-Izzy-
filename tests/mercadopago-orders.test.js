import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Mercado Pago creates one Orders API checkout linked to an existing purchase request", async () => {
  const module = await read("mercadopago-orders.js");
  const migration = await read("migrations/0024_player_accounts_mercadopago_orders.sql");
  for (const snippet of [
    "https://api.mercadopago.com/v1/orders",
    "X-Idempotency-Key",
    "external_reference: externalReference",
    "checkout_url",
    "MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET",
    "mp_checkout_lock",
    "mp_order_id"
  ]) assert.ok(module.includes(snippet), "missing checkout safety: " + snippet);
  for (const column of ["mp_external_reference","mp_idempotency_key","mp_order_id","mp_checkout_url","mp_checkout_lock"]) {
    assert.ok(migration.includes(column), "missing persisted order field: " + column);
  }
  assert.ok(migration.includes("UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_mp_order_id"));
});

test("Mercado Pago webhook authenticates, fetches and verifies the payment before fulfillment", async () => {
  const module = await read("mercadopago-orders.js");
  for (const snippet of [
    'request.headers.get("x-signature")',
    'request.headers.get("x-request-id")',
    'name: "HMAC", hash: "SHA-256"',
    '"id:" + String(orderId).toLowerCase() + ";request-id:"',
    "https://api.mercadopago.com/v1/orders/",
    'currency === "BRL"',
    "actualCents === expectedCents",
    "paidCents === expectedCents",
    "INSERT OR IGNORE INTO mercadopago_orders",
    "status='approved'"
  ]) assert.ok(module.includes(snippet), "missing webhook verification: " + snippet);
});

test("store frontend opens the individual checkout and keeps the shared link as unconfigured fallback", async () => {
  const arena = await read("arena.html");
  assert.ok(arena.includes("API_BASE+'/store/checkout'"));
  assert.ok(arena.includes("checkout.checkoutUrl"));
  assert.ok(arena.includes('checkout.code===\'MP_NOT_CONFIGURED\''));
  assert.ok(arena.includes("https://link.mercadopago.com.br/pagamentosskin"));
});
