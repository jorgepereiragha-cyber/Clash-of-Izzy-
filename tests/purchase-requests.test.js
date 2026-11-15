import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("purchase requests require an authenticated player and a stable idempotency key", async () => {
  const worker = await read("worker.js");
  assert.match(worker, /\/api\/store\/purchase-request/);
  assert.match(worker, /gameIdentity\(request,env\)/);
  assert.match(worker, /requestKey/);
  assert.match(worker, /purchase-request-player/);
});

test("Master approval queue is protected by admin session and grants packages once", async () => {
  const worker = await read("worker.js");
  const admin = await read("admin.html");
  assert.match(worker, /\/api\/admin\/purchase-requests/);
  assert.match(worker, /status='pending'/);
  assert.match(worker, /status='approved'/);
  assert.match(worker, /reviewed_at=CURRENT_TIMESTAMP/);
  assert.match(worker, /UPDATE players SET gems=gems\+\?/);
  assert.match(worker, /changes\(\)=1 AND EXISTS\(SELECT 1 FROM purchase_requests/);
  assert.match(worker, /INSERT OR IGNORE INTO player_skins/);
  assert.match(admin, /refreshPurchaseRequests/);
  assert.match(admin, /Confirmar pagamento e liberar/);
  assert.match(admin, /setInterval\(\(\)=>/);
});

test("official store submits a request instead of opening an untracked WhatsApp purchase", async () => {
  const arena = await read("arena.html");
  assert.match(arena, /\/store\/purchase-request/);
  assert.match(arena, /requestOfficialPurchase/);
  assert.match(arena, /Pedido enviado/);
  assert.match(arena, /id="whatsapp"/);
});

test("purchase request schema restricts states and prevents duplicate player request keys", async () => {
  const migration = await read("migrations/0014_purchase_requests.sql");
  assert.match(migration, /CHECK \(product_kind IN \('vip_package','skin'\)\)/);
  assert.match(migration, /CHECK \(status IN \('pending','approved','rejected'\)\)/);
  assert.match(migration, /UNIQUE\(player_id, request_key\)/);
  assert.match(migration, /idx_purchase_requests_status_created/);
  assert.match(migration, /idx_purchase_requests_one_pending_product/);
  const worker = await read("worker.js");
  assert.match(worker, /Você já possui esta skin/);
});
