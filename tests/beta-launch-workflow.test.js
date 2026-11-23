import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/launch-isolated-beta.yml", import.meta.url), "utf8"
);

test("beta deployment is manual, gated and pinned to a checked isolated D1", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.confirm_beta_only == true/);
  assert.match(workflow, /inputs\.confirm_beta_migrations == true/);
  assert.match(workflow, /environment: beta-infrastructure/);
  assert.match(workflow, /git -C beta-source rev-parse HEAD/);
  assert.match(workflow, /git -C beta-source ls-remote origin refs\/heads\/beta/);
  assert.match(workflow, /Beta isolation checks \(no deploy\)/);
  assert.match(workflow, /body\.result\?\.uuid!==uuid/);
  assert.match(workflow, /body\.result\?\.name!=="clash-of-izzy-beta-db"/);
  assert.match(workflow, /wrangler\.beta\.jsonc d1 migrations apply clash-of-izzy-beta-db --remote/);
  assert.match(workflow, /wrangler\.beta\.jsonc d1 execute clash-of-izzy-beta-db --remote/);
  assert.doesNotMatch(workflow, /wrangler\.jsonc (?:deploy|d1)/);
});

test("beta Worker deploys with the session secret in one version, never as an exposed asset", () => {
  assert.match(workflow, /CLOUDFLARE_BETA_WORKER_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_BETA_SESSION_SECRET/);
  assert.match(workflow, /secret_file="\$\(mktemp --suffix=\.json "\$RUNNER_TEMP\//);
  assert.match(workflow, /umask 077/);
  assert.match(workflow, /trap 'rm -f "\$secret_file"' EXIT/);
  assert.match(workflow, /json\.dump\(\{"SESSION_SECRET": secret\}, output\)/);
  assert.match(workflow, /wrangler --config wrangler\.beta\.jsonc deploy --secrets-file "\$secret_file"/);
  assert.doesNotMatch(workflow, /wrangler --config wrangler\.beta\.jsonc secret put SESSION_SECRET/);
  assert.match(workflow, /status==="ready"/);
  assert.match(workflow, /BETA_INVITE_REQUIRED/);
});
