import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Mercado Pago Orders checkout retains idempotency and is enabled when secrets are configured", async () => {
  const module = await read("mercadopago-orders.js");
  const migration = await read("migrations/0024_player_accounts_mercadopago_orders.sql");
  for (const snippet of [
    "https://api.mercadopago.com/v1/orders",
    "X-Idempotency-Key",
    "external_reference: externalReference",
    "checkout_url",
    "MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET",
    "mp_checkout_lock",
    "mp_order_id",
    "function isTrustedCheckoutUrl",
    'host.endsWith(".mercadopago.com.br")',
    'host.endsWith(".mercadopago.com")',
    "if (!isTrustedCheckoutUrl(order.mp_checkout_url))"
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

test("store creates an individually linked Mercado Pago order and opens the HTTPS checkout", async () => {
  const arena = await read("arena.html");
  assert.ok(arena.includes("API_BASE+'/store/purchase-request'"));
  assert.ok(arena.includes("const paymentMethod=document.getElementById('purchaseMethod')?.value==='pix'?'pix':'mercadopago_link'"));
  assert.ok(arena.includes("API_BASE+'/store/checkout'"));
  assert.ok(arena.includes("checkout.checkoutUrl"));
  assert.ok(arena.includes("window.open('about:blank'"));
  assert.ok(arena.includes("checkoutUrl.protocol!=='https:'"));
  assert.doesNotMatch(arena, /paymentMethod:'manual_whatsapp'/);
});


import { webcrypto } from "node:crypto";
import { handleMercadoPagoRoute, validateWebhookSignature } from "../mercadopago-orders.js";

globalThis.crypto ??= webcrypto;

async function signManifest(manifest, secret) {
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

test("Mercado Pago webhook signature accepts the official HMAC manifest and rejects tampering", async () => {
  const secret = "test-only-webhook-secret";
  const orderId = "ORDER-TEST-123";
  const requestId = "request-test-456";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const manifest = `id:${orderId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const validSignature = await signManifest(manifest, secret);
  const request = new Request(
    `https://example.invalid/api/webhook/mp?type=order&data.id=${encodeURIComponent(orderId)}`,
    {
      method: "POST",
      headers: {
        "x-signature": `ts=${timestamp},v1=${validSignature}`,
        "x-request-id": requestId
      }
    }
  );

  assert.equal(await validateWebhookSignature(request, orderId, secret), true);
  assert.equal(await validateWebhookSignature(request, orderId, "different-secret"), false);
  assert.equal(await validateWebhookSignature(request, "another-order", secret), false);

  const modified = new Request(request.url, {
    method: "POST",
    headers: {
      "x-signature": `ts=${timestamp},v1=${"0".repeat(64)}`,
      "x-request-id": requestId
    }
  });
  assert.equal(await validateWebhookSignature(modified, orderId, secret), false);

  const missingRequestId = new Request(request.url, {
    method: "POST",
    headers: { "x-signature": `ts=${timestamp},v1=${validSignature}` }
  });
  assert.equal(await validateWebhookSignature(missingRequestId, orderId, secret), false);
});


test("checkout fails closed when provider secrets are absent and webhook remains protected", async () => {
  const ctx = {
    json(payload, status = 200) {
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" }
      });
    }
  };
  const checkoutRequest = new Request("https://game.example/api/store/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: 1 })
  });
  const checkoutResponse = await handleMercadoPagoRoute(checkoutRequest, {}, ctx);
  assert.equal(checkoutResponse.status, 503);
  assert.equal((await checkoutResponse.json()).code, "MP_NOT_CONFIGURED");

  const webhookRequest = new Request("https://game.example/api/webhook/mp?type=order&data.id=OLD-ORDER", {
    method: "POST"
  });
  const legacyWebhookResponse = await handleMercadoPagoRoute(webhookRequest, {}, ctx);
  assert.equal(legacyWebhookResponse.status, 503);
  assert.equal((await legacyWebhookResponse.json()).error, "Webhook de pagamento não configurado.");
});


test("webhook rejects replay outside 300 seconds and accepts timestamp seconds/milliseconds", async () => {
  const secret = "webhook-test-secret-only";
  const orderId = "ORDER-FRESHNESS-TEST";
  const requestId = "request-freshness-test";
  const nowMs = Date.UTC(2026, 10, 22, 12, 0, 0);
  const nowSeconds = Math.floor(nowMs / 1000);
  async function verify(ts) {
    const manifest = `id:${orderId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const hash = await signManifest(manifest, secret);
    const request = new Request(
      `https://example.invalid/api/webhook/mp?type=order&data.id=${orderId}`,
      {method: "POST", headers: {
        "x-signature": `ts=${ts},v1=${hash}`,
        "x-request-id": requestId
      }}
    );
    return validateWebhookSignature(request, orderId, secret, nowMs);
  }
  assert.equal(await verify(String(nowSeconds)), true);
  assert.equal(await verify(String(nowSeconds - 299)), true);
  assert.equal(await verify(String(nowSeconds + 299)), true);
  assert.equal(await verify(String(nowMs)), true);
  assert.equal(await verify(String(nowMs - 299_000)), true);
  assert.equal(await verify(String(nowSeconds - 301)), false);
  assert.equal(await verify(String(nowSeconds + 301)), false);
  assert.equal(await verify(String(nowMs - 300_001)), false);
  assert.equal(await verify(String(nowMs + 300_001)), false);
  assert.equal(await verify("invalid"), false);
  assert.equal(await verify("0"), false);
});
