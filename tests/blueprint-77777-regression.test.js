// Regressões do protocolo 77777x: proteger arquitetura real contra snippets
// incompatíveis de fallback, catálogo, webhook, PWA e controles móveis.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("3D nunca depende da imagem de capa ausente e pode restaurar o canvas 2D", async () => {
  const [renderer, kingdom] = await Promise.all([
    read("scripts/kingdom-3d.js"), read("kingdom.html")
  ]);
  assert.doesNotMatch(renderer, /\/images\/site-cover-bg\.jpg/);
  assert.match(renderer, /renderer\.domElement\.addEventListener\("webglcontextlost"/);
  assert.match(renderer, /restore2DFallback\(\)/);
  assert.match(renderer, /coi:kingdom-2d-fallback/);
  assert.match(kingdom, /addEventListener\("coi:kingdom-2d-fallback"/);
});

test("catálogo P1-P8 não altera IDs ou usa colunas de recursos inexistentes no VIP", async () => {
  const [migration, canonical] = await Promise.all([
    read("migrations/0043_fix_vip_catalog.sql"), read("level-packs.js")
  ]);
  assert.doesNotMatch(migration, /INSERT\s+(?:OR\s+)?REPLACE/i);
  assert.doesNotMatch(migration, /\b(?:wood|food|stone|iron|gold|required_level)\s*=/i);
  assert.match(migration, /ROUND\(price_brl\*100\)/);
  assert.match(migration, /AND gems=/);
  assert.match(canonical, /priceCents/);
  assert.match(canonical, /resources:/);
});

test("webhook mantém assinatura, verificação de valor, ledger único e batch do D1", async () => {
  const [webhook, levelPacks, migration] = await Promise.all([
    read("mercadopago-orders.js"),
    read("level-packs.js"),
    read("migrations/0042_level_packs_p1_p8.sql")
  ]);
  assert.match(webhook, /validateWebhookSignature\(request, orderId/);
  assert.match(webhook, /actualCents === expectedCents/);
  assert.match(webhook, /paidCents === expectedCents/);
  assert.match(webhook, /levelPackMatchesOrder\(levelPack, purchase\)/);
  assert.match(webhook, /await env\.DB\.batch\(common\)/);
  assert.match(levelPacks, /INSERT OR IGNORE INTO level_pack_claims/);
  assert.match(levelPacks, /changes\(\)=1/);
  assert.match(migration, /UNIQUE \(kingdom_id,pack_level\)/);
});

test("PWA preserva shell essencial e isola a falha dos assets opcionais", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /cache\.addAll\(required\)/);
  assert.match(sw, /Promise\.allSettled/);
  assert.match(sw, /canStoreResponse\(response\)/);
  assert.ok(Number(sw.match(/clash-of-izzy-shell-v(\d+)/)?.[1]) >= 54, "PWA cache must include kingdom session recovery");
  assert.doesNotMatch(sw, /cache\.addAll\(CORE_ASSETS\)/);
});

test("ornamentos 3D liberam recursos próprios sem destruir GLBs compartilhados", async () => {
  const visual = await read("scripts/castle-visual-upgrades.js");
  assert.match(visual, /ownedRoots = new WeakMap\(\)/);
  assert.match(visual, /disposeCastleVisualUpgrades/);
  assert.match(visual, /geometry\.dispose\(\)/);
  assert.match(visual, /material\.dispose\(\)/);
  assert.doesNotMatch(visual, /castle\.traverse\(/);
});

test("gestos Android são tratados no canvas interativo, não bloqueados no documento inteiro", async () => {
  const [renderer, layout, android] = await Promise.all([
    read("scripts/kingdom-3d.js"),
    read("styles/city-layout.css"),
    read("styles/android-experience.css")
  ]);
  assert.match(renderer, /pointer-events:none/);
  assert.match(layout, /touch-action:none/);
  assert.match(android, /touch-action:\s*manipulation/);
  assert.doesNotMatch(android, /html\s*,\s*body\s*\{[^}]*touch-action\s*:\s*none/s);
});
