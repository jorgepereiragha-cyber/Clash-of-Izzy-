import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("promotional portal deployment is strictly manual, production-protected, main-only and opt-in", async () => {
  const yml = await readFile(new URL("../.github/workflows/publicar-portal-cloudflare.yml", import.meta.url), "utf8");
  assert.match(yml, /^on:\s*\n  workflow_dispatch:\s*\n    inputs:/m);
  assert.doesNotMatch(yml, /^\s+(?:workflow_run|push|pull_request):/m);
  assert.match(yml, /confirm_portal_publish:[\s\S]*?required: true[\s\S]*?default: false[\s\S]*?type: boolean/);
  assert.match(yml, /if: \$\{\{ github\.ref == 'refs\/heads\/main' && inputs\.confirm_portal_publish == true \}\}/);
  assert.match(yml, /environment:\s*\n\s+name: production/);
  assert.match(yml, /npx wrangler --config wrangler\.portal\.jsonc deploy/);
  assert.doesNotMatch(yml, /gh workflow run deploy-cloudflare|d1 migrations apply|wrangler --config wrangler\.jsonc deploy/);
});
