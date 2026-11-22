// Read-only release gate: the APK is free; paid checkout must stay disabled.
import { pathToFileURL } from "node:url";
export const ORIGIN = "https://clash-of-izzy.jorgepereiragha.workers.dev";
export function assertFreeDistribution(methods) {
  if (!methods || typeof methods !== "object" || Array.isArray(methods) ||
      methods.mercadoPago !== false || methods.nubankPix !== false) {
    throw new Error("Publicacao gratuita bloqueada: pagamentos nao estao explicitamente desabilitados.");
  }
  return { freeDistribution: true, paymentsEnabled: false };
}
export async function checkFreeDistribution(fetchImpl = fetch) {
  const response = await fetchImpl(ORIGIN + "/api/store/payment-methods", {
    method: "GET", redirect: "error", headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response || response.status !== 200) throw new Error("Estado de pagamentos nao verificavel.");
  const methods = await response.json().catch(() => null);
  return assertFreeDistribution(methods);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await checkFreeDistribution(); console.log("Distribuicao gratuita permitida; pagamentos desabilitados."); }
  catch (error) { console.error(String(error.message || error)); process.exitCode = 1; }
}
