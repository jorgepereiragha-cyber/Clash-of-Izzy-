import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { checkBetaIsolation } from "../beta/check-isolation.mjs";

const fromRoot = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const baseline = () => ({ beta: fromRoot("wrangler.beta.jsonc"), production: fromRoot("wrangler.jsonc") });
const uuid = "26447c0d-7aa2-4e2b-91d5-1d32f7693321";
const configured = () => {
  const snapshot = baseline();
  snapshot.beta.d1_databases[0].database_id = uuid;
  return snapshot;
};

test("beta config is safe as a scaffold, but the remote migration/deploy gate is closed", () => {
  const { beta, production } = baseline();
  const check = checkBetaIsolation(beta, production);
  assert.equal(check.ok, true, check.errors.join("; "));
  assert.equal(check.configured, false);
  const remote = checkBetaIsolation(beta, production, { requireProvisioned: true });
  assert.equal(remote.ok, false);
  assert.match(remote.errors.join(" "), /UUID exclusivo/);
});

test("a fresh, distinct beta D1 UUID passes preflight without mutating existing environments", () => {
  const { beta, production } = configured();
  const before = JSON.stringify(production);
  const result = checkBetaIsolation(beta, production, { requireProvisioned: true });
  assert.deepEqual(result, { ok: true, configured: true, errors: [] });
  assert.equal(JSON.stringify(production), before);
});

test("production, preview and malformed database UUIDs fail closed", () => {
  const { beta, production } = configured();
  for (const invalid of [
    production.d1_databases[0].database_id,
    production.previews.d1_databases[0].database_id,
    "not-a-uuid"
  ]) {
    beta.d1_databases[0].database_id = invalid;
    assert.equal(checkBetaIsolation(beta, production, { requireProvisioned: true }).ok, false);
  }
});

test("cannot bypass invite gate, real-money kill switches or worker-first asset filter", () => {
  const cases = [
    b => { b.vars.INVITE_ONLY = "false"; },
    b => { b.vars.ENVIRONMENT = "production"; },
    b => { b.vars.BETA_LIVE_PAYMENTS_APPROVED = "true"; },
    b => { b.vars.LEVEL_PACKS_ENABLED = "true"; },
    b => { b.vars.MASTER_PACK_ENABLED = "true"; },
    b => { b.assets.run_worker_first = false; },
    b => { b.assets.html_handling = "auto-trailing-slash"; },
    b => { b.d1_databases[0].database_name = "clash-of-izzy-db"; },
    b => { b.triggers = { crons: ["* * * * *"] }; },
    b => { b.vars.MP_ACCESS_TOKEN = "should-not-appear-in-wrangler"; },
    b => { b.durable_objects.bindings[0].name = "PRODUCTION_ROOM"; }
  ];
  for (const change of cases) {
    const { beta, production } = configured();
    change(beta);
    const check = checkBetaIsolation(beta, production, { requireProvisioned: true });
    assert.equal(check.ok, false, JSON.stringify(beta.vars));
    assert.ok(check.errors.length > 0);
  }
});

test("CLI communicates safe placeholder status but refuses remote prerequisite until UUID exists", () => {
  const script = new URL("../beta/check-isolation.mjs", import.meta.url);
  const preview = spawnSync(process.execPath, [script.pathname], { encoding: "utf8" });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /ESQUELETO OK/);
  const blocked = spawnSync(process.execPath, [script.pathname, "--require-provisioned"], { encoding: "utf8" });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /BETA BLOQUEADO/);
});
