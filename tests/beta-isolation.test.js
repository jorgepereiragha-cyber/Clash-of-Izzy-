import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { betaAccessGuard, betaPaymentDisabled, normalizeInviteCode } from "../beta-access.js";

globalThis.crypto ??= webcrypto;
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const validCode = "IZZY-" + "A".repeat(20);
const validHash = createHash("sha256").update(validCode).digest("hex");

function mockBetaDb(maxUses = 1) {
  const state = { attempts: 0, uses: 0, sessions: new Set(), errors: false };
  return {
    state,
    prepare(sql) {
      if (state.errors) throw new Error("D1 offline");
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith("INSERT INTO beta_redeem_attempts")) return { hits: ++state.attempts };
              if (sql.startsWith("UPDATE beta_invites")) {
                if (args[0] !== validHash || state.uses >= maxUses) return null;
                state.uses += 1;
                return { id: 123 };
              }
              if (sql.startsWith("SELECT 1 AS permitted FROM beta_access_sessions")) {
                return state.sessions.has(args[0]) ? { permitted: 1 } : null;
              }
              throw new Error("Unexpected SQL: " + sql);
            },
            async run() {
              if (!sql.startsWith("INSERT INTO beta_access_sessions")) throw new Error("Unexpected SQL: " + sql);
              state.sessions.add(args[0]);
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}
const request = (path, init = {}) => new Request("https://clash-of-izzy-beta.jorgepereiragha.workers.dev" + path, init);
const betaEnv = db => ({ ENVIRONMENT: "beta", INVITE_ONLY: "true", BETA_LIVE_PAYMENTS_APPROVED: "false", DB: db });

test("the beta config never binds either existing D1 and intercepts all asset requests", () => {
  const excludes = new Set(read(".assetsignore").split("\n").map(v => v.trim()));
  for (const item of ["beta-access.js", "wrangler.beta.jsonc", "beta/**"]) {
    assert.ok(excludes.has(item), "private beta code/config leaked into assets: " + item);
  }
  assert.ok(!excludes.has("beta-access.html"), "the invitation page must remain available");
  const betaConfig = JSON.parse(read("wrangler.beta.jsonc"));
  const prodConfig = JSON.parse(read("wrangler.jsonc"));
  assert.equal(betaConfig.name, "clash-of-izzy-beta");
  assert.equal(betaConfig.assets.run_worker_first, true);
  assert.equal(betaConfig.vars.ENVIRONMENT, "beta");
  assert.equal(betaConfig.vars.INVITE_ONLY, "true");
  assert.equal(betaConfig.vars.BETA_LIVE_PAYMENTS_APPROVED, "false");
  assert.notEqual(betaConfig.d1_databases[0].database_id, prodConfig.d1_databases[0].database_id);
  assert.notEqual(betaConfig.d1_databases[0].database_id, prodConfig.previews.d1_databases[0].database_id);
  assert.match(betaConfig.d1_databases[0].database_id, /^REPLACE_WITH_/);
  assert.equal(betaConfig.triggers, undefined);
  assert.match(read("worker.js"), /const betaGateResponse=await betaAccessGuard\(request,env\);/);
});

test("production behavior stays unchanged and beta fails closed on missing prerequisites", async () => {
  assert.equal(await betaAccessGuard(request("/kingdom.html"), { ENVIRONMENT: "production" }), null);
  const noDb = await betaAccessGuard(request("/kingdom.html"), { ENVIRONMENT: "beta", INVITE_ONLY: "true" });
  assert.equal(noDb.status, 503);
  const disabled = await betaAccessGuard(request("/kingdom.html"), { ENVIRONMENT: "beta", INVITE_ONLY: "false", DB: mockBetaDb() });
  assert.equal(disabled.status, 503);
});

test("unauthenticated players cannot read game API or static assets", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const api = await betaAccessGuard(request("/api/game/state"), env);
  assert.equal(api.status, 403);
  assert.equal((await api.json()).code, "BETA_INVITE_REQUIRED");
  const asset = await betaAccessGuard(request("/kingdom.html"), env);
  assert.equal(asset.status, 302);
  assert.equal(asset.headers.get("Location"), "https://clash-of-izzy-beta.jorgepereiragha.workers.dev/beta-access.html");
  assert.equal(await betaAccessGuard(request("/beta-access.html"), env), null);
  assert.equal(await betaAccessGuard(request("/api/health"), env), null);
});

test("invites are hashed, limited by uses and issue secure host-only session cookies", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const redeem = () => betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://clash-of-izzy-beta.jorgepereiragha.workers.dev" },
    body: JSON.stringify({ code: validCode })
  }), env);
  const first = await redeem();
  assert.equal(first.status, 200);
  assert.equal(db.state.uses, 1);
  const cookie = first.headers.get("Set-Cookie");
  assert.match(cookie, /^__Host-izzy_beta=[a-f0-9]{64}; Path=\/; Max-Age=604800; Secure; HttpOnly; SameSite=Strict$/);
  const authenticated = await betaAccessGuard(request("/api/game/state", {
    headers: { Cookie: cookie.split(";")[0] }
  }), env);
  assert.equal(authenticated, null);
  assert.equal((await redeem()).status, 403);
  assert.equal(db.state.uses, 1);
  assert.equal(db.state.sessions.size, 1);
});

test("attempts are bounded and D1 failures never open the beta", async () => {
  const db = mockBetaDb(100), env = betaEnv(db);
  for (let i = 0; i < 6; i++) {
    const result = await betaAccessGuard(request("/api/beta/invite/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"code":"bad"}'
    }), env);
    assert.equal(result.status, 403);
  }
  const throttled = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"code":"bad"}'
  }), env);
  assert.equal(throttled.status, 429);
  db.state.errors = true;
  assert.equal((await betaAccessGuard(request("/kingdom.html", { headers: {Cookie:"__Host-izzy_beta="+"f".repeat(64)} }), env)).status, 503);
});

test("beta payments fail closed even when provider secrets exist", async () => {
  const db = mockBetaDb();
  const env = { ...betaEnv(db), MP_ACCESS_TOKEN: "live_not_used", MP_WEBHOOK_SECRET: "present" };
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: validCode })
  }), env);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const methods = await betaAccessGuard(request("/api/store/payment-methods", { headers: {Cookie: cookie} }), env);
  assert.deepEqual(await methods.json(), { mercadoPago: false, nubankPix: false });
  for (const path of ["/api/store/checkout", "/api/store/purchase-request", "/api/store/pix-instructions", "/api/support/checkout", "/api/webhook/mp", "/api/admin/purchase-requests/review", "/api/store/future-endpoint"]) {
    const denied = await betaAccessGuard(request(path, { method: "POST", headers: {Cookie: cookie} }), env);
    assert.equal(denied.status, 503, path);
    assert.equal((await denied.json()).code, "BETA_PAYMENTS_DISABLED");
  }
  assert.equal(betaPaymentDisabled("/api/store/catalog", "GET", env), false);
});

test("the Android beta uses a different application ID, origin and signing credentials", () => {
  const gradle = read("android-sideload/app/build.gradle");
  const activity = read("android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java");
  assert.match(gradle, /applicationIdSuffix '\.beta'/);
  assert.match(gradle, /ANDROID_BETA_KEYSTORE_PATH/);
  assert.match(gradle, /signingConfig betaSigningAvailable \? signingConfigs\.beta : null/);
  assert.match(activity, /BuildConfig\.BETA/);
  assert.match(activity, /https:\/\/clash-of-izzy-beta\.jorgepereiragha\.workers\.dev\/kingdom\.html/);
  assert.match(activity, /https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev\/kingdom\.html/);
  assert.match(activity, /Uri\.parse\(GAME_URL\)\.getHost\(\)/);
});

test("invitation code validation accepts only high entropy base32 format", () => {
  assert.equal(normalizeInviteCode(" " + validCode.toLowerCase() + " "), validCode);
  for (const bad of ["IZZY-123", "IZZY-AAAAAAAAAAAAAAAAAAA1", "IZZY-" + "0".repeat(20), "IZZY-" + "A".repeat(100)]) {
    assert.equal(normalizeInviteCode(bad), null);
  }
});
