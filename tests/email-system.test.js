import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("email migration adds verified contacts, preferences, templates, queue and history without changing player identity", async () => {
  const migration = await read("migrations/0017_verified_transactional_email.sql");
  assert.ok(migration.includes("REFERENCES players(id) ON DELETE CASCADE"));
  assert.ok(migration.includes("email_verified_at INTEGER"));
  assert.ok(migration.includes("verification_token_hash TEXT"));
  assert.ok(migration.includes("marketing_opt_in"));
  assert.ok(migration.includes("event_alerts_opt_in"));
  assert.ok(migration.includes("attack_alerts_opt_in"));
  assert.ok(migration.includes("idempotency_key TEXT NOT NULL UNIQUE"));
  assert.ok(migration.includes("idx_email_queue_due"));
  assert.ok(migration.includes("purchase_confirmation"));
  assert.ok(!migration.includes("ALTER TABLE players"));
  assert.ok(!migration.includes("DROP TABLE players"));
});

test("email verification stores only a token hash, expires it and uses a rate-limited authenticated player route", async () => {
  const email = await read("email-system.js");
  const worker = await read("worker.js");
  assert.ok(email.includes("crypto.subtle.digest"));
  assert.ok(email.includes("verification_token_hash"));
  assert.ok(email.includes("now + 1800"));
  assert.ok(email.includes("verification_token_hash=NULL"));
  assert.ok(worker.includes("/api/game/email/verification"));
  assert.ok(worker.includes("email-verification-player"));
  assert.ok(worker.includes("/api/email/verify"));
});

test("email preference API requires a verified address and explicit booleans", async () => {
  const email = await read("email-system.js");
  const worker = await read("worker.js");
  assert.ok(email.includes("if (!row?.email_verified_at)"));
  assert.ok(email.includes("typeof preferences?.[key] !== \"boolean\""));
  assert.ok(email.includes("marketing_opt_in"));
  assert.ok(email.includes("event_alerts_opt_in"));
  assert.ok(email.includes("attack_alerts_opt_in"));
  assert.ok(worker.includes("/api/game/email/preferences"));
  assert.ok(worker.includes("/api/game/email/history"));
});

test("email queue checks contact preferences at enqueue and send time, escapes HTML variables and retries idempotently", async () => {
  const email = await read("email-system.js");
  assert.ok(email.includes("escapeHtml(raw)"));
  assert.ok(email.includes("email_verified_at"));
  assert.ok(email.includes("preference_disabled"));
  assert.ok(email.includes("recipient_unverified_or_opted_out"));
  assert.ok(email.includes("c.email,c.email_verified_at"));
  assert.ok(email.includes("marketing_opt_in=CASE WHEN player_email_contacts.email<>excluded.email THEN 0"));
  assert.ok(email.includes("event_alerts_opt_in=CASE WHEN player_email_contacts.email<>excluded.email THEN 0"));
  assert.ok(email.includes("attack_alerts_opt_in=CASE WHEN player_email_contacts.email<>excluded.email THEN 0"));
  assert.ok(email.includes("Idempotency-Key"));
  assert.ok(email.includes("MAX_ATTEMPTS = 3"));
  assert.ok(email.includes("RETRY_SECONDS = 15 * 60"));
  assert.ok(email.includes("locked_at"));
  assert.ok(email.includes("provider_message_id"));
});

test("Worker runs the queue on its existing schedule and queues a receipt after approved purchase", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("await processEmailQueue(env,10)"));
  assert.ok(worker.includes("queueEmailForInternalPlayer"));
  assert.ok(worker.includes('idempotencyKey:"purchase:"+id'));
  assert.ok(worker.includes('"email_templates","player_email_contacts","email_queue","email_history"'));
});

test("email provider failures are logged without exposing response bodies or leaking into API errors", async () => {
  const email = await read("email-system.js");
  assert.ok(email.includes('throw new Error("resend_http_" + response.status)'));
  assert.ok(!email.includes("await response.text()"));
  assert.ok(email.includes("console.error(\"email_delivery_failed\""));
  assert.ok(email.includes("Cache-Control"));
});
