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
  assert.ok(worker.includes('requestedPaymentMethod!=="manual_whatsapp"'));
  assert.ok(worker.includes('const paymentMethod="manual"'));
});

test("Master approval queue is protected by admin session and grants packages only once", async () => {
  const worker = await read("worker.js");
  const admin = await read("admin.html");
  assert.ok(worker.includes('/api/admin/purchase-requests'));
  assert.ok(worker.includes("status='pending'"));
  assert.ok(worker.includes("status='approved'"));
  assert.ok(worker.includes("reviewed_at=CURRENT_TIMESTAMP"));
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

test("official store submits an auditable payment request and opens WhatsApp", async () => {
  const arena = await read("arena.html");
  assert.ok(arena.includes("/store/purchase-request"));
  assert.ok(arena.includes("requestOfficialPurchase"));
  assert.ok(arena.includes("Pedido #"));
  assert.ok(arena.includes("manual_whatsapp"));
  assert.ok(arena.includes("const orderName=data.request?.product_name||item.name;\\n  const orderPrice=") === false,
    "escaped literal line break must not corrupt the purchase handler");
  assert.ok(arena.includes("const orderName=data.request?.product_name||item.name;\n  const orderPrice="),
    "purchase handler must contain a real line break between declarations");
  assert.doesNotMatch(arena, /mercadopago|purchaseReference|purchaseMethod/i);
  assert.ok(arena.includes("https://wa.me/"));
  assert.ok(arena.includes("Edição inicial: '+Number(data.skin_limit)+' skins de castelo disponíveis."));
  assert.ok(arena.includes("manual_whatsapp"));
  assert.doesNotMatch(arena, /<option\\b[^>]*value=["'](?:pix|bank_transfer|manual)["']/i);
  assert.ok(arena.includes('id="whatsapp"'));
});

test("purchase schema restricts products, states, payment methods and duplicate requests", async () => {
  const migration = await read("migrations/0012_mercadopago_payment_link.sql");
  assert.ok(migration.includes("CHECK (product_kind IN ('vip_package','skin'))"));
  assert.ok(migration.includes("CHECK (status IN ('pending','approved','rejected'))"));
  assert.ok(migration.includes("CHECK (payment_method IN ('mercadopago_link','pix','bank_transfer','manual'))"));
  // Legacy payment values remain readable for historical orders; new requests use the manual WhatsApp workflow.
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
