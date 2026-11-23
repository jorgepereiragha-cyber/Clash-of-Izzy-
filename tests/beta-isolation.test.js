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
  const state = { attempts: 0, uses: 0, sessions: new Set(), disabledInvites: false, errors: false, sessionInsertFailure: false, claimTriggerInstalled: true };
  return {
    state,
    prepare(sql) {
      if (state.errors) throw new Error("D1 offline");
      return {
        async first() {
          if (sql.includes("name='beta_claim_invite_for_session'")) {
            return state.claimTriggerInstalled ? { installed: 1 } : null;
          }
          throw new Error("Unexpected unbound SQL: " + sql);
        },
        bind(...args) {
          return {
            async first() {
              if (sql.includes("name='beta_claim_invite_for_session'")) {
                return state.claimTriggerInstalled ? { installed: 1 } : null;
              }
              if (sql.startsWith("INSERT INTO beta_redeem_attempts")) return { hits: ++state.attempts };
              if (sql.startsWith("SELECT 1 AS permitted FROM beta_access_sessions")) {
                return state.sessions.has(args[0]) && !state.disabledInvites ? { permitted: 1 } : null;
              }
              throw new Error("Unexpected SQL: " + sql);
            },
            async run() {
              if (sql.startsWith("INSERT INTO beta_access_sessions")) {
                if (state.sessionInsertFailure) throw new Error("D1 INSERT failed");
                if (args[2] !== validHash || state.disabledInvites || state.uses >= maxUses) {
                  return { meta: { changes: 0 } };
                }
                state.uses += 1; // Mirrors the beta-only SQLite trigger.
                state.sessions.add(args[0]);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE beta_access_sessions SET revoked_at")) {
                const deleted = state.sessions.delete(args[0]);
                return { meta: { changes: deleted ? 1 : 0 } };
              }
              throw new Error("Unexpected SQL: " + sql);
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
  for (const item of ["beta-access.js", "portal-worker.js", "wrangler.beta.jsonc", "beta/**"]) {
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
  assert.equal(betaConfig.vars.GAME_4X_SYSTEMS_ENABLED, "true");
  assert.equal(prodConfig.vars.GAME_4X_SYSTEMS_ENABLED, "false");
  assert.notEqual(betaConfig.d1_databases[0].database_id, prodConfig.d1_databases[0].database_id);
  assert.notEqual(betaConfig.d1_databases[0].database_id, prodConfig.previews.d1_databases[0].database_id);
  assert.match(betaConfig.d1_databases[0].database_id, /^REPLACE_WITH_/);
  assert.equal(betaConfig.triggers, undefined);
  assert.match(read("worker.js"), /const betaGateResponse=await betaAccessGuard\(request,env\);/);
  assert.match(read("worker.js"), /if\(env\.ENVIRONMENT==="beta"&&advanced4xEnabled\(env\)\)requiredTables\.push\("intermediate_resources","city_defenses","kingdom_progression","progression_xp_ledger"\)/);
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

test("missing atomic invite trigger blocks redemption and prevents unmetered sessions", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  db.state.claimTriggerInstalled = false;
  const response = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: validCode })
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "BETA_SCHEMA_INCOMPLETE");
  assert.equal(db.state.sessions.size, 0);
  assert.equal(db.state.uses, 0);
  const health = read("worker.js");
  assert.match(health, /missingTriggers=env\.ENVIRONMENT==="beta"/);
  assert.match(health, /name='beta_claim_invite_for_session'/);
  assert.match(health, /checks\.schema=missingTables\.length===0&&missingTriggers\.length===0/);
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

test("failed session insert does not consume an invitation", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const redeem = () => betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: validCode })
  }), env);
  db.state.sessionInsertFailure = true;
  assert.equal((await redeem()).status, 503);
  assert.equal(db.state.uses, 0);
  assert.equal(db.state.sessions.size, 0);
  db.state.sessionInsertFailure = false;
  assert.equal((await redeem()).status, 200);
  assert.equal(db.state.uses, 1);
  assert.equal(db.state.sessions.size, 1);
  assert.equal((await redeem()).status, 403);
});

test("beta-only schema enforces atomic invite use in the session insert", () => {
  const schema = read("beta/schema.sql");
  assert.match(schema, /CREATE TRIGGER IF NOT EXISTS beta_claim_invite_for_session/);
  assert.match(schema, /BEFORE INSERT ON beta_access_sessions/);
  assert.match(schema, /UPDATE beta_invites SET uses=uses\+1/);
  assert.match(schema, /RAISE\(ABORT, 'BETA_INVITE_UNAVAILABLE'\)/);
  const gate = read("beta-access.js");
  assert.match(gate, /INSERT INTO beta_access_sessions\(session_hash,invite_id,expires_at\)/);
  assert.doesNotMatch(gate, /UPDATE beta_invites SET uses=uses\+1/);
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
  // An accidental flag flip cannot turn on real-money checkout or webhooks.
  env.BETA_LIVE_PAYMENTS_APPROVED = "true";
  assert.equal(betaPaymentDisabled("/api/store/checkout", "POST", env), true);
  assert.equal(betaPaymentDisabled("/api/webhook/mp", "POST", env), true);
  const blocked = await betaAccessGuard(request("/api/store/checkout", {
    method: "POST", headers: { Cookie: cookie }
  }), env);
  assert.equal(blocked.status, 503);
  const methodsStillOff = await betaAccessGuard(request("/api/store/payment-methods", {
    headers: { Cookie: cookie }
  }), env);
  assert.deepEqual(await methodsStillOff.json(), { mercadoPago: false, nubankPix: false });
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

test("beta PWA never installs the production offline cache or exposes protected pages", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const unauthenticated = await betaAccessGuard(request("/sw.js"), env);
  assert.equal(unauthenticated.status, 302);
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: validCode })
  }), env);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const sw = await betaAccessGuard(request("/sw.js", { headers: { Cookie: cookie } }), env);
  assert.equal(sw.status, 200);
  assert.match(sw.headers.get("Content-Type"), /text\/javascript/);
  assert.match(sw.headers.get("Cache-Control"), /no-store/);
  const code = await sw.text();
  assert.match(code, /caches\.delete/);
  assert.doesNotMatch(code, /addEventListener\(['"]fetch/);
  assert.doesNotMatch(code, /caches\.open/);
  const worker = read("worker.js");
  assert.match(worker, /headers\.set\("Cache-Control","private, no-store"\)/);
});

test("beta session logout revokes server-side token and clears the cookie", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: validCode })
  }), env);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const before = await betaAccessGuard(request("/api/beta/access/status", { headers: { Cookie: cookie } }), env);
  assert.equal(before.status, 200);
  assert.deepEqual(await before.json(), { authorized: true });
  const denied = await betaAccessGuard(request("/api/beta/access/logout", {
    method: "POST", headers: { Cookie: cookie, Origin: "https://unauthorized.example" }
  }), env);
  assert.equal(denied.status, 403);
  assert.equal(db.state.sessions.size, 1);
  const logout = await betaAccessGuard(request("/api/beta/access/logout", {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://clash-of-izzy-beta.jorgepereiragha.workers.dev" }
  }), env);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("Set-Cookie"), /^__Host-izzy_beta=; Path=\/; Max-Age=0; Secure; HttpOnly; SameSite=Strict$/);
  assert.equal(db.state.sessions.size, 0);
  const noAccess = await betaAccessGuard(request("/api/game/state", { headers: { Cookie: cookie } }), env);
  assert.equal(noAccess.status, 403);
  const status = await betaAccessGuard(request("/api/beta/access/status", { headers: { Cookie: cookie } }), env);
  assert.equal(status.status, 401);
  assert.deepEqual(await status.json(), { authorized: false });
});

test("beta retires public marketing routes without deleting production code", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const legacy = await betaAccessGuard(request("/api/beta/signup", {method: "POST"}), env);
  assert.equal(legacy.status, 404);
  assert.equal((await legacy.json()).code, "BETA_LEGACY_SIGNUP_DISABLED");
  const initialPortal = await betaAccessGuard(request("/portal.html"), env);
  assert.equal(initialPortal.status, 302);
  assert.equal(new URL(initialPortal.headers.get("Location")).pathname, "/beta-access.html");
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({code: validCode})
  }), env);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const signedPortal = await betaAccessGuard(request("/", {headers: {Cookie: cookie}}), env);
  assert.equal(signedPortal.status, 302);
  assert.equal(new URL(signedPortal.headers.get("Location")).pathname, "/kingdom.html");
  assert.equal(await betaAccessGuard(request("/api/beta/signup"), {ENVIRONMENT:"production"}), null);
});

test("disabling an invite revokes already issued beta access without touching players", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: validCode })
  }), env);
  assert.equal(unlocked.status, 200);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const privateRequest = () => betaAccessGuard(request("/api/game/state", { headers: { Cookie: cookie } }), env);
  assert.equal(await privateRequest(), null);
  db.state.disabledInvites = true; // Models beta_invites.disabled=1.
  const denied = await privateRequest();
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "BETA_INVITE_REQUIRED");
  const session = await betaAccessGuard(request("/api/beta/access/status", { headers: { Cookie: cookie } }), env);
  assert.equal(session.status, 401);
  assert.equal(db.state.sessions.size, 1, "revocation is derived from invite status, not a destructive DB cleanup");
});

test("marketing and support pages never load inside the private beta, even after invitation", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  for (const path of ["/public-portal/portal.html", "/public-portal/apoie.html", "/public-portal/assets/brand/royal-king.webp", "/apoie", "/apoie.html"]) {
    const denied = await betaAccessGuard(request(path), env);
    assert.equal(denied.status, 404, path);
    assert.equal((await denied.json()).code, "BETA_MARKETING_DISABLED");
  }
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: validCode })
  }), env);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const signed = await betaAccessGuard(request("/public-portal/apoie.html", { headers: { Cookie: cookie } }), env);
  assert.equal(signed.status, 404);
  assert.equal((await signed.json()).code, "BETA_MARKETING_DISABLED");
  assert.equal(await betaAccessGuard(request("/public-portal/apoie.html"), { ENVIRONMENT: "production" }), null);
});

test("beta uses old free gameplay pages, but never exposes legacy admin, PWA or paid routes", async () => {
  const db = mockBetaDb(), env = { ...betaEnv(db), GAME_4X_SYSTEMS_ENABLED: "true" };
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: validCode })
  }), env);
  assert.equal(unlocked.status, 200);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  const authorized = (path, init = {}) => betaAccessGuard(request(path, {
    ...init, headers: { ...(init.headers || {}), Cookie: cookie }
  }), env);

  // Preserve playable free-market trades, battle and world modules from the original game.
  for (const path of ["/kingdom.html", "/market.html", "/world.html",
    "/equipment-ui.html", "/alliance.html", "/events.html", "/api/game/state"]) {
    assert.equal(await authorized(path), null, path);
  }
  const capabilities = await authorized("/api/beta/capabilities");
  assert.equal(capabilities.status, 200);
  assert.deepEqual(await capabilities.json(), {
    environment: "beta", inviteOnly: true,
    enabled: {
      realm: true, battles: true, alliances: true, heroes: true,
      dragons: true, pets: true, world: true, freeResourceMarket: true,
      advanced4x: true
    },
    realMoneyPayments: false, administration: false, backgroundCron: false
  });
  assert.equal((await betaAccessGuard(request("/api/beta/capabilities"), env)).status, 403);

  const catalog = await authorized("/api/store/catalog");
  assert.equal(catalog.status, 200);
  assert.deepEqual(await catalog.json(),
    { skins: [], packages: [], skin_edition: "beta", skin_limit: 0, whatsapp: "" });
  for (const path of ["/admin.html", "/admin", "/api/admin/login", "/api/admin/gems"]) {
    const denied = await authorized(path, { method: path.startsWith("/api/") ? "POST" : "GET" });
    assert.equal(denied.status, 404, path);
    assert.equal((await denied.json()).code, "BETA_ADMIN_DISABLED");
  }
  for (const path of ["/manifest.json", "/offline.html"]) {
    assert.equal((await authorized(path)).status, 404);
  }
  for (const path of ["/api/store/future-paid-route", "/api/store"]) {
    const denied = await authorized(path);
    assert.equal(denied.status, 503, path);
    assert.equal((await denied.json()).code, "BETA_PAYMENTS_DISABLED");
  }
  // The commercial review endpoint retains the same explicit financial error code.
  assert.equal((await authorized("/api/admin/purchase-requests/review", { method: "POST" })).status, 503);
  // A production Worker never gains beta-specific rules.
  assert.equal(await betaAccessGuard(request("/api/admin/login"), { ENVIRONMENT: "production" }), null);
});

test("beta landing routes and asset pack do not include old marketing, admin or PWA", async () => {
  const db = mockBetaDb(), env = betaEnv(db);
  const anonymous = await betaAccessGuard(request("/index.html"), env);
  assert.equal(anonymous.status, 302);
  assert.equal(new URL(anonymous.headers.get("Location")).pathname, "/beta-access.html");
  const unlocked = await betaAccessGuard(request("/api/beta/invite/redeem", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: validCode })
  }), env);
  const cookie = unlocked.headers.get("Set-Cookie").split(";")[0];
  for (const path of ["/index.html", "/index", "/portal"]) {
    const redirect = await betaAccessGuard(request(path, { headers: { Cookie: cookie } }), env);
    assert.equal(redirect.status, 302);
    assert.equal(new URL(redirect.headers.get("Location")).pathname, "/kingdom.html");
  }
  const ignored = new Set(read(".assetsignore").split("\n").map(line => line.trim()));
  for (const file of ["index.html", "portal.html", "apoie.html", "admin.html",
    "offline.html", "manifest.json", "public-portal/**"]) {
    assert.ok(ignored.has(file), file + " must be absent from the beta static bundle");
  }
  const entry = read("beta-access.html");
  for (const file of ["/kingdom.html", "/world.html", "/market.html",
    "/equipment-ui.html", "/alliance.html", "/events.html"]) {
    assert.ok(entry.includes('href="' + file + '"'), file + " must be linked for invited testers");
  }
});
