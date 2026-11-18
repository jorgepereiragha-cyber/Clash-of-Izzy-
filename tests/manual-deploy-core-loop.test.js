import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("production deployment is manual, confirmation-gated, and environment-protected", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy-cloudflare.yml"), "utf8");

  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.match(workflow, /confirm_paid_plan/);
  assert.match(workflow, /inputs\.confirm_paid_plan == true && inputs\.confirm_production == true/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /confirm_production:[\s\S]*?required: true[\s\S]*?default: false[\s\S]*?type: boolean/);
  assert.match(workflow, /if:\s*\$\{\{\s*inputs\.confirm_paid_plan == true && inputs\.confirm_production == true\s*\}\}/);
  assert.match(workflow, /environment:\s*\n\s+name:\s*production/);

  // Preserve the existing preflight, authenticated Time Travel bookmark,
  // remote migration, Worker deployment and post-deployment smoke test.
  assert.match(workflow, /npm test/);
  assert.match(workflow, /deploy --dry-run/);
  assert.match(workflow, /d1\/database\/\{database_id\}\/time_travel\/bookmark/);
  assert.match(workflow, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.match(workflow, /wrangler --config wrangler\.jsonc deploy/);
  assert.match(workflow, /scripts\/production-smoke\.js/);
});

test("pull-request production smoke probe is informational and read-only", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const smoke = await readFile(resolve(root, "scripts/production-smoke.js"), "utf8");
  assert.match(workflow, /Read-only production smoke test \(informational\)/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /WORKER_BASE_URL: https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev/);
  assert.match(workflow, /run: node scripts\/production-smoke\.js/);
  assert.match(smoke, /method: "GET"/);
  assert.doesNotMatch(smoke, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
});

test("Core Loop validation is read-only unless a separately confirmed training run is requested", async () => {
  const scriptPath = resolve(root, "scripts/validate-core-loop.sh");
  const script = await readFile(scriptPath, "utf8");

  const syntax = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || "bash -n rejected the validation script");

  assert.match(script, /\/api\/health/);
  assert.match(script, /\/api\/account\/status/);
  assert.match(script, /\/api\/game\/state/);
  assert.match(script, /\/api\/game\/action/);
  assert.match(script, /--mutate-training/);
  assert.match(script, /ALLOW_GAME_MUTATIONS/);
  assert.match(script, /Digite TREINAR/);
  assert.match(script, /type:\s*"train"/);
  assert.match(script, /unit:\s*process\.env\.TRAINING_UNIT/);
  assert.match(script, /quantity:\s*Number\(process\.env\.TRAINING_QUANTITY\)/);
  assert.doesNotMatch(script, /token_de_teste_ficticio/);
  assert.doesNotMatch(script, /\{\s*action:\s*"train",\s*unit_type:/);
});


test("README documents the manual production gate and current main cache version", async () => {
  const readme = await readFile(resolve(root, "README.md"), "utf8");
  assert.match(readme, /## Deploy manual protegido/);
  assert.match(readme, /workflow_dispatch/);
  assert.match(readme, /confirm_production/);
  assert.match(readme, /Um push para `main` executa a CI de qualidade, não o deploy de produção/);
  assert.match(readme, /cache atual do Service Worker na branch `main` auditada é v26/);
  assert.doesNotMatch(readme, /## Deploy automático/);
});
