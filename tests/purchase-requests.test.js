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
  assert.ok(worker.includes("payment_method,payment_reference,request_key"));
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
  assert.ok(admin.includes("Confirmar pagamento e liberar"));
  assert.ok(admin.includes("payment_reference"));
  assert.ok(admin.includes("setInterval(()=>"));
});

test("official store submits an auditable payment request instead of opening WhatsApp", async () => {
  const arena = await read("arena.html");
  assert.ok(arena.includes("/store/purchase-request"));
  assert.ok(arena.includes("requestOfficialPurchase"));
  assert.ok(arena.includes("Pedido #"));
  assert.ok(arena.includes('id="purchaseMethod"'));
  assert.ok(arena.includes('id="purchaseReference"'));
  assert.ok(arena.includes("https://link.mercadopago.com.br/pagamentosskin"));
  assert.ok(arena.includes("mercadopago_link"));
  assert.ok(arena.includes('id="whatsapp"'));
});

test("purchase schema restricts products, states, payment methods and duplicate requests", async () => {
  const migration = await read("migrations/0012_mercadopago_payment_link.sql");
  assert.ok(migration.includes("CHECK (product_kind IN ('vip_package','skin'))"));
  assert.ok(migration.includes("CHECK (status IN ('pending','approved','rejected'))"));
  assert.ok(migration.includes("CHECK (payment_method IN ('mercadopago_link','pix','bank_transfer','manual'))"));
  assert.ok(migration.includes("UNIQUE (player_id, request_key)"));
  assert.ok(migration.includes("idx_purchase_requests_status_created"));
  assert.ok(migration.includes("idx_purchase_requests_one_pending_product"));
});
