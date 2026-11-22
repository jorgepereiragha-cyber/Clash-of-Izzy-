import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("production 4X and level-pack gates remain explicit string false until release approval", async () => {
  const config = JSON.parse(await read("wrangler.jsonc"));
  assert.equal(config.vars.ENVIRONMENT, "production");
  for (const name of [
    "GAME_4X_SYSTEMS_ENABLED",
    "LEVEL_PACKS_ENABLED",
    "LEVEL_PACKS_PUBLIC_ENABLED",
    "LEVEL_PACKS_PROPOSED_PRICES_APPROVED"
  ]) {
    assert.equal(config.vars[name], "false", name + " must be disabled as a string");
  }
  assert.equal(Object.hasOwn(config.vars, "LEVEL_PACKS_TEST_PLAYER_IDS"), false,
    "Never commit a production player allowlist as part of the default config");
});

test("production deploy stays manual and requires both dispatch confirmations", async () => {
  const workflow = await read(".github/workflows/deploy-cloudflare.yml");
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /confirm_paid_plan:[\s\S]*?type: boolean/);
  assert.match(workflow, /confirm_production:[\s\S]*?type: boolean/);
  assert.match(workflow,
    /github\.ref == 'refs\/heads\/main' && inputs\.confirm_paid_plan == true && inputs\.confirm_production == true/);
  assert.ok(workflow.includes("name: production"));
});

test("legacy CI-completion workflows cannot start production deploy", async () => {
  for (const path of [
    ".github/workflows/liberar-eldoria-prod-apos-ci.yml",
    ".github/workflows/publicar-visual-real-apos-ci.yml"
  ]) {
    const workflow = await read(path);
    assert.match(workflow, /^on:\s*\n  workflow_dispatch:/m, path);
    assert.doesNotMatch(workflow, /workflow_run:|gh workflow run deploy-cloudflare/, path);
    assert.doesNotMatch(workflow, /actions:\s*write/, path);
    assert.match(workflow, /exit 1/, path);
  }
});

test("readiness workflow does not apply remote migrations or deploy", async () => {
  const workflow = await read(".github/workflows/cloudflare-paid-readiness.yml");
  assert.match(workflow, /^on:\s*\n  workflow_dispatch:/m);
  assert.match(workflow, /d1 time-travel info clash-of-izzy-db --json/);
  assert.match(workflow, /d1 migrations list clash-of-izzy-db --remote/);
  assert.doesNotMatch(workflow, /d1 migrations apply|d1 time-travel restore|gh workflow run deploy-cloudflare/);
  assert.doesNotMatch(workflow, /wrangler[^\n]* deploy(?! --dry-run)/);
});
