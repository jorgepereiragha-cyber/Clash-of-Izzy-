import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("readiness and preview workflows install dependencies without requiring a missing lock", async () => {
  for (const path of [
    ".github/workflows/cloudflare-paid-readiness.yml",
    ".github/workflows/prepare-preview-d1.yml"
  ]) {
    const workflow = await read(path);
    assert.match(workflow, /npm install --ignore-scripts --no-audit --no-fund/);
    assert.doesNotMatch(workflow, /npm ci --ignore-scripts/);
    assert.doesNotMatch(workflow, /cache:\s*npm/);
    assert.match(workflow, /main\|release\/one-shared-realm-early-access/);
    assert.match(workflow, /Branch não autorizada/);
    assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
    assert.doesNotMatch(workflow, /^  push:/m);
  }
});
test("read-only audits do not pretend the paid subscription exists", async () => {
  const readiness = await read(".github/workflows/cloudflare-paid-readiness.yml");
  assert.match(readiness, /OWNER_CONFIRMED_PAID_PLAN/);
  assert.match(readiness, /Confirmação de cobrança pelo proprietário: PENDENTE/);
  assert.match(readiness, /Auditoria read-only permitida/);
  assert.match(readiness, /d1 migrations list/);
  assert.match(readiness, /deploy --dry-run/);
  assert.doesNotMatch(readiness, /d1 migrations apply/);
});
test("preview UUID is different from production and excluded from public assets", async () => {
  const preview = JSON.parse(await read("wrangler.preview-migrations.jsonc"));
  const prod = JSON.parse(await read("wrangler.jsonc"));
  const previewDb = preview.d1_databases.find(db => db.binding === "PREVIEW_DB");
  const prodDb = prod.d1_databases.find(db => db.binding === "DB");
  assert.ok(previewDb?.database_id);
  assert.ok(prodDb?.database_id);
  assert.notEqual(previewDb.database_id,prodDb.database_id);
  assert.equal(previewDb.database_name,"izzy-preview-17112026");
  const ignored=(await read(".assetsignore")).split(/\r?\n/);
  assert.ok(ignored.includes("wrangler.preview-migrations.jsonc"));
  assert.ok(ignored.includes("package-lock.json"));
});
test("preview migrations stay manually authorized and never reference production schema writes", async () => {
  const workflow=await read(".github/workflows/prepare-preview-d1.yml");
  assert.match(workflow, /confirm_preview_is_disposable/);
  assert.match(workflow, /confirm_apply_preview_migrations/);
  assert.match(workflow, /d1 migrations apply PREVIEW_DB --remote/);
  assert.doesNotMatch(workflow, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.match(workflow, /EXPECTED_ID=/);
  assert.match(workflow, /CONFIRM_PREVIEW_IS_DISPOSABLE/);
  assert.match(workflow, /CONFIRM_APPLY/);
});
