import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertFreeReleasePayments, checkFreeReleasePayments } from "../scripts/check-free-android-payments.mjs";

test("free distribution fails closed unless both methods explicitly false", () => {
  assert.deepEqual(assertFreeReleasePayments({ mercadoPago: false, nubankPix: false }), { paymentsDisabled: true });
  for (const state of [null, {}, { mercadoPago: true, nubankPix: false }, { mercadoPago: false, nubankPix: true }, { mercadoPago: 0, nubankPix: false }]) {
    assert.throws(() => assertFreeReleasePayments(state));
  }
});
test("read-only request and fail closed on HTTP and malformed JSON", async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({url, options});
    return {status: 200, json: async () => ({mercadoPago:false,nubankPix:false})};
  };
  await checkFreeReleasePayments(fetcher);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, "GET");
  assert.match(requests[0].url, /\/api\/store\/payment-methods$/);
  await assert.rejects(checkFreeReleasePayments(async () => ({status:503})));
  await assert.rejects(checkFreeReleasePayments(async () => ({status:200,json:async () => {throw Error("bad json");}})));
});
test("official release workflow checks disabled payments twice", () => {
  const workflow = readFileSync(new URL("../.github/workflows/publicar-apk-android.yml", import.meta.url), "utf8");
  assert.equal(workflow.split("node scripts/check-free-android-payments.mjs").length - 1, 2);
  assert.equal(workflow.includes("node scripts/check-commercial-store.mjs"), false);
});
