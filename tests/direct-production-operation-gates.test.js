import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const scripts = JSON.parse(read("package.json")).scripts;

test("direct production npm aliases cannot reach Wrangler", () => {
  assert.equal(scripts.deploy, "node scripts/block-direct-production-operation.mjs deploy");
  assert.equal(scripts["db:migrate:remote"], "node scripts/block-direct-production-operation.mjs migrate");
  assert.match(scripts["db:migrate:local"], /--local/);
  assert.match(scripts["db:migrate:preview:local"], /--local/);
});

test("every direct production operation fails closed without requiring Cloudflare credentials", () => {
  for (const [operation, workflow] of [
    ["deploy", "deploy-worker-only.yml"],
    ["migrate", "repair-production-d1-core.yml"],
    ["invalid", null],
  ]) {
    const response = spawnSync(process.execPath,
      ["scripts/block-direct-production-operation.mjs", operation],
      {cwd: project, env: {PATH: process.env.PATH || ""}, encoding: "utf8", timeout: 5000});
    assert.equal(response.status, workflow ? 1 : 2);
    assert.equal(response.stdout, "");
    if (workflow) {
      assert.match(response.stderr, /\[BLOCKED\]/);
      assert.ok(response.stderr.includes(workflow));
    } else {
      assert.match(response.stderr, /Unrecognized production operation/);
    }
  }
});

test("protected D1 core repair and Worker-only workflows remain independently gated", () => {
  const repair = read(".github/workflows/repair-production-d1-core.yml");
  const worker = read(".github/workflows/deploy-worker-only.yml");
  assert.match(repair, /workflow_dispatch:/);
  assert.match(repair, /confirm_database_id/);
  assert.match(repair, /confirm_production == true/);
  assert.match(repair, /confirm_preview == true/);
  assert.match(repair, /d1-core-before-migration.json/);
  assert.match(repair, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.match(repair, /wrangler.core.generated.jsonc/);
  assert.match(worker, /workflow_dispatch:/);
  assert.match(worker, /confirm_worker_publish == true/);
  assert.match(worker, /confirm_production == true/);
  assert.match(worker, /d1 migrations apply clash-of-izzy-db --local/);
  assert.doesNotMatch(worker, /d1 migrations apply clash-of-izzy-db --remote/);
});

test("legacy main push-triggered stale Worker deploy has been retired", () => {
  const legacy = read(".github/workflows/publicar-entrada-worker-atual.yml");
  assert.match(legacy, /workflow_dispatch:/);
  assert.match(legacy, /Legado desativado/);
  assert.doesNotMatch(legacy, /\bpush:\s*\n/);
  assert.doesNotMatch(legacy, /wrangler.*deploy\b/);
  assert.doesNotMatch(legacy, /\bd1 migrations apply\b/);
  assert.doesNotMatch(legacy, /environment:\s*\n\s*name:\s*production/);
  assert.doesNotMatch(legacy, /\$\{\{\s*secrets\./);
});
