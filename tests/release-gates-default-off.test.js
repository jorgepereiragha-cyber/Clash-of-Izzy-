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
  assert.ok(workflow.includes("inputs.confirm_paid_plan == true"));
  assert.ok(workflow.includes("inputs.confirm_production == true"));
  assert.ok(workflow.includes("refs/heads/main"));
  assert.ok(workflow.includes("name: production"));
});
