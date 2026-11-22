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

test("publicação de visual de produção exige CI verde, API saudável e deploy com rollback",async()=>{
  const yaml=await read(".github/workflows/publicar-visual-real-apos-ci.yml");
  assert.match(yaml,/Clash of Izzy CI/);
  assert.match(yaml,/READY-ROYAL-SKIN/);
  assert.match(yaml,/head_branch == 'main'/);
  assert.match(yaml,/androidApiContract !== "eldoria-android-v1"/);
  assert.match(yaml,/c\.database !== true \|\| c\.schema !== true \|\| c\.session !== true/);
  assert.match(yaml,/gh workflow run deploy-cloudflare\.yml --repo/);
  assert.doesNotMatch(yaml,/d1 migrations apply|wrangler deploy/);
});
