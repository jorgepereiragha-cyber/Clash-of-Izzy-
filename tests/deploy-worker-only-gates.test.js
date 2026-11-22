import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/deploy-worker-only.yml", import.meta.url), "utf8");

test("Worker-only publication requires deliberate manual approval and a protected environment", () => {
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/^\s+push:\s*$/m);
  assert.match(workflow,/confirm_worker_publish:/);
  assert.match(workflow,/confirm_production:/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/environment:\s*\n\s*name: production/);
  assert.match(workflow,/group: clash-of-izzy-cloudflare-production/);
  assert.ok(workflow.includes("ref: ${{ github.sha }}"));
});

test("Worker-only publication refuses unsafe flags and backend health failures", () => {
  for(const flag of ["GAME_4X_SYSTEMS_ENABLED","LEVEL_PACKS_ENABLED",
    "LEVEL_PACKS_PUBLIC_ENABLED","LEVEL_PACKS_PROPOSED_PRICES_APPROVED"]){
    assert.ok(workflow.includes(flag),flag);
  }
  assert.match(workflow,/vars\[name\] !== "false"/);
  assert.match(workflow,/res\.status !== 200/);
  assert.match(workflow,/h\.checks\?\.schema!==true/);
  assert.match(workflow,/h\.missingTables\.length/);
  assert.match(workflow,/node scripts\/cloudflare-remote-audit\.mjs/);
});

test("Worker-only publication never migrates production D1 and checks live Worker afterward", () => {
  assert.match(workflow,/d1 migrations apply clash-of-izzy-db --local/);
  assert.doesNotMatch(workflow,/d1 migrations apply[^\n]*--remote/);
  assert.doesNotMatch(workflow,/d1 execute[^\n]*--remote/);
  assert.doesNotMatch(workflow,/time-travel restore/);
  assert.match(workflow,/deploy --dry-run/);
  assert.match(workflow,/run: npx wrangler --config wrangler\.jsonc deploy/);
  assert.match(workflow,/node scripts\/check-android-release-server\.mjs/);
  assert.match(workflow,/node scripts\/production-smoke\.js/);
});
