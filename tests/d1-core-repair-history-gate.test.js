import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/repair-production-d1-core.yml", import.meta.url), "utf8");

test("core repair rejects missing, extra or duplicated historical migrations before any remote write", () => {
  assert.match(workflow, /SELECT name FROM d1_migrations ORDER BY id/);
  assert.match(workflow, /baseline\.sort\(\)/);
  assert.match(workflow, /len\(names\)!=len\(baseline\) or set\(names\)!=set\(baseline\)/);
  assert.match(workflow, /Historical D1 migration set is not complete; no production write/);
  assert.match(workflow, /last!="0036_4x_read_indexes\.sql"/);
  const historyGate=workflow.indexOf("Historical D1 migration set is not complete;");
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
  assert.match(workflow, /int\(match\.group\(1\)\)<=36/);
  assert.match(workflow, /output=root\/"\.coi-essential-0037-0039"/);
  assert.match(workflow, /if copied!=sorted\(essential\):/);
  assert.match(workflow, /if tables!=\{"players"\}:/);
  assert.match(workflow, /time_travel\/bookmark/);
  assert.match(workflow, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.doesNotMatch(workflow, /0042_level_packs_p1_p8\.sql|0044_reconcile_level_packs\.sql/);
});
