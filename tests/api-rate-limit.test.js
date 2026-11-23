import test from "node:test";
import assert from "node:assert/strict";
import { consumeRateLimit } from "../api-rate-limit.js";
import { readFile } from "node:fs/promises";

function fakeDb(row) {
  const calls = [];
  return { calls, prepare(sql) { return { bind(...values) { return { async first() { calls.push({ sql, values }); return row; } }; } }; } };
}

test("rate limiter uses an atomic upsert and stores only a keyed digest", async () => {
  const db = fakeDb({ request_count: 3, window_started_at: 900 });
  const result = await consumeRateLimit({ db, secret: "test-secret", scope: "admin-login-ip", identity: "203.0.113.8", limit: 5, windowSeconds: 900, nowSeconds: 1200 });
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 2);
  assert.equal(result.retryAfterSeconds, 600);
  assert.equal(result.resetAt, 1800);
  assert.equal(db.calls.length, 1);
  assert.ok(db.calls[0].sql.includes("ON CONFLICT(rate_key) DO UPDATE"));
  assert.ok(db.calls[0].sql.includes("ON CONFLICT(rate_key) DO UPDATE"));
  assert.equal(db.calls[0].values[1], 900);
  assert.equal(db.calls[0].values[2], 2700);
  assert.match(db.calls[0].values[0], /^[a-f0-9]{64}$/);
  assert.ok(!db.calls[0].values.includes("203.0.113.8"));
});

test("rate limiter blocks requests after the configured limit", async () => {
  const db = fakeDb({ request_count: 6, window_started_at: 900 });
  const result = await consumeRateLimit({ db, secret: "test-secret", scope: "admin-login-account", identity: "admin@example.invalid", limit: 5, windowSeconds: 900, nowSeconds: 1200 });
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterSeconds, 600);
  assert.ok(!db.calls[0].values.includes("admin@example.invalid"));
});

test("rate limiter rejects missing storage or signing secret", async () => {
  await assert.rejects(() => consumeRateLimit({ db: null, secret: "secret", scope: "x", identity: "y", limit: 1, windowSeconds: 60 }), /requires D1 and SESSION_SECRET/);
  await assert.rejects(() => consumeRateLimit({ db: fakeDb({ request_count: 1 }), secret: "", scope: "x", identity: "y", limit: 1, windowSeconds: 60 }), /requires D1 and SESSION_SECRET/);
});

test("a delayed request cannot roll the stored window backwards", async () => {
  const calls = [];
  const db = { prepare(sql) { return { bind(...values) { return { async first() { calls.push({ sql, values }); if (sql.includes("INSERT INTO api_rate_limits")) return null; return { request_count: 2, window_started_at: 1800 }; } }; } }; } };
  const result = await consumeRateLimit({ db, secret: "test-secret", scope: "admin-login-ip", identity: "203.0.113.8", limit: 10, windowSeconds: 900, nowSeconds: 1799 });
  assert.equal(result.allowed, false);
  assert.equal(result.resetAt, 2700);
  assert.equal(result.retryAfterSeconds, 901);
  assert.ok(calls[0].sql.includes("window_started_at<=excluded.window_started_at"));
  assert.equal(calls.length, 2);
});

test("Worker rate-limits authentication and game endpoints without wildcard CORS", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const arena = await readFile(new URL("../arena.html", import.meta.url), "utf8");
  for (const scope of ["store-catalog-ip", "game-start-ip", "game-state-player", "game-action-player", "game-action-network", "admin-login-ip", "admin-login-account"]) assert.ok(worker.includes(scope), "missing rate-limit scope: " + scope);
  assert.ok(worker.includes('"Access-Control-Allow-Origin":"https://clash-of-izzy-portal.jorgepereiragha.workers.dev"'));
  assert.ok(worker.includes('"game-resume-player",existingPlayerId,120,3600'),"authenticated resumes have their own player quota");
  assert.ok(worker.includes('code:"GAME_SESSION_INVALID"'),"invalid Bearer must not create guest kingdom");
  assert.ok(worker.includes('code:"GAME_REALM_MISSING"'),"valid Bearer without existing kingdom must fail closed");
  assert.ok(worker.includes("if(!row)return null;"),"signed token of deleted player never authenticates");
  assert.ok(worker.includes("if(version===null)return null;"));
  const resumeIdx=worker.indexOf('const existingPlayerId=authorization?await gameIdentity(request,env):null;');
  const guestLimitIdx=worker.indexOf('rateLimitDecision(env,"game-start-ip",ip,20,3600)',resumeIdx);
  const playerLimitIdx=worker.indexOf('rateLimitDecision(env,"game-resume-player",existingPlayerId,120,3600)',resumeIdx);
  assert.ok(resumeIdx>=0 && playerLimitIdx>resumeIdx && guestLimitIdx>playerLimitIdx,
    "guest IP rate limit must run after verified kingdom resume path");
  assert.ok(!worker.includes('"Access-Control-Allow-Origin":"*"'));
  assert.doesNotMatch(worker, /Access-Control-Allow-Headers/);
  assert.ok(arena.includes("const API_BASE='/api'"));
});
