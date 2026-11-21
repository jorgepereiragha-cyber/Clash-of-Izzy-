import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const PREVIEW_MARKER = /(^|[.-])(preview|staging)([.-]|$)/;
const PROD_HOST = "clash-of-izzy.jorgepereiragha.workers.dev";

export function validateStagingTarget(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("LOAD_TARGET_URL é obrigatório.");
  }
  let target;
  try {
    target = new URL(value);
  } catch {
    throw new Error("URL de staging inválida.");
  }
  if (target.protocol !== "https:" || target.username || target.password ||
      target.port || target.search || target.hash || target.pathname !== "/") {
    throw new Error("Use somente a origem HTTPS de staging, sem credenciais, caminho ou parâmetros.");
  }
  const host = target.hostname.toLowerCase();
  if (host === PROD_HOST || host === "clashofbrazil.com" || host === "www.clashofbrazil.com") {
    throw new Error("É proibido executar o teste de carga em produção.");
  }
  const approvedWorkersPreview = host.endsWith(".workers.dev") &&
    host.includes("clash-of-izzy") && PREVIEW_MARKER.test(host);
  const approvedCustomStaging = host === "staging.clashofbrazil.com";
  if (!approvedWorkersPreview && !approvedCustomStaging) {
    throw new Error("Destino não é um staging/preview autorizado do Clash of Izzy.");
  }
  return target.origin;
}

export function percentile(values, percent) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1);
  return Math.round(sorted[index] * 100) / 100;
}

/**
 * GET-only bounded staging probe. 1,000 requests are not 1,000 authenticated players.
 * A full multiplayer acceptance needs separate real-device and websocket tests.
 */
export async function runStagingLoad({
  targetUrl,
  requests = 1000,
  concurrency = 25,
  timeoutMs = 8000,
  fetchImpl = fetch,
} = {}) {
  const origin = validateStagingTarget(targetUrl);
  if (!Number.isSafeInteger(requests) || requests < 1 || requests > 1000) {
    throw new Error("requests deve estar entre 1 e 1000.");
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 50) {
    throw new Error("concurrency deve estar entre 1 e 50.");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("timeoutMs deve estar entre 100 e 30000.");
  }

  const endpoint = new URL("/api/health", origin).href;
  const durations = [];
  const counts = {};
  const errors = {};
  let cursor = 0;
  let successes = 0;
  let failures = 0;
  let peakInFlight = 0;
  let inFlight = 0;
  const started = performance.now();

  async function worker() {
    while (cursor < requests) {
      cursor++;
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      const start = performance.now();
      try {
        const response = await fetchImpl(endpoint, {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
          headers: { "Accept": "application/json", "User-Agent": "Clash-of-Izzy-staging-probe/1.0" }
        });
        // Always consume the response body so fetch connections can be reused.
        await response.arrayBuffer();
        const status = Number(response.status);
        counts[status] = (counts[status] || 0) + 1;
        if (status === 200) successes++;
        else failures++;
      } catch (error) {
        failures++;
        const message = String(error?.name || "FetchError").slice(0, 60);
        errors[message] = (errors[message] || 0) + 1;
      } finally {
        durations.push(performance.now() - start);
        inFlight--;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(requests, concurrency) }, () => worker()));
  const elapsedSeconds = Math.max((performance.now() - started) / 1000, 0.001);
  const successRate = successes / requests;
  const p95Ms = percentile(durations, 95);
  const thresholds = { successRateMin: 0.99, p95MsMax: 1500 };
  return {
    origin, endpoint: "/api/health", mode: "GET-only", targetRequests: requests,
    concurrency, peakInFlight, completed: successes + failures,
    successes, failures, successRate,
    latencyMs: { p50: percentile(durations, 50), p95: p95Ms, p99: percentile(durations, 99) },
    throughputPerSecond: Math.round((requests / elapsedSeconds) * 100) / 100,
    httpStatuses: counts, fetchErrors: errors,
    thresholds, passed: successRate >= thresholds.successRateMin && p95Ms <= thresholds.p95MsMax,
    caveat: "GET /api/health não equivale a 1000 jogadores autenticados ou WebSockets simultâneos."
  };
}

async function main() {
  if (process.env.CONFIRM_STAGING_LOAD !== "true") {
    throw new Error("Exige CONFIRM_STAGING_LOAD=true em workflow manual de staging.");
  }
  const requests = Number(process.env.LOAD_REQUESTS || "1000");
  const concurrency = Number(process.env.LOAD_CONCURRENCY || "25");
  const result = await runStagingLoad({
    targetUrl: process.env.LOAD_TARGET_URL,
    requests,
    concurrency,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error("Staging load probe aborted:", String(error?.message || error));
    process.exitCode = 1;
  }
}
