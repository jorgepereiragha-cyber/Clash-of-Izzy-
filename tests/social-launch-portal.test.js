import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("official and isolated portal display exactly the same social launch metadata", () => {
  const portal=read("portal.html");
  assert.equal(portal,read("public-portal/portal.html"));
  assert.match(portal,/og:url/);
  assert.match(portal,/twitter:card/);
  assert.match(portal,/rel="canonical"/);
  assert.match(portal,/og:image/);
  assert.match(portal,/O APK será oferecido quando a release oficial estiver publicada/);
});
test("social actions share only the public marketing portal and never a payment or internal game page", () => {
  const portal=read("public-portal/portal.html");
  assert.match(portal,/id="share-portal"/);
  assert.match(portal,/id="share-whatsapp"/);
  assert.match(portal,/id="share-facebook"/);
  assert.match(portal,/id="copy-portal"/);
  assert.match(portal,/navigator\.share/);
  assert.match(portal,/navigator\.clipboard\.writeText/);
  assert.match(portal,/utm_campaign=eldoria_pre_lancamento/);
  assert.match(portal,/id="download-apk" aria-disabled="true"/);
  assert.doesNotMatch(portal,/id="play-browser"|kingdom\.html/);
  assert.match(portal,/id="download-apk-final" aria-disabled="true"/);
  assert.doesNotMatch(portal,/NUBANK_PIX_KEY|MP_ACCESS_TOKEN|paymentReference/);
  assert.doesNotMatch(portal,/href="\/(?:kingdom|world|arena|account|admin)\.html"/);
});
