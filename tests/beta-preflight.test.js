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

test("beta config is safe both before and after isolated D1 provisioning", () => {
  const { beta, production } = baseline();
  const current = checkBetaIsolation(beta, production);
  assert.equal(current.ok, true, current.errors.join("; "));

  // Verify the unprovisioned state independently of the current branch configuration.
  const scaffold = structuredClone(beta);
  scaffold.d1_databases[0].database_id = "REPLACE_WITH_NEW_BETA_D1_UUID";
  const scaffoldCheck = checkBetaIsolation(scaffold, production);
  assert.equal(scaffoldCheck.ok, true, scaffoldCheck.errors.join("; "));
  assert.equal(scaffoldCheck.configured, false);
  const scaffoldRemote = checkBetaIsolation(scaffold, production, { requireProvisioned: true });
  assert.equal(scaffoldRemote.ok, false);
  assert.match(scaffoldRemote.errors.join(" "), /UUID exclusivo/);

  // A configured, distinct D1 must pass the strict remote gate, never bypass it.
  const remote = checkBetaIsolation(beta, production, { requireProvisioned: true });
  assert.equal(remote.ok, current.configured, remote.errors.join("; "));
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

test("CLI reports the current D1 state and enforces the remote prerequisite", () => {
  const { beta, production } = baseline();
  const check = checkBetaIsolation(beta, production);
  assert.equal(check.ok, true, check.errors.join("; "));

  const script = new URL("../beta/check-isolation.mjs", import.meta.url);
  const preview = spawnSync(process.execPath, [script.pathname], { encoding: "utf8" });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, check.configured ? /BETA CONFIG OK/ : /BETA ESQUELETO OK/);

  const remote = spawnSync(process.execPath, [script.pathname, "--require-provisioned"], { encoding: "utf8" });
  assert.equal(remote.status, check.configured ? 0 : 1);
  if (check.configured) {
    assert.match(remote.stdout, /BETA CONFIG OK/);
  } else {
    assert.match(remote.stderr, /BETA BLOQUEADO/);
  }
});


test("unreviewed beta Cloudflare routes and cross-environment bindings fail closed", () => {
  const changes = [
    b => { b.route = "clash-of-izzy.example.com/*"; },
    b => { b.routes = [{ pattern: "game.example.com/*", zone_name: "example.com" }]; },
    b => { b.custom_domains = ["game.example.com"]; },
    b => { b.services = [{ binding: "PRODUCTION", service: "clash-of-izzy" }]; },
    b => { b.kv_namespaces = [{ binding: "SHARED", id: "existing" }]; },
    b => { b.r2_buckets = [{ binding: "FILES", bucket_name: "production" }]; },
    b => { b.unsafe = { bindings: [{ name: "PRODUCTION", type: "plain_text", text: "oops" }] }; },
    b => { b.durable_objects.bindings[0].script_name = "clash-of-izzy"; },
    b => { b.d1_databases[0].preview_database_id = "6674c0ac-3636-4e57-bff8-23cf60ab9637"; }
  ];
  for (const modify of changes) {
    const { beta, production } = configured();
    modify(beta);
    const result = checkBetaIsolation(beta, production, { requireProvisioned: true });
    assert.equal(result.ok, false, JSON.stringify(beta));
    assert.ok(result.errors.length > 0);
  }
});
