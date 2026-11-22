// Read-only release gate: the APK can be distributed without enabling purchases.
import { pathToFileURL } from "node:url";
const ORIGIN = "https://clash-of-izzy.jorgepereiragha.workers.dev";
export function assertFreeReleasePayments(methods) {
  if (!methods || typeof methods !== "object" || Array.isArray(methods) ||
      methods.mercadoPago !== false || methods.nubankPix !== false) {
    throw new Error("Free Android release requires both payment methods explicitly disabled.");
  }
  return { paymentsDisabled: true };
}
export async function checkFreeReleasePayments(fetchImpl = fetch) {
  const response = await fetchImpl(ORIGIN + "/api/store/payment-methods", {
    method: "GET", redirect: "error", headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response || response.status !== 200) throw new Error("Payment status endpoint unavailable.");
  const methods = await response.json().catch(() => null);
  return assertFreeReleasePayments(methods);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await checkFreeReleasePayments(); console.log("Free Android distribution: payments disabled."); }
  catch (error) { console.error(String(error.message)); process.exitCode = 1; }
}
