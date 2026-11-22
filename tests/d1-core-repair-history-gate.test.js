import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/repair-production-d1-core.yml", import.meta.url), "utf8");

test("core repair rejects a noncanonical D1 migration history before any remote write", () => {
  assert.match(workflow, /SELECT name FROM d1_migrations ORDER BY id/);
  assert.match(workflow, /canonical\.sort\(\)/);
  assert.match(workflow, /names!=canonical\[:len\(names\)\]/);
  assert.match(workflow, /Noncanonical D1 migration history; no production write allowed/);
  assert.match(workflow, /if last not in \("0035_throne_war\.sql","0036_4x_read_indexes\.sql"\)/);
  const historyGate=workflow.indexOf("Noncanonical D1 migration history;");
  const booking=workflow.indexOf("Capturar bookmark Time Travel");
  const remoteApply=workflow.indexOf("Aplicar somente migrations essenciais");
  assert.ok(historyGate>0 && booking>historyGate && remoteApply>booking);
});

test("protected D1 repair retains explicit confirmations, checkpoint and commercial isolation", () => {
  assert.match(workflow, /confirm_production:/);
  assert.match(workflow, /confirm_preview:/);
  assert.match(workflow, /confirm_database_id:/);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
  assert.match(workflow, /group: clash-of-izzy-cloudflare-production/);
  assert.match(workflow, /int\(match\.group\(1\)\)<=39/);
  assert.match(workflow, /time_travel\/bookmark/);
  assert.match(workflow, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.doesNotMatch(workflow, /0042_level_packs_p1_p8\.sql|0044_reconcile_level_packs\.sql/);
});
