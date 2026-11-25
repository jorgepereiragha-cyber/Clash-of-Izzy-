import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createPasswordRecord,
  derivePasswordHash,
  maskAccountEmail,
  validateAccountUsername,
  verifyPasswordRecord
} from "../player-accounts.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("player accounts validate usernames without accepting ambiguous or unsafe input", () => {
  assert.deepEqual(validateAccountUsername("Izzy.Commander_7"), {
    display: "Izzy.Commander_7",
    key: "izzy.commander_7"
  });
  for (const invalid of ["ab", "contains spaces", "with/slash", "with@symbol", ""]) {
    assert.equal(validateAccountUsername(invalid), null);
  }
});

test("account email is masked before it is returned to the browser", () => {
  assert.equal(maskAccountEmail("comandante.privado@example.com"), "c***@example.com");
  assert.equal(maskAccountEmail("a@example.com"), "a***@example.com");
  for (const invalid of [null, undefined, "", "not-an-email", "@example.com", "name@@example.com", "name@"]) {
    assert.equal(maskAccountEmail(invalid), null);
  }
});

test("password records use independent random salts and PBKDF2-SHA256", async () => {
  const first = await createPasswordRecord("MinhaSenhaForte2026!", 100000);
  const second = await createPasswordRecord("MinhaSenhaForte2026!", 100000);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(first.iterations, 100000);
  const firstRecord = { password_salt: first.salt, password_hash: first.hash, password_iterations: first.iterations };
  assert.equal(await verifyPasswordRecord("MinhaSenhaForte2026!", firstRecord), true);
  assert.equal(await verifyPasswordRecord("OutraSenhaMuitoForte!", firstRecord), false);
});

test("password derivation rejects weak or oversized passwords", async () => {
  await assert.rejects(() => derivePasswordHash("curta", new Uint8Array(16)), /12 e 128/);
  await assert.rejects(() => derivePasswordHash("x".repeat(129), new Uint8Array(16)), /12 e 128/);
});

test("account routes bind credentials to existing public player identity and version sessions", async () => {
  const { readFile } = await import("node:fs/promises");
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0024_player_accounts_mercadopago_orders.sql", import.meta.url), "utf8");
  assert.match(worker, /handlePlayerAccountRoute/);
  const accountRoutes = await readFile(new URL("../player-accounts.js", import.meta.url), "utf8");
  assert.match(accountRoutes, /emailMasked: maskAccountEmail\(account\.email\)/);
  assert.match(accountRoutes, /emailMasked: maskAccountEmail\(email\.display\)/);
  assert.doesNotMatch(accountRoutes, /email:\s*(?:account\.email|email\.display)/);
  assert.match(worker, /COALESCE\(a\.session_version,g\.session_version\) AS version/);
  assert.match(worker, /const version=await sessionVersionForPlayer\(env,String\(p\.sub\)\)/);
  assert.match(worker, /return row\?\.version \?\? undefined;/);
  assert.match(worker, /p\.av!==Number\(version\)/);
  assert.match(migration, /player_id INTEGER NOT NULL UNIQUE REFERENCES players\(id\)/);
  assert.match(migration, /password_salt TEXT NOT NULL/);
  assert.match(migration, /password_iterations INTEGER NOT NULL/);
});

test("account logout distinguishes local sign-out from confirmed remote token revocation", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../account.html", import.meta.url), "utf8");
  assert.ok(html.includes("let remoteRevoked=false;"));
  assert.ok(html.includes('await api("/account/logout",{method:"POST"});remoteRevoked=true;'));
  assert.ok(html.includes('const locallyCleared=clearAccountToken();linkedAccount=false;'));
  assert.ok(html.includes('try{localStorage.removeItem("coi_game_token");}catch{cleared=false;}'));
  assert.ok(html.includes('try{sessionStorage.removeItem("coi_game_token");}catch{cleared=false;}'));
  assert.ok(html.includes('const logoutMessage=remoteRevoked'),
    "never show the confirmed-revocation success message after a server failure");
  assert.ok(html.includes("não foi possível confirmar a revogação no servidor"));
});


test("account storage errors cannot create anonymous realms without persistent storage", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../account.html", import.meta.url), "utf8");
  assert.ok(html.includes("let token=readAccountToken();"));
  assert.ok(html.includes("function canPersistAccountSession()"));
  assert.ok(html.includes('if(!canPersistAccountSession())throw new Error('));
  assert.ok(html.includes('try{localStorage.setItem("coi_game_token",token);persisted=true;}catch{}'));
  assert.ok(html.includes('try{sessionStorage.setItem("coi_game_token",token);persisted=true;}catch{}'));
  assert.ok(html.includes('if(!persisted)throw new Error('));
});

test("password registration carries forward Google session version and issues the returned version", async () => {
  const { handlePlayerAccountRoute } = await import("../player-accounts.js");
  for (const oldVersion of [0, 1, 5]) {
    let insertedSql;
    let insertedBindings;
    const env = {
      SESSION_SECRET: "synthetic-test-secret",
      DB: { prepare(sql) { return { bind(...args) { return {
        async first() {
          if (sql.startsWith("SELECT id,player_id FROM players")) return { id: 7, player_id: "izzy_test" };
          if (sql.startsWith("SELECT id FROM player_accounts")) return null;
          if (sql.startsWith("INSERT INTO player_accounts")) {
            insertedSql = sql; insertedBindings = args;
            return { session_version: oldVersion + 1 };
          }
          throw new Error("Unexpected SQL: " + sql);
        }
      }; } }; } }
    };
    const response = await handlePlayerAccountRoute(new Request("https://test.example/api/account/register", {method:"POST"}), env, {
      gameIdentity: async () => "izzy_test",
      readBody: async () => ({ username:"tester", password:"syntheticPassword123!", email:"" }),
      rateLimitDecision: async () => null,
      json: (data, status = 200) => Response.json(data, {status})
    });
    assert.equal(response.status, 201);
    assert.match(insertedSql, /COALESCE\(\(SELECT session_version FROM google_account_links WHERE player_id=\?\),0\)\+1/);
    assert.match(insertedSql, /RETURNING session_version/);
    assert.equal(insertedBindings.at(-1), 7);
    const {token} = await response.json();
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    assert.equal(payload.av, oldVersion + 1);
  }
});
