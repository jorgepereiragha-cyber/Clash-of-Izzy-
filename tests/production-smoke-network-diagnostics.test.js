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
