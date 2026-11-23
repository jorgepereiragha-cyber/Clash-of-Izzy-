// Offline runtime smoke: deploys nothing and never connects to Cloudflare.
// Runs the actual Worker and beta-only D1 migrations using Wrangler's local emulator.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const testUuid = "0ef0ef0e-0000-4000-8000-000000000001"; // synthetic, local only
const testInvite = "IZZY-" + "A".repeat(20);
const concurrentInvite = "IZZY-" + "B".repeat(20);

async function command(args, deadlineMs = 120_000) {
  // Explicit local-only argument policy. A failed check aborts before any CLI is called.
  if (args.some(arg => /--remote|deploy|secret|publish|delete|create/i.test(String(arg)))) {
    throw new Error("Remote, deployment or destructive command forbidden in beta smoke");
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const capture = bytes => { output = (output + String(bytes)).slice(-25000); };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timer = setTimeout(() => child.kill("SIGKILL"), deadlineMs);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error("Local Wrangler failed (code " + code + "): " + output));
    });
  });
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function ready(base, child, output) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Local Worker exited early: " + output());
    try {
      const res = await fetch(base + "/api/health", { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (res.status === 200 && data.status === "ready") return data;
      if (res.status === 503) throw new Error("Beta local schema not ready: " + JSON.stringify(data));
    } catch (e) {
      if (String(e.message || "").includes("schema not ready")) throw e;
    }
    await delay(300);
  }
  throw new Error("Local beta Worker did not start: " + output());
}
async function http(base, endpoint, { method = "GET", body, cookie, bearer, origin, redirect = "manual" } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (bearer) headers.Authorization = "Bearer " + bearer;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + endpoint, {
    method, headers, redirect,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  return { status: response.status, headers: response.headers,
    data: await response.json().catch(() => ({})) };
}

test("actual beta Worker, D1 schema, invitation, kingdom and payment lock run locally", { timeout: 300_000 }, async () => {
  const persist = await mkdtemp(path.join(os.tmpdir(), "coi-beta-runtime-"));
  const cfgFile = path.join(root, "wrangler.beta.local-smoke.jsonc");
  let processWorker;
  let output = "";
  try {
    const original = JSON.parse(await readFile(path.join(root, "wrangler.beta.jsonc"), "utf8"));
    const production = JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8"));
    assert.equal(original.name, "clash-of-izzy-beta");
    assert.equal(original.vars.ENVIRONMENT, "beta");
    assert.equal(original.vars.INVITE_ONLY, "true");
    assert.equal(original.vars.BETA_LIVE_PAYMENTS_APPROVED, "false");
    assert.equal(original.triggers, undefined);
    assert.notEqual(testUuid, production.d1_databases[0].database_id);
    assert.notEqual(testUuid, production.previews.d1_databases[0].database_id);
    // The placeholder is replaced ONLY in this disposable local config.
    original.d1_databases[0].database_id = testUuid;
    await writeFile(cfgFile, JSON.stringify(original, null, 2));

    const config = path.basename(cfgFile);
    const common = ["--config", config, "d1"];
    await command([...common, "migrations", "apply", "clash-of-izzy-beta-db", "--local", "--persist-to", persist]);
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--file", "beta/schema.sql"]);
    const inviteHash = createHash("sha256").update(testInvite).digest("hex");
    const insert = "INSERT INTO beta_invites(code_hash,max_uses) VALUES('" + inviteHash + "',1)";
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--command", insert]);
    const concurrentHash = createHash("sha256").update(concurrentInvite).digest("hex");
    await command([...common, "execute", "clash-of-izzy-beta-db", "--local",
      "--persist-to", persist, "--command",
      "INSERT INTO beta_invites(code_hash,max_uses) VALUES('" + concurrentHash + "',1)"]);

    const port = await freePort();
    const base = "http://127.0.0.1:" + port;
    processWorker = spawn(process.execPath, [wrangler,
      "--config", config, "dev", "--local", "--persist-to", persist,
      "--ip", "127.0.0.1", "--port", String(port),
      "--var", "SESSION_SECRET:beta-runtime-local-testing-secret-not-for-release",
      "--log-level", "error"
    ], { cwd: root, env: { ...process.env, CI: "1",
      WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"] });
    const append = chunk => { output = (output + String(chunk)).slice(-30000); };
    processWorker.stdout.on("data", append);
    processWorker.stderr.on("data", append);
    const health = await ready(base, processWorker, () => output);
    assert.equal(health.checks.database, true);
    assert.equal(health.checks.session, true);
    assert.equal(health.checks.schema, true);
    assert.deepEqual(health.missingTriggers, []);
    assert.deepEqual(health.missingTables, []);

    const blocked = await http(base, "/api/game/state");
    assert.equal(blocked.status, 403, "API private before invite");
    assert.equal(blocked.data.code, "BETA_INVITE_REQUIRED");
    const blockedRealtime = await http(base, "/api/realtime/eldoria/ticket", {method:"POST",body:{}});
    assert.equal(blockedRealtime.status, 403, "realtime tickets require an invitation");
    const blockedScript = await http(base, "/scripts/kingdom-3d.js");
    assert.equal(blockedScript.status, 302, "3D scripts are private before invitation");

    const initial = await http(base, "/kingdom.html");
    assert.equal(initial.status, 302, "kingdom page requires invite");
    assert.equal(new URL(initial.headers.get("location")).pathname, "/beta-access.html");
    const login = await http(base, "/beta-access.html");
    assert.equal(login.status, 200, "invitation page is served");

    const joined = await http(base, "/api/beta/invite/redeem", {
      method: "POST", body: {code:testInvite}, origin:base
    });
    assert.equal(joined.status, 200, "invitation grants beta cookie: " + JSON.stringify(joined.data));
    const cookie = joined.headers.get("set-cookie")?.split(";")[0];
    assert.match(cookie || "", /^__Host-izzy_beta=[a-f0-9]{64}$/);
    const reused = await http(base, "/api/beta/invite/redeem", {
      method: "POST", body:{code:testInvite}, origin:base
    });
    assert.equal(reused.status, 403, "single-use invitation cannot be redeemed twice");

    // Hit the real Worker simultaneously, not just the isolated SQL fixture.
    const concurrentAttempts = await Promise.all([
      http(base, "/api/beta/invite/redeem", {method:"POST",body:{code:concurrentInvite},origin:base}),
      http(base, "/api/beta/invite/redeem", {method:"POST",body:{code:concurrentInvite},origin:base})
    ]);
    assert.deepEqual(concurrentAttempts.map(attempt => attempt.status).sort((a,b)=>a-b), [200,403],
      "an atomic invite claims only one session under concurrent redemption");
    const claimedCookie = concurrentAttempts.find(attempt=>attempt.status===200)?.headers.get("set-cookie")?.split(";")[0];
    assert.match(claimedCookie || "", /^__Host-izzy_beta=[a-f0-9]{64}$/);
    const claimedStatus = await http(base, "/api/beta/access/status", {cookie:claimedCookie});
    assert.equal(claimedStatus.status, 200, "winning session remains usable");

    const privatePage = await http(base, "/kingdom.html", {cookie});
    assert.equal(privatePage.status, 200, "authorized player can open kingdom");
    const capabilities = await http(base, "/api/beta/capabilities", {cookie});
    assert.equal(capabilities.status, 200);
    assert.equal(capabilities.data.enabled.advanced4x, true);
    assert.equal(capabilities.data.realMoneyPayments, false);

    const start = await http(base, "/api/game/start", { method:"POST", body:{}, cookie });
    assert.equal(start.status, 201, "game start: " + JSON.stringify(start.data).slice(0,1800));
    assert.ok(start.data.token, "a new kingdom issues a game token");
    assert.ok(start.data.state?.kingdom?.id, "new kingdom persisted");
    const state = await http(base, "/api/game/state", { cookie, bearer:start.data.token });
    assert.equal(state.status, 200, "state responds after game start");
    assert.equal(state.data.state?.kingdom?.id, start.data.state.kingdom.id);
    assert.equal(state.data.state?.advanced4xEnabled, true);

    const badIndustry = await http(base, "/api/game/action", {
      method:"POST", body:{type:"industry_upgrade",industry:"not-a-real-industry"},
      cookie, bearer:start.data.token
    });
    assert.equal(badIndustry.status, 400, "real 4X industry handler validates input");
    const badDefense = await http(base, "/api/game/action", {
      method:"POST", body:{type:"city_defense_place",defense:"tower",gridX:999,gridZ:999},
      cookie, bearer:start.data.token
    });
    assert.equal(badDefense.status, 400, "real 4X defense handler validates map bounds");

    const resume = await http(base, "/api/game/start", {
      method:"POST", body:{}, cookie, bearer:start.data.token
    });
    assert.equal(resume.status, 200, "existing kingdom is resumed");
    assert.equal(resume.data.state?.kingdom?.id, start.data.state.kingdom.id);

    const methods = await http(base, "/api/store/payment-methods", {cookie});
    assert.equal(methods.status, 200);
    assert.deepEqual(methods.data, {mercadoPago:false,nubankPix:false});
    const checkout = await http(base, "/api/store/checkout", {method:"POST",body:{},cookie});
    assert.equal(checkout.status, 503);
    assert.equal(checkout.data.code, "BETA_PAYMENTS_DISABLED");
    const world = await http(base, "/world.html", {cookie});
    assert.equal(world.status, 200, "world map from legacy game is available");
    const market = await http(base, "/market.html", {cookie});
    assert.equal(market.status, 200, "free resource market is available");

    const logout = await http(base, "/api/beta/access/logout",
      {method:"POST",cookie,origin:base});
    assert.equal(logout.status, 200);
    const after = await http(base, "/api/game/state", {cookie,bearer:start.data.token});
    assert.equal(after.status, 403, "logged-out beta cookie blocks former game token");
    console.log("Offline beta runtime passed: health, invites, 4X, kingdom, world, free market, payment lock, logout.");
  } finally {
    if (processWorker) {
      processWorker.kill("SIGTERM");
      await Promise.race([new Promise(resolve => processWorker.once("close", resolve)),
        delay(3000)]).catch(() => {});
      if (processWorker.exitCode === null) processWorker.kill("SIGKILL");
    }
    await rm(cfgFile, { force:true });
    await rm(persist, { recursive:true, force:true });
  }
});
