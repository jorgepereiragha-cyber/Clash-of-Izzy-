// Read-only diagnostic only: payment-method booleans do NOT prove checkout or grant routes are disabled.
// This script must never replace the official commercial release gates without an audited free-distribution mode.
import { pathToFileURL } from "node:url";
export const ORIGIN = "https://clash-of-izzy.jorgepereiragha.workers.dev";
export function assertFreeDistribution(methods) {
  if (!methods || typeof methods !== "object" || Array.isArray(methods) ||
      methods.mercadoPago !== false || methods.nubankPix !== false) {
    throw new Error("Free-mode diagnostic inconclusive: both payment methods must explicitly be false");
  }
  return true;
}
export async function checkFreeDistribution(fetchImpl = fetch) {
  const response = await fetchImpl(ORIGIN + "/api/store/payment-methods", {
    method: "GET", redirect: "error", headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response || response.status !== 200) throw new Error("Payment status unavailable");
  const methods = await response.json();
  return assertFreeDistribution(methods);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await checkFreeDistribution(); console.log("Public payment methods returned false; DIAGNOSTIC ONLY. Checkout routes and grants NOT verified. APK publication NOT authorized."); }
  catch (error) { console.error(String(error.message)); process.exitCode = 1; }
}
