function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeHexEqual(left, right) {
  const a = String(left || "").toLowerCase();
  const b = String(right || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b) || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

// Checkout links must remain on an HTTPS domain controlled by Mercado Pago.
// Do not redirect players to an arbitrary URL, even if it appeared in a gateway response.
export function isTrustedMercadoPagoCheckoutUrl(value) {
  try {
    const checkout = new URL(String(value || ""));
    const host = checkout.hostname.toLowerCase();
    const trusted = ["mercadopago.com.br", "mercadopago.com"]
      .some(domain => host === domain || host.endsWith("." + domain));
    return checkout.protocol === "https:" && trusted && !checkout.username && !checkout.password && !checkout.port;
  } catch {
    return false;
  }
}

export async function validateWebhookSignature(request, orderId, secret) {
  const signatureHeader = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const fields = Object.fromEntries(signatureHeader.split(",").map(part => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const timestamp = fields.ts;
  const received = fields.v1;
  if (!timestamp || !received || !requestId || !orderId) return false;
  const manifest = "id:" + String(orderId).toLowerCase() + ";request-id:" + requestId + ";ts:" + timestamp + ";";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const calculated = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeHexEqual(calculated, received);
}

async function createCheckout(request, env, ctx) {
  if (!env.MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET) return ctx.json({ error: "Checkout automático ainda não configurado por completo; o link Mercado Pago atual continua disponível.", code: "MP_NOT_CONFIGURED" }, 503);
  const playerId = await ctx.gameIdentity(request, env);
  if (!playerId) return ctx.json({ error: "Sessão do jogador inválida." }, 401);
  const limited = await ctx.rateLimitDecision(env, "mercadopago-checkout-player", playerId, 5, 3600);
  if (limited) return limited;
  const body = await ctx.readBody(request, 4096);
  if (body.__bodyError) return ctx.json({ error: "Solicitação de checkout inválida." }, 400);
  const requestId = Number(body.requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1) return ctx.json({ error: "Pedido inválido." }, 400);

  const order = await env.DB.prepare(
    "SELECT r.id,r.player_id,r.product_kind,r.product_id,r.product_name,r.price_brl,r.currency,r.status,r.mp_external_reference,r.mp_idempotency_key,r.mp_order_id,r.mp_checkout_url,r.mp_checkout_lock,r.mp_checkout_lock_expires_at,p.player_id AS public_player_id " +
    "FROM purchase_requests r JOIN players p ON p.id=r.player_id WHERE r.id=? AND p.player_id=?"
  ).bind(requestId, playerId).first();
  if (!order) return ctx.json({ error: "Pedido não encontrado para este reino." }, 404);
  if (order.status !== "pending") return ctx.json({ error: "Este pedido não está mais aguardando pagamento." }, 409);
  if (order.mp_checkout_url && order.mp_order_id) {
    if (!isTrustedMercadoPagoCheckoutUrl(order.mp_checkout_url)) return ctx.json({ error: "Checkout armazenado com destino inválido; solicite revisão do suporte." }, 409);
    return ctx.json({ success: true, checkoutUrl: order.mp_checkout_url, orderId: order.mp_order_id, reused: true });
  }

  const now = Math.floor(Date.now() / 1000);
  const lockToken = crypto.randomUUID();
  const externalReference = order.mp_external_reference || ("coi_" + crypto.randomUUID().replace(/-/g, ""));
  const idempotencyKey = order.mp_idempotency_key || crypto.randomUUID();
  const claimed = await env.DB.prepare(
    "UPDATE purchase_requests SET mp_external_reference=COALESCE(mp_external_reference,?),mp_idempotency_key=COALESCE(mp_idempotency_key,?),mp_checkout_lock=?,mp_checkout_lock_expires_at=? " +
    "WHERE id=? AND status='pending' AND mp_checkout_url IS NULL AND (mp_checkout_lock IS NULL OR COALESCE(mp_checkout_lock_expires_at,0)<=?)"
  ).bind(externalReference, idempotencyKey, lockToken, now + 90, requestId, now).run();
  if (!claimed.meta?.changes) {
    const current = await env.DB.prepare("SELECT mp_order_id,mp_checkout_url,mp_checkout_lock_expires_at FROM purchase_requests WHERE id=?").bind(requestId).first();
    if (current?.mp_checkout_url && current?.mp_order_id) {
      if (!isTrustedMercadoPagoCheckoutUrl(current.mp_checkout_url)) return ctx.json({ error: "Checkout armazenado com destino inválido; solicite revisão do suporte." }, 409);
      return ctx.json({ success: true, checkoutUrl: current.mp_checkout_url, orderId: current.mp_order_id, reused: true });
    }
    return ctx.json({ error: "O checkout deste pedido já está sendo preparado. Tente novamente em instantes." }, 409);
  }

  try {
    const priceCents = moneyToCents(order.price_brl);
    if (!priceCents) throw new Error("invalid_price");
    const price = (priceCents / 100).toFixed(2);
    const payload = {
      type: "online",
      processing_mode: "manual",
      capture_mode: "automatic_async",
      total_amount: price,
      external_reference: externalReference,
      description: "Clash of Izzy · " + String(order.product_name).slice(0, 120),
      items: [{ title: String(order.product_name).slice(0, 120), quantity: 1, unit_price: price, external_code: String(order.product_kind) + "_" + String(order.product_id) }]
    };
    const response = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.MP_ACCESS_TOKEN,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.id || !result.checkout_url) {
      console.error("mercadopago_order_create_failed", response.status, String(result.message || result.error || "unknown").slice(0, 200));
      await env.DB.prepare("UPDATE purchase_requests SET mp_checkout_lock=NULL,mp_checkout_lock_expires_at=NULL WHERE id=? AND mp_checkout_lock=?").bind(requestId, lockToken).run();
      return ctx.json({ error: "O Mercado Pago não conseguiu criar o checkout. O pedido foi preservado para nova tentativa." }, 502);
    }
    if (!isTrustedMercadoPagoCheckoutUrl(result.checkout_url)) throw new Error("untrusted_checkout_url");
    const checkout = new URL(String(result.checkout_url));
    const saved = await env.DB.prepare(
      "UPDATE purchase_requests SET mp_order_id=?,mp_checkout_url=?,mp_payment_status=?,mp_checkout_lock=NULL,mp_checkout_lock_expires_at=NULL " +
      "WHERE id=? AND status='pending' AND mp_checkout_lock=? AND mp_external_reference=?"
    ).bind(String(result.id), checkout.href, String(result.status || "created"), requestId, lockToken, externalReference).run();
    if (!saved.meta?.changes) return ctx.json({ error: "O pedido mudou durante a criação do checkout. Consulte o estado do pedido antes de tentar novamente." }, 409);
    return ctx.json({ success: true, checkoutUrl: checkout.href, orderId: String(result.id) });
  } catch (error) {
    await env.DB.prepare("UPDATE purchase_requests SET mp_checkout_lock=NULL,mp_checkout_lock_expires_at=NULL WHERE id=? AND mp_checkout_lock=?").bind(requestId, lockToken).run().catch(() => {});
    console.error("mercadopago_checkout_failed", String(error?.message || error));
    return ctx.json({ error: "Não foi possível preparar o checkout Mercado Pago." }, 502);
  }
}

async function handleWebhook(request, env, ctx) {
  if (!env.MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET) return ctx.json({ error: "Webhook de pagamento não configurado." }, 503);
  const url = new URL(request.url);
  const type = String(url.searchParams.get("type") || "").toLowerCase();
  const orderId = String(url.searchParams.get("data.id") || "").trim();
  if (type !== "order" || !orderId) return ctx.json({ received: true, ignored: true });
  if (!await validateWebhookSignature(request, orderId, env.MP_WEBHOOK_SECRET)) {
    return ctx.json({ error: "Assinatura do webhook inválida." }, 401);
  }

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.mercadopago.com/v1/orders/" + encodeURIComponent(orderId), {
      headers: { "Authorization": "Bearer " + env.MP_ACCESS_TOKEN, "Accept": "application/json" }
    });
  } catch (error) {
    console.error("mercadopago_order_fetch_failed", String(error?.message || error));
    return ctx.json({ error: "Não foi possível consultar a order no Mercado Pago." }, 503);
  }
  const providerOrder = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) {
    console.error("mercadopago_order_fetch_failed", providerResponse.status);
    return ctx.json({ error: "Não foi possível confirmar a order no Mercado Pago." }, 503);
  }

  const purchase = await env.DB.prepare(
    "SELECT id,player_id,product_kind,product_id,price_brl,currency,status,mp_order_id,mp_external_reference " +
    "FROM purchase_requests WHERE mp_external_reference=? AND mp_order_id=?"
  ).bind(String(providerOrder.external_reference || ""), orderId).first();
  if (!purchase) return ctx.json({ received: true, ignored: true });
  const expectedCents = moneyToCents(purchase.price_brl);
  const actualCents = moneyToCents(providerOrder.total_amount);
  const paidCents = moneyToCents(providerOrder.total_paid_amount);
  const currency = String(providerOrder.currency || providerOrder.currency_id || "");
  const payments = Array.isArray(providerOrder.transactions?.payments) ? providerOrder.transactions.payments : [];
  const confirmedPayments = payments.filter(payment =>
    ["processed", "approved"].includes(String(payment.status || "").toLowerCase()) &&
    moneyToCents(payment.paid_amount ?? payment.amount) > 0
  );
  const paidPaymentsCents = confirmedPayments.reduce((sum, payment) => sum + moneyToCents(payment.paid_amount ?? payment.amount), 0);
  const paid = String(providerOrder.status || "").toLowerCase() === "processed" &&
    currency === "BRL" &&
    expectedCents > 0 &&
    actualCents === expectedCents &&
    paidCents === expectedCents &&
    confirmedPayments.length > 0 &&
    paidPaymentsCents === expectedCents;

  if (!paid) {
    await env.DB.prepare("UPDATE purchase_requests SET mp_payment_status=? WHERE id=? AND status='pending' AND mp_order_id=?")
      .bind(String(providerOrder.status || "unknown").slice(0, 80), purchase.id, orderId).run();
    return ctx.json({ received: true, pending: true });
  }

  const paymentIds = confirmedPayments.map(payment => String(payment.id || "")).filter(Boolean);
  const common = [
    env.DB.prepare(
      "INSERT OR IGNORE INTO mercadopago_orders(order_id,request_id,external_reference,amount_cents,currency,status,status_detail,payment_ids_json) VALUES(?,?,?,?,?,?,?,?)"
    ).bind(
      orderId, purchase.id, purchase.mp_external_reference, expectedCents, "BRL",
      String(providerOrder.status), String(providerOrder.status_detail || ""),
      JSON.stringify(paymentIds)
    ),
    env.DB.prepare(
      "UPDATE purchase_requests SET status='approved',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='mercadopago-webhook',mp_payment_status='processed' " +
      "WHERE id=? AND status='pending' AND mp_order_id=? AND mp_external_reference=? AND changes()=1"
    ).bind(purchase.id, orderId, purchase.mp_external_reference)
  ];
  if (purchase.product_kind === "vip_package") {
    common.push(env.DB.prepare(
      "UPDATE players SET gems=gems+(SELECT gems_amount FROM purchase_requests WHERE id=?) WHERE id=? AND changes()=1"
    ).bind(purchase.id, purchase.player_id));
  } else if (purchase.product_kind === "skin") {
    common.push(env.DB.prepare(
      "INSERT OR IGNORE INTO player_skins(player_id,skin_id) SELECT ?,? WHERE changes()=1"
    ).bind(purchase.player_id, purchase.product_id));
  }
  common.push(env.DB.prepare(
    "UPDATE mercadopago_orders SET fulfilled_at=CURRENT_TIMESTAMP WHERE order_id=? AND fulfilled_at IS NULL " +
    "AND EXISTS(SELECT 1 FROM purchase_requests WHERE id=? AND status='approved')"
  ).bind(orderId, purchase.id));
  try {
    await env.DB.batch(common);
  } catch (error) {
    console.error("mercadopago_fulfillment_failed", orderId, String(error?.message || error));
    return ctx.json({ error: "A confirmação foi recebida, mas a liberação precisa ser reprocessada." }, 503);
  }
  return ctx.json({ received: true, processed: true });
}

export async function handleMercadoPagoRoute(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/api/store/checkout" && request.method === "POST") return await createCheckout(request, env, ctx);
  if (url.pathname === "/api/webhook/mp" && request.method === "POST") return await handleWebhook(request, env, ctx);
  return null;
}
