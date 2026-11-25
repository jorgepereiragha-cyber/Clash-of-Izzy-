import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CI keeps running main validations while cancelling superseded PR revisions", async () => {
  const source = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const concurrency = source.split("concurrency:")[1]?.split("\njobs:")[0];
  assert.ok(concurrency, "CI must define explicit concurrency policy");
  assert.match(concurrency, /group: clash-of-izzy-ci-\$\{\{ github\.ref \}\}/);
  assert.match(concurrency, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
    "push/main workflows must not cancel prior running validation");
  assert.doesNotMatch(concurrency, /cancel-in-progress:\s*true/);
  assert.match(source, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(source, /pull_request:/);
});

test("stacked production-candidate PRs receive the same non-deploying quality checks", async () => {
  const source = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const trigger = source.split("pull_request:")[1]?.split("\n\n")[0];
  assert.match(trigger, /release\/production-gameplay-hardened-20261125/);
  assert.match(source, /npm test/);
  assert.match(source, /npm run test:e2e/);
  assert.match(source, /npm run check/);
  assert.doesNotMatch(source, /d1 migrations apply[^\n]*--remote|actions:\s*write/);
});
