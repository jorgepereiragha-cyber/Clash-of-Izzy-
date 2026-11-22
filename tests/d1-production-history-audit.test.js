import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const audit = await readFile(new URL("../.github/workflows/d1-production-history-audit.yml", import.meta.url), "utf8");

test("production migration audit is a read-only GitHub workflow", () => {
  assert.match(audit, /workflow_dispatch:/);
  assert.match(audit, /branches: \[main\]/);
  assert.match(audit, /permissions:\s*\n\s*contents: read/);
  assert.match(audit, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(audit, /if sql not in allowed_sql or not sql\.startswith\("SELECT "\):/);
  assert.match(audit, /"writesPerformed": 0/);
  assert.doesNotMatch(audit, /d1 migrations apply|wrangler[^\n]* deploy|time-travel restore|\bDELETE FROM\b|\bDROP TABLE\b/);
});

test("production migration audit fails closed on any historical gap or divergence", () => {
  assert.match(audit, /SELECT name FROM d1_migrations ORDER BY id/);
  assert.match(audit, /names == expected\[:len\(names\)\]/);
  assert.match(audit, /if not prefix_valid:/);
  assert.match(audit, /Migration history divergent/);
  assert.match(audit, /firstHistoryDivergence/);
  assert.match(audit, /for index, observed in enumerate\(names\)/);
  assert.match(audit, /unexpectedAppliedFilenames/);
  for (const name of [
    "0036_4x_read_indexes.sql",
    "0037_daily_login_rewards.sql",
    "0038_onboarding_bonus.sql",
    "0039_support_orders.sql",
  ]) assert.ok(audit.includes(name), name);
  assert.match(audit, /set\(missing_tables\) == required_tables/);
  assert.match(audit, /eligibleForCoreRepairReview/);
});
