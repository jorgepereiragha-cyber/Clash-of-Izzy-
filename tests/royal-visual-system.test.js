import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("site oficial e portal de propaganda compartilham marca real sem rotas de jogo",async()=>{
  const [portal,publicPortal,publicCss,theme]=await Promise.all([
    read("portal.html"),read("public-portal/portal.html"),
    read("public-portal/styles/coi-theme.css"),read("styles/coi-theme.css")
  ]);
  assert.equal(portal,publicPortal);
  assert.equal(publicCss,theme);
  for(const text of ["royal-hero","royal-art","CLASH OF","class=\"golden\"","--gold:#f1c467","@media(max-width:800px)"]){
    assert.ok(portal.includes(text),text);
  }
  assert.match(portal,/id="download-apk" aria-disabled="true"/);
  assert.match(portal,/validAsset\(asset, expectedName\)/);
  assert.doesNotMatch(portal,/href="\/kingdom\.html"/);
});
test("jogo dentro do aplicativo compartilha paleta real e mantém a loja Valhalla diferenciada",async()=>{
  const [premium,kingdom,activity,androidTheme]=await Promise.all([
    read("styles/premium-ui.css"),read("kingdom.html"),
    read("android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java"),
    read("android-sideload/app/src/main/res/values/styles.xml")
  ]);
  assert.match(kingdom,/href="\/styles\/premium-ui\.css"/);
  assert.match(premium,/--coi-premium-gold:#f1c467/);
  assert.match(premium,/body:not\(\.valhalla-mode-active\) > header/);
  assert.match(premium,/rgba\(18,54,104,\.97\)/);
  assert.match(activity,/royalOverline\.setText\("A ERA DOS REIS"\)/);
  assert.match(activity,/GradientDrawable emblemBorder/);
  assert.match(androidTheme,/#081831/);
});

test("legacy Royal Skin auto-deploy is retired and cannot dispatch production", async () => {
  const yaml = await read(".github/workflows/publicar-visual-real-apos-ci.yml");
  assert.match(yaml, /^on:\s*\n  workflow_dispatch:/m);
  assert.doesNotMatch(yaml, /workflow_run:|gh workflow run deploy-cloudflare/);
  assert.doesNotMatch(yaml, /actions:\s*write/);
  assert.match(yaml, /exit 1/);
});

test("arte real é embutida nos três ambientes em WebP leve e idêntico",async()=>{
 const fs=await import("node:fs/promises");
 const paths=["assets/brand/royal-king.webp","public-portal/assets/brand/royal-king.webp","android-sideload/app/src/main/res/drawable-nodpi/royal_king.webp"];
 const images=await Promise.all(paths.map(path=>fs.readFile(new URL("../"+path,import.meta.url))));
 assert.ok(images[0].length>7000&&images[0].length<20000);
 assert.equal(images[0].toString("ascii",0,4),"RIFF");
 assert.equal(images[0].toString("ascii",8,12),"WEBP");
 for(const im of images.slice(1))assert.deepEqual(im,images[0]);
 const [portal,kingdom,java,worker]=await Promise.all([
  read("portal.html"),read("kingdom.html"),
  read("android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java"),
  read("portal-worker.js")
 ]);
 assert.match(portal,/src="\/assets\/brand\/royal-king\.webp"/);
 assert.match(kingdom,/class="brand-royal-seal"/);
 assert.match(java,/heroEmblem\.setImageResource\(R\.drawable\.royal_king\)/);
 assert.match(worker,/assets\/brand\/royal-king\.webp/);
});
