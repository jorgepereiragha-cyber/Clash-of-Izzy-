import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import portalWorker from "../portal-worker.js";

const url = pathname => "https://portal.example" + pathname;
const get = (pathname, method = "GET") => new Request(url(pathname), { method });
function envWithLink(link) {
  const served = [];
  return {
    ...(link === undefined ? {} : { SUPPORT_PAYMENT_URL: link }),
    served,
    ASSETS: {
      async fetch(request) {
        served.push(new URL(request.url).pathname);
        return new Response("allowed static file", { status: 200 });
      }
    }
  };
}

test("support campaign is served only as public static marketing assets", async () => {
  const env = envWithLink();
  for (const path of ["/support", "/support.html"]) {
    const response = await portalWorker.fetch(get(path), env);
    assert.equal(response.status, 200, path);
  }
  assert.deepEqual(env.served, ["/support", "/support.html"]);
  for (const path of ["/api/support", "/donations/create", "/transactions", "/players/me"]) {
    const response = await portalWorker.fetch(get(path), env);
    assert.equal(response.status, 404, path);
  }
  assert.deepEqual(env.served, ["/support", "/support.html"]);
});

test("payment-link lookup fails closed unless a trusted Mercado Pago HTTPS path is configured", async () => {
  const examples = [
    undefined, "", "http://www.mercadopago.com.br/checkout",
    "https://mercadopago.com.br.evil.example/checkout",
    "https://mercadopago.com.br@evil.example/checkout",
    "https://mercadopago.com.br/", "https://mercadopago.com.br:444/checkout",
    "https://mercadopago.com.br/checkout#frag", "https://example.com/donate",
    "https://mercadopago.com.br/checkout/../.."
  ];
  for (const value of examples) {
    const env = envWithLink(value);
    const response = await portalWorker.fetch(get("/support-link.json"), env);
    assert.equal(response.status, 200, String(value));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { enabled: false }, String(value));
    assert.deepEqual(env.served, []);
  }
});

test("configured contribution link is the sole public data returned; no secrets or rewards", async () => {
  const link = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=example";
  const env = envWithLink(link);
  const response = await portalWorker.fetch(get("/support-link.json"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: true, url: link });
  assert.deepEqual(env.served, []);
  const head = await portalWorker.fetch(get("/support-link.json", "HEAD"), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const method of ["POST", "PUT", "DELETE"]) {
    assert.equal((await portalWorker.fetch(get("/support-link.json", method), env)).status, 405);
  }
});

test("campaign does not promise fake fundraising totals or automatic in-game benefits", async () => {
  const [canonical, isolated, portal, publicPortal] = await Promise.all([
    readFile(new URL("../support.html", import.meta.url), "utf8"),
    readFile(new URL("../public-portal/support.html", import.meta.url), "utf8"),
    readFile(new URL("../portal.html", import.meta.url), "utf8"),
    readFile(new URL("../public-portal/portal.html", import.meta.url), "utf8")
  ]);
  assert.equal(canonical, isolated);
  assert.equal(portal, publicPortal);
  assert.match(portal, /href="\/support"/);
  assert.match(canonical, /R\$ 10/);
  assert.match(canonical, /R\$ 50/);
  assert.match(canonical, /R\$ 200/);
  assert.match(canonical, /R\$ 5\.000/);
  assert.match(canonical, /Arrecadação verificada/);
  assert.match(canonical, /Sem benefícios no jogo/);
  assert.match(canonical, /id="support-payment-link" aria-disabled="true"/);
  assert.doesNotMatch(canonical, /R\$ 1\.750|35%|items_granted|MP_ACCESS_TOKEN|NUBANK_PIX_KEY|secret put/i);
  assert.doesNotMatch(canonical, /\/api\/store\/checkout|\/auth\/login|document\.cookie|localStorage/);
});
