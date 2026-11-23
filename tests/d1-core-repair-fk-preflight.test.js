import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/repair-production-d1-core.yml", import.meta.url), "utf8");

test("D1 production core repair checks foreign keys before preparing remote migrations", () => {
  const schema = workflow.indexOf('if tables!={"players"}:');
  const check = workflow.indexOf('integrity_sql="PRAGMA foreign_key_check"');
  const reject = workflow.indexOf('if violations:');
  const stage = workflow.indexOf('output=root/".coi-essential-0037-0039"');
  const apply = workflow.indexOf("Aplicar somente migrations essenciais ate 0039 em producao");
  assert.ok(schema >= 0 && check > schema && reject > check && stage > reject && apply > stage,
    "Foreign-key integrity must block BEFORE remote migration staging/apply");
  assert.match(workflow, /integrity_reply\.get\("success"\) is not True/);
  assert.match(workflow, /not isinstance\(checks\[0\]\.get\("results"\),list\)/);
  assert.match(workflow, /Pre-existing foreign-key violations: production repair blocked/);
});

test("foreign-key guard is read-only and core-only repair preserves financial isolation", () => {
  assert.match(workflow, /integrity_sql="PRAGMA foreign_key_check"/);
  assert.match(workflow, /data=json\.dumps\(\{"sql":integrity_sql\}\)\.encode\(\)/);
  assert.doesNotMatch(workflow, /(?:INSERT|UPDATE|DELETE|REPLACE)\s+(?:OR\s+\w+\s+)?(?:INTO\s+)?d1_migrations/i);
  assert.match(workflow, /0037_daily_login_rewards\.sql/);
  assert.match(workflow, /0038_onboarding_bonus\.sql/);
  assert.match(workflow, /0039_support_orders\.sql/);
  assert.match(workflow, /migrations_dir"\]="\.coi-essential-0037-0039"/);
  assert.match(workflow, /time_travel\/bookmark/);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
});
