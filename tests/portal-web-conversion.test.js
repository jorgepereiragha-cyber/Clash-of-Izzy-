import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = name => readFile(new URL("../" + name, import.meta.url), "utf8");

test("portal and isolated marketing worker mirror retain identical conversion content", async () => {
  const [main,publicPage] = await Promise.all([read("portal.html"),read("public-portal/portal.html")]);
  assert.equal(main,publicPage);
  assert.match(main,/id="play-browser" href="https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev\/kingdom\.html" aria-describedby="play-browser-note"/);
  assert.match(main,/Sem instalar APK/);
  assert.match(main,/\.download#play-browser\{min-height:64px/);
  assert.match(main,/id="download-apk" aria-disabled="true" tabindex="-1"/);
  assert.match(main,/releases\/latest/);
  assert.match(main,/\.sha256/);
});

test("portal clarifies distinct rewarded packages vs optional no-reward contributions", async () => {
  const main=await read("portal.html");
  const support=await read("apoie.html");
  assert.match(main,/href="\/apoie\.html#pacotes">Pacotes pagos com gemas/);
  assert.match(main,/href="\/apoie\.html#contribuicao">Contribuição voluntária sem gemas/);
  assert.match(main,/Compras dependem da homologação e liberação dos meios de pagamento/);
  assert.match(support,/id="pacotes"/);
  assert.match(support,/id="contribuicao"/);
  assert.match(support,/500 gemas confirmadas/);
  assert.match(support,/Contribuição voluntária, sem recompensas/);
  assert.doesNotMatch(main,/MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET|checkoutUrl|paymentReference/);
});

test("no extra game scripts, payment collection, or unapproved APK claims in portal", async () => {
  const html=await read("portal.html");
  assert.doesNotMatch(html,/href="\/(?:kingdom|arena|world|account|admin)\.html"/);
  assert.doesNotMatch(html,/src="\/world-map-3d\.js"/);
  assert.doesNotMatch(html,/window\.location\.href\s*=\s*['"]https:\/\/api\.mercadopago/);
  assert.match(html,/Alguns recursos ainda estão em homologação/);
  assert.match(html,/O APK comercial ainda não está disponível/);
});
