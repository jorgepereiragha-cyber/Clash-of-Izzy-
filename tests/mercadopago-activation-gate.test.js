import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mercadoPagoNewCheckoutEnabled } from "../payment-activation.js";
import { createSupportCheckout } from "../support-orders.js";
import { handleMercadoPagoRoute } from "../mercadopago-orders.js";
import worker from "../worker.js";

const read = path => readFile(new URL("../"+path,import.meta.url),"utf8");
const goodSecrets = { MP_ACCESS_TOKEN:"TEST_TOKEN_ONLY", MP_WEBHOOK_SECRET:"TEST_SECRET_ONLY" };
const json = (data,status=200) => Response.json(data,{status});
const checkout = new Request("https://game.invalid/api/store/checkout",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:42})
});

test("Mercado Pago release flag is explicit, exact and requires both secrets",()=>{
  assert.equal(mercadoPagoNewCheckoutEnabled(goodSecrets),false);
  for(const flag of [undefined,null,false,1,"TRUE","1","false"]) {
    assert.equal(mercadoPagoNewCheckoutEnabled({...goodSecrets,MP_PAYMENTS_ENABLED:flag}),false);
  }
  assert.equal(mercadoPagoNewCheckoutEnabled({...goodSecrets,MP_PAYMENTS_ENABLED:"true"}),true);
  assert.equal(mercadoPagoNewCheckoutEnabled({MP_PAYMENTS_ENABLED:"true",MP_ACCESS_TOKEN:"TEST"}),false);
  assert.equal(mercadoPagoNewCheckoutEnabled({MP_PAYMENTS_ENABLED:"true",MP_WEBHOOK_SECRET:"TEST"}),false);
});

test("Public payment methods keep Mercado Pago OFF even with secrets until explicit approval",async()=>{
  const defaultEnv={...goodSecrets,DB:{},ENVIRONMENT:"production"};
  for(const env of [defaultEnv,{...defaultEnv,MP_PAYMENTS_ENABLED:"false"}]) {
    const response=await worker.fetch(new Request("https://game.invalid/api/store/payment-methods"),env);
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{mercadoPago:false,nubankPix:false});
  }
  const enabled=await worker.fetch(new Request("https://game.invalid/api/store/payment-methods"),{
    ...defaultEnv,MP_PAYMENTS_ENABLED:"true"
  });
  assert.deepEqual(await enabled.json(),{mercadoPago:true,nubankPix:false});
});

test("Direct checkout fails before identity, D1 or provider calls while gate is off",async()=>{
  const ctx={json};
  const response=await handleMercadoPagoRoute(checkout,{...goodSecrets,MP_PAYMENTS_ENABLED:"false"},ctx);
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,"MP_NOT_CONFIGURED");
});

test("Voluntary support checkout also fails before identity and writes while gate is off",async()=>{
  const request=new Request("https://game.invalid/api/support/checkout",{method:"POST"});
  const response=await createSupportCheckout(request,{...goodSecrets,MP_PAYMENTS_ENABLED:"false"},{json});
  assert.equal(response.status,503);
});

test("Webhook verification is NOT blocked by sales kill-switch; existing paid orders can settle",async()=>{
  const module=await read("mercadopago-orders.js");
  const webhook=module.slice(module.indexOf("async function handleWebhook("),module.indexOf("export async function handleMercadoPagoRoute"));
  assert.match(webhook,/MP_ACCESS_TOKEN \|\| !env\.MP_WEBHOOK_SECRET/);
  assert.doesNotMatch(webhook,/mercadoPagoNewCheckoutEnabled/);
});

test("Default-off flag and independent worker gates are present in checked-in production config",async()=>{
  const config=JSON.parse(await read("wrangler.jsonc"));
  assert.equal(config.vars.MP_PAYMENTS_ENABLED,"false");
  const workerSource=await read("worker.js");
  assert.match(workerSource,/mercadoPago:mercadoPagoNewCheckoutEnabled\(env\)/);
  assert.match(workerSource,/requestedPaymentMethod==="mercadopago_link"&&!mercadoPagoNewCheckoutEnabled\(env\)/);
  assert.match(workerSource,/hasMercadoPagoAutomaticCheckout:mercadoPagoNewCheckoutEnabled\(env\)/);
  const workflow=await read(".github/workflows/deploy-worker-only.yml");
  assert.match(workflow,/"MP_PAYMENTS_ENABLED"/);
  assert.match(workflow,/vars\[name\] !== "false"/);
});
