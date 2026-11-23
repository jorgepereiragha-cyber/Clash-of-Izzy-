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
