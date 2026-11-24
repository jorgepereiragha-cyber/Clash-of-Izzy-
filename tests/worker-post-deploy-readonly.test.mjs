import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/worker-post-deploy-readonly.yml", import.meta.url), "utf8");

test("manual worker attestation runs independent smoke and hashes jobs", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /\n  smoke:\n/);
  assert.match(workflow, /\n  hashes:\n/);
  assert.doesNotMatch(workflow, /\n\s*needs:/);
  assert.match(workflow, /inputs\.confirm_readonly == true/g);
});

test("attestation reads production only and does not need Cloudflare credentials", () => {
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /npx wrangler|d1 migrations apply|d1 execute|CLOUDFLARE_API_TOKEN|\n\s*environment:/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node scripts\/production-smoke\.js/);
});

test("published bytes are distinct from trusted verifier code", () => {
  assert.match(workflow, /path: trusted/);
  assert.match(workflow, /path: published/);
  assert.match(workflow, /git -C trusted merge-base --is-ancestor/);
  assert.match(workflow, /import \{ verifyDeployedAssets \} from "\.\/trusted\/scripts\/verify-deployed-assets\.mjs"/);
  assert.match(workflow, /readFile\(join\("published", relativePath\)\)/);
  assert.match(workflow, /last.*effectively|ultimo efetivamente implantado/i);
});
