import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Preview D1 migration workflow is manual and requires two owner confirmations", async () => {
  const workflow = await read(".github/workflows/prepare-preview-d1.yml");
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.ok(workflow.includes("confirm_preview_is_disposable"));
  assert.ok(workflow.includes("confirm_apply_preview_migrations"));
  assert.ok(workflow.includes("CONFIRM_PREVIEW_IS_DISPOSABLE"));
  assert.ok(workflow.includes("CONFIRM_APPLY"));
  assert.ok(workflow.includes("6674c0ac-3636-4e57-bff8-23cf60ab9637"));
});

test("Preview D1 migration workflow cannot migrate or deploy production", async () => {
  const workflow = await read(".github/workflows/prepare-preview-d1.yml");
  assert.ok(workflow.includes("wrangler.preview-migrations.jsonc"));
  assert.ok(workflow.includes("d1 migrations apply PREVIEW_DB --remote"));
  assert.ok(workflow.includes("d1 info PREVIEW_DB --json"));
  assert.ok(workflow.includes("d1 time-travel info PREVIEW_DB --json"));
  assert.doesNotMatch(workflow, /wrangler\.jsonc d1 migrations apply clash-of-izzy-db/);
  assert.doesNotMatch(workflow, /wrangler[^\n]* deploy(?! --dry-run)/);
  assert.doesNotMatch(workflow, /d1 (?:create|delete|execute|export)\b/);
});
