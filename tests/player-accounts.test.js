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

test("email masking preserves the domain without exposing the local part", () => {
  assert.equal(maskAccountEmail("jose.silva.privado@example.com"), "j***@example.com");
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
  const accountRoutes = await readFile(new URL("../player-accounts.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0024_player_accounts_mercadopago_orders.sql", import.meta.url), "utf8");
  assert.match(worker, /handlePlayerAccountRoute/);
  assert.match(accountRoutes, /emailMasked: maskAccountEmail\(account\.email\)/);
  assert.match(accountRoutes, /emailMasked: maskAccountEmail\(email\.display\)/);
  assert.doesNotMatch(accountRoutes, /email:\s*(?:account\.email|email\.display)/);
  assert.match(worker, /account\.session_version/);
  assert.match(worker, /Number\(p\.av\)!==Number\(account\.session_version\)/);
  assert.match(migration, /player_id INTEGER NOT NULL UNIQUE REFERENCES players\(id\)/);
  assert.match(migration, /password_salt TEXT NOT NULL/);
  assert.match(migration, /password_iterations INTEGER NOT NULL/);
});
