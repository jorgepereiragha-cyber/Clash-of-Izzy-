import test from "node:test";
import assert from "node:assert/strict";
import { percentile, runStagingLoad, validateStagingTarget } from "../scripts/staging-load-smoke.mjs";

test("staging origin allowlist rejects production, redirects and external domains", () => {
  const allowed = [
    "https://preview.clash-of-izzy.jorgepereiragha.workers.dev/",
    "https://clash-of-izzy-preview.jorgepereiragha.workers.dev/",
    "https://staging.clashofbrazil.com/"
  ];
  for (const url of allowed) assert.equal(validateStagingTarget(url), new URL(url).origin);
  for (const url of [
    "https://clash-of-izzy.jorgepereiragha.workers.dev/",
    "https://clashofbrazil.com/",
    "https://www.clashofbrazil.com/",
    "https://preview.clash-of-izzy.jorgepereiragha.workers.dev/api/game/state",
    "https://preview.clash-of-izzy.jorgepereiragha.workers.dev/?x=1",
    "https://preview.clash-of-izzy.jorgepereiragha.workers.dev:8443/",
    "https://preview.clash-of-izzy.jorgepereiragha.workers.dev@evil.example/",
    "https://evil-preview.workers.dev/",
    "http://preview.clash-of-izzy.jorgepereiragha.workers.dev/",
    "https://preview.clash-of-izzy.jorgepereiragha.workers.dev.evil.example/"
  ]) assert.throws(() => validateStagingTarget(url), { name: "Error" });
});

test("percentiles use nearest rank, with empty values handled explicitly", () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([30, 10, 20, 50, 40], 50), 30);
  assert.equal(percentile([30, 10, 20, 50, 40], 95), 50);
});

test("bounded probe makes 1000 GETs only to staging and summarizes success", async () => {
  const observed = [];
  let inFlight = 0;
  let peak = 0;
  const mock = async (url, opts) => {
    observed.push({ url, method: opts.method, redirect: opts.redirect });
    inFlight++;
    peak = Math.max(peak, inFlight);
    await Promise.resolve();
    inFlight--;
    return new Response('{"ok":true}', { status: 200 });
  };
  const result = await runStagingLoad({
    targetUrl: "https://preview.clash-of-izzy.jorgepereiragha.workers.dev/",
    requests: 1000,
    concurrency: 25,
    fetchImpl: mock
  });
  assert.equal(observed.length, 1000);
  assert.ok(observed.every(x => x.method === "GET" && x.redirect === "manual" &&
    x.url.endsWith("/api/health")));
  assert.ok(peak <= 25 && peak > 0);
  assert.equal(result.completed, 1000);
  assert.equal(result.failures, 0);
  assert.equal(result.passed, true);
  assert.equal(result.httpStatuses["200"], 1000);
});

test("rate and latency failures cause a failed acceptance without retries or writes", async () => {
  let number = 0;
  const result = await runStagingLoad({
    targetUrl: "https://staging.clashofbrazil.com/",
    requests: 10,
    concurrency: 3,
    fetchImpl: async () => {
      number++;
      return new Response("unavailable", { status: number <= 2 ? 503 : 200 });
    }
  });
  assert.equal(number, 10);
  assert.equal(result.successRate, 0.8);
  assert.equal(result.failures, 2);
  assert.equal(result.passed, false);
  assert.equal(result.httpStatuses["503"], 2);
});

test("rejects unbounded request, concurrency and timeout settings", async () => {
  const targetUrl = "https://staging.clashofbrazil.com/";
  for (const bad of [{ requests: 1001 }, { requests: 0 }, { concurrency: 51 }, { concurrency: 0 }, { timeoutMs: 99 }]) {
    await assert.rejects(runStagingLoad({ targetUrl, ...bad, fetchImpl: async () => new Response("{}") }));
  }
});
