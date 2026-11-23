// Worker-only publication is NON-COMMERCIAL. The D1 repair and Worker deploy
// never authorize turning on receipts just because payment secrets already exist.
// This is a read-only public state gate, not proof that all financial routes are safe.
import { pathToFileURL } from "node:url";

export const ORIGIN = "https://clash-of-izzy.jorgepereiragha.workers.dev";
export const PATH = "/api/store/payment-methods";

export function assertNoLivePaymentMethods(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.mercadoPago !== false || value.nubankPix !== false) {
    throw new Error("Worker-only release blocked: public Mercado Pago and Nubank Pix flags must explicitly be false.");
  }
  return { workerOnlyPaymentsDisabled: true, methodsChecked: 2 };
}

export async function assertWorkerOnlyPaymentState(fetchImpl = fetch) {
  const response = await fetchImpl(ORIGIN + PATH, {
    method: "GET", redirect: "error",
    headers: {Accept: "application/json", "Cache-Control": "no-cache"},
    signal: AbortSignal.timeout(12000)
  });
  if (!response || response.status !== 200)
    throw new Error("Worker-only release blocked: payment-method status unavailable.");
  const value = await response.json().catch(() => null);
  return assertNoLivePaymentMethods(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertWorkerOnlyPaymentState().then(() => {
    console.log("Worker-only public payment state: disabled. This GET is NOT a full checkout security audit.");
  }).catch(error => {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  });
}
