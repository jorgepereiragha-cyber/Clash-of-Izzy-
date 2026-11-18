import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("paid readiness workflow is manual, read-only and verifies Preview D1 isolation", async () => {
  const workflow = await read(".github/workflows/cloudflare-paid-readiness.yml");
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/m);
  assert.ok(workflow.includes("wrangler whoami"));
  assert.ok(workflow.includes("d1 info clash-of-izzy-db"));
  assert.ok(workflow.includes("d1 info PREVIEW_DB"));
  assert.ok(workflow.includes("d1 migrations list"));
  assert.ok(workflow.includes("d1 time-travel info"));
  assert.ok(workflow.includes("deploy --dry-run"));
  assert.doesNotMatch(workflow, /d1 migrations apply.*--remote/);
  assert.doesNotMatch(workflow, /wrangler[^\n]* deploy(?! --dry-run)/);
  assert.doesNotMatch(workflow, /d1 (?:create|delete|execute|export)\b/);
});

test("paid readiness configuration keeps D1 production and Preview UUIDs distinct", async () => {
  const config = JSON.parse(await read("wrangler.jsonc"));
  const previewMigrationConfig = JSON.parse(await read("wrangler.preview-migrations.jsonc"));
  const production = config.d1_databases.find(binding => binding.binding === "DB");
  const preview = config.previews?.d1_databases?.find(binding => binding.binding === "DB");
  const previewMigrations = previewMigrationConfig.d1_databases.find(binding => binding.binding === "PREVIEW_DB");
  assert.equal(production?.database_id, "7e63af59-d9ff-4159-a9cf-b02e35b92605");
  assert.equal(preview?.database_id, "6674c0ac-3636-4e57-bff8-23cf60ab9637");
  assert.equal(preview?.database_id, previewMigrations?.database_id);
  assert.notEqual(production?.database_id, preview?.database_id);
});

test("paid infrastructure documentation uses the current Cloudflare pricing and recovery model", async () => {
  const doc = await read("docs/PAID_INFRASTRUCTURE_ARCHITECTURE.md");
  assert.ok(doc.includes("10 milhões de requisições"));
  assert.ok(doc.includes("30 milhões de milissegundos de CPU"));
  assert.ok(doc.includes("25 bilhões"));
  assert.ok(doc.includes("400.000 GB-s"));
  assert.ok(doc.includes("Time Travel"));
  assert.ok(doc.includes("não é um teto de fatura"));
});
