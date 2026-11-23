import test from "node:test";
import assert from "node:assert/strict";
import { runProductionSmokeTests } from "../scripts/production-smoke.js";

test("production smoke reports the failing GET path and network error code", async () => {
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://example.test", fetchImpl: async () => {
      throw new TypeError("fetch failed", { cause: Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }) });
    } }),
    error => error.message.includes("GET /api/health") && error.message.includes("ECONNREFUSED")
  );
});

test("production smoke diagnostics never print query strings or credentials", async () => {
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://example.test/?token=secret", fetchImpl: async () => {
      throw new Error("fetch failed");
    } }),
    error => !error.message.includes("token=secret") && error.message.includes("/api/health")
  );
});


test("production smoke does not leak secrets embedded in network error messages", async () => {
  const secret = "private-token-DO-NOT-LOG";
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://example.test", fetchImpl: async () => {
      throw new TypeError("fetch failed " + secret + " https://example.test/?token=" + secret);
    } }),
    error => error.message.includes("GET /api/health") && !error.message.includes(secret) && error.cause === undefined
  );
});


test("read-only smoke retries a transient network error, then still rejects an HTTP 503", async () => {
  let attempts = 0;
  const warnings = [];
  const previousWarn = console.warn;
  console.warn = message => warnings.push(message);
  try {
    await assert.rejects(runProductionSmokeTests({
      baseUrl: "https://example.test",
      networkRetryDelayMs: 0,
      fetchImpl: async (_url, init) => {
        attempts++;
        assert.equal(init.method, "GET");
        if (attempts === 1) throw new TypeError("fetch failed");
        return { status: 503 };
      }
    }), /API de saúde respondeu HTTP 503/);
  } finally {
    console.warn = previousWarn;
  }
  assert.equal(attempts, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /smoke GET \/api\/health/);
});

test("smoke never retries an HTTP error status", async () => {
  let attempts = 0;
  await assert.rejects(runProductionSmokeTests({
    baseUrl: "https://example.test",
    networkRetryDelayMs: 0,
    fetchImpl: async () => {
      attempts++;
      return { status: 503 };
    }
  }), /API de saúde respondeu HTTP 503/);
  assert.equal(attempts, 1);
});

test("smoke network retries are bounded and sanitized after exhaustion", async () => {
  const secret = "private-value-hidden-4321";
  let attempts = 0;
  const warnings = [];
  const previousWarn = console.warn;
  console.warn = message => warnings.push(message);
  try {
    await assert.rejects(runProductionSmokeTests({
      baseUrl: "https://example.test/?token=" + secret,
      networkRetryDelayMs: 0,
      fetchImpl: async (_url, init) => {
        attempts++;
        assert.equal(init.method, "GET");
        throw new TypeError("fetch failed " + secret,
          { cause: Object.assign(new Error("URL contains " + secret), { code: "ECONNRESET" }) });
      }
    }), error =>
      error.message.includes("GET /api/health") &&
      error.message.includes("ECONNRESET") &&
      error.message.includes("3 tentativas") &&
      !error.message.includes(secret) && error.cause === undefined
    );
  } finally {
    console.warn = previousWarn;
  }
  assert.equal(attempts, 3);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every(message => !message.includes(secret)));
});

test("smoke rejects unbounded retry configuration before any fetch", async () => {
  let called = false;
  await assert.rejects(runProductionSmokeTests({
    baseUrl: "https://example.test",
    networkRetries: 10,
    fetchImpl: async () => { called = true; }
  }), /Limite de tentativas/);
  assert.equal(called, false);
});

test("smoke reports HTTP 302 as a redirect without following or retrying", async () => {
  let calls = 0;
  const privateToken = "secret-redirect-token";
  await assert.rejects(runProductionSmokeTests({
    baseUrl: "https://example.test/?token=" + privateToken,
    networkRetryDelayMs: 0,
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "manual");
      return { status: 302, headers: { get: () => "https://outside.test/?token=" + privateToken } };
    }
  }), error => error.message.includes("GET /api/health") &&
    error.message.includes("HTTP 302") && !error.message.includes(privateToken));
  assert.equal(calls, 1);
});

test("opaque redirects fail closed without revealing redirect destination", async () => {
  let calls = 0;
  await assert.rejects(runProductionSmokeTests({
    baseUrl: "https://example.test",
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.redirect, "manual");
      return { type: "opaqueredirect", status: 0 };
    }
  }), /Redirecionamento inesperado no smoke GET \/api\/health \(HTTP opaqueredirect\)/);
  assert.equal(calls, 1);
});
