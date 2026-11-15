import test from "node:test";
import assert from "node:assert/strict";
import { consumeRateLimit } from "../api-rate-limit.js";

function fakeDb(row) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({ sql, values });
              return row;
            }
          };
        }
      };
    }
  };
}

test("rate limiter uses an atomic upsert and returns the remaining quota", async () => {
  const db = fakeDb({ request_count: 3, window_started_at: 900 });
  const result = await consumeRateLimit({
    db, secret: "test-secret", scope: "admin-login-ip",
    identity: "203.0.113.8", limit: 5, windowSeconds: 900, nowSeconds: 1200
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 2);
  assert.equal(result.retryAfterSeconds, 600);
  assert.equal(result.resetAt, 1800);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /ON CONFLICT\(rate_key\) DO UPDATE/);
  assert.match(db.calls[0].sql, /RETURNING request_count,window_started_at/);
  assert.equal(db.calls[0].values[1], 900);
  assert.equal(db.calls[0].values[2], 2700);
  assert.match(db.calls[0].values[0], /^[a-f0-9]{64}$/);
  assert.ok(!db.calls[0].values.includes("203.0.113.8"));
});

test("rate limiter blocks requests after the configured limit", async () => {
  const db = fakeDb({ request_count: 6, window_started_at: 900 });
  const result = await consumeRateLimit({
    db, secret: "test-secret", scope: "admin-login-account",
    identity: "admin@example.invalid", limit: 5,
    windowSeconds: 900, nowSeconds: 1200
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterSeconds, 600);
  assert.ok(!db.calls[0].values.includes("admin@example.invalid"));
});

test("rate limiter creates a new fixed window at the next UTC boundary", async () => {
  const db = fakeDb({ request_count: 1, window_started_at: 1800 });
  await consumeRateLimit({
    db, secret: "test-secret", scope: "game-start-ip",
    identity: "203.0.113.10", limit: 5,
    windowSeconds: 900, nowSeconds: 1801
  });
  assert.equal(db.calls[0].values[1], 1800);
  assert.equal(db.calls[0].values[2], 3600);
});

test("rate limiter rejects missing storage or signing secret", async () => {
  await assert.rejects(
    () => consumeRateLimit({ db: null, secret: "secret", scope: "x", identity: "y", limit: 1, windowSeconds: 60 }),
    /requires D1 and SESSION_SECRET/
  );
  await assert.rejects(
    () => consumeRateLimit({ db: fakeDb({ request_count: 1 }), secret: "", scope: "x", identity: "y", limit: 1, windowSeconds: 60 }),
    /requires D1 and SESSION_SECRET/
  );
});


test("game API does not expose wildcard CORS to unrelated origins", async () => {
  const { readFile } = await import("node:fs/promises");
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const arena = await readFile(new URL("../arena.html", import.meta.url), "utf8");
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Headers/);
  assert.match(arena, /const API_BASE=['"]\/api['"]/);
});


test("a delayed request cannot roll the stored window backwards", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({ sql, values });
              if (sql.includes("INSERT INTO api_rate_limits")) return null;
              return { request_count: 2, window_started_at: 1800 };
            }
          };
        }
      };
    }
  };
  const result = await consumeRateLimit({
    db, secret: "test-secret", scope: "admin-login-ip",
    identity: "203.0.113.8", limit: 10,
    windowSeconds: 900, nowSeconds: 1799
  });
  assert.equal(result.allowed, false);
  assert.equal(result.resetAt, 2700);
  assert.equal(result.retryAfterSeconds, 901);
  assert.match(calls[0].sql, /window_started_at<=excluded\.window_started_at/);
  assert.equal(calls.length, 2);
});
