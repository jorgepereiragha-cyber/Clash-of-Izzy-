import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("purchase requests require a valid player session and a stable idempotency key", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('/api/store/purchase-request'));
  assert.ok(worker.includes("gameIdentity(request,env)"));
  assert.ok(worker.includes('SELECT id,kingdom_name FROM kingdoms WHERE player_id=?").bind(player.id)'));
  assert.ok(worker.includes("purchase-request-player"));
  assert.ok(worker.includes("requestKey"));
  assert.ok(worker.includes("SELECT id,status,product_name,price_brl FROM purchase_requests"));
  assert.ok(worker.includes("payment_method,payment_reference,request_key"));
  assert.ok(worker.includes('["mercadopago_link","manual_whatsapp"].includes(requestedPaymentMethod)'));
  assert.ok(worker.includes('requestedPaymentMethod==="mercadopago_link"?"mercadopago_link":"manual"'));
});

test("Master approval queue is protected by admin session and grants packages only once", async () => {
  const worker = await read("worker.js");
  const admin = await read("admin.html");
  assert.ok(worker.includes('/api/admin/purchase-requests'));
  assert.ok(worker.includes("status='pending'"));
  assert.ok(worker.includes("status='approved'"));
  assert.ok(worker.includes("reviewed_at=CURRENT_TIMESTAMP"));
  assert.ok(worker.includes('decision==="approve"&&(pending.payment_method==="mercadopago_link"||pending.mp_order_id)'));
  assert.ok(worker.includes("somente o webhook após confirmação do pagamento pode liberar este item."));
  assert.ok(worker.includes("r.mp_order_id,r.mp_payment_status"));
  assert.ok(worker.includes("UPDATE players SET gems=gems+?"));
  assert.ok(worker.includes("changes()=1 AND EXISTS(SELECT 1 FROM purchase_requests"));
  assert.ok(worker.includes("INSERT OR IGNORE INTO player_skins"));
  assert.ok(admin.includes("refreshPurchaseRequests"));
  assert.ok(admin.includes("✓ Liberar pacote"));
  assert.ok(worker.includes("r.payment_reference"));
  assert.ok(admin.includes("setInterval(()=>"));
  const adminScript=admin.split("<script>")[1]?.split("</script>")[0];
  assert.ok(adminScript, "admin inline script must exist");
  assert.doesNotThrow(()=>new Function(adminScript), "admin inline script must parse");
});

test("official store creates an auditable per-order Mercado Pago checkout", async () => {
  const arena = await read("arena.html");
  assert.ok(arena.includes("/store/purchase-request"));
  assert.ok(arena.includes("requestOfficialPurchase"));
  assert.ok(arena.includes("Pedido #"));
  assert.ok(arena.includes("paymentMethod:'mercadopago_link'"));
  assert.ok(arena.includes("mercadopago_link"));
  assert.ok(arena.includes("const orderName=data.request?.product_name||item.name;\\n  const orderPrice=") === false,
    "escaped literal line break must not corrupt the purchase handler");
  assert.ok(arena.includes("const orderName=data.request?.product_name||item.name;\n  const orderPrice="),
    "purchase handler must contain a real line break between declarations");
  assert.ok(arena.includes("API_BASE+'/store/checkout'"));
  assert.ok(arena.includes("checkout.checkoutUrl"));
  assert.ok(arena.includes("API_BASE+'/store/purchase-request'"));
  assert.ok(arena.includes("https://wa.me/"), "WhatsApp remains available for support, not automatic payment");
  assert.ok(arena.includes("Number(item.gems||0).toLocaleString('pt-BR')+' gemas após confirmação'"));
  assert.ok(arena.includes("Skin de castelo · Ataque +"));
  assert.ok(arena.includes("defense_bonus_percent"));
  assert.ok(arena.includes("grid-template-columns:minmax(0,1fr) auto"));
  assert.ok(arena.includes("Edição inicial: '+Number(data.skin_limit)+' skins de castelo disponíveis."));
  assert.doesNotMatch(arena, /paymentMethod:'manual_whatsapp'/);
  assert.doesNotMatch(arena, /<option\\b[^>]*value=["'](?:pix|bank_transfer|manual)["']/i);
  assert.ok(arena.includes('id="whatsapp"'));
});

test("purchase schema restricts products, states, payment methods and duplicate requests", async () => {
  const migration = await read("migrations/0012_mercadopago_payment_link.sql");
  assert.ok(migration.includes("CHECK (product_kind IN ('vip_package','skin'))"));
  assert.ok(migration.includes("CHECK (status IN ('pending','approved','rejected'))"));
  assert.ok(migration.includes("CHECK (payment_method IN ('mercadopago_link','pix','bank_transfer','manual'))"));
  // Legacy manual requests remain readable; new orders use the individual Mercado Pago checkout.
  assert.ok(migration.includes("UNIQUE (player_id, request_key)"));
  assert.ok(migration.includes("idx_purchase_requests_status_created"));
  assert.ok(migration.includes("idx_purchase_requests_one_pending_product"));
});


test("paid skin launch catalog exposes and accepts only the first six retained catalog entries", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("INITIAL_PAID_SKIN_LIMIT = 6"));
  assert.ok(worker.includes('skin_edition:"initial",skin_limit:INITIAL_PAID_SKIN_LIMIT'));
  assert.ok(worker.includes("WHERE id=? AND id IN (SELECT id FROM skins ORDER BY id LIMIT ?)"));
  assert.ok(worker.includes("WHERE name=? AND id IN (SELECT id FROM skins ORDER BY id LIMIT ?)"));
  assert.ok(worker.includes("Esta skin está bloqueada para uma atualização futura."));
});
