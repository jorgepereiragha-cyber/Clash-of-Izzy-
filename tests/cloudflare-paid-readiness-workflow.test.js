import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Cloudflare Paid readiness can only be manually dispatched and checks a selected branch", async () => {
  const workflow = await read(".github/workflows/cloudflare-paid-readiness.yml");
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /target_branch:[\s\S]*?type: string/);
  assert.ok(workflow.includes("ref: ${{ inputs.target_branch }}"));
  assert.match(workflow, /owner_confirmed_paid_plan == true/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/m);
});

test("Cloudflare Paid readiness performs no production mutation", async () => {
  const workflow = await read(".github/workflows/cloudflare-paid-readiness.yml");
  assert.ok(workflow.includes("deploy --dry-run"));
  assert.ok(workflow.includes("d1 info clash-of-izzy-db"));
  assert.ok(workflow.includes("d1 info PREVIEW_DB"));
  assert.ok(workflow.includes("d1 migrations list"));
  assert.ok(workflow.includes("d1 time-travel info"));
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /wrangler[^\n]* deploy(?! --dry-run)/);
  assert.doesNotMatch(workflow, /d1 (?:create|delete|execute|export)\b/);
});
