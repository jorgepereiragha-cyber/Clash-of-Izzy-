import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../"+path,import.meta.url),"utf8");

test("raridades de mascotes são traduzidas por tabela segura e cores consistentes",async()=>{
  const html=await read("kingdom.html");
  for(const [rarity,label,css] of [
    ["common","Comum","pet-rarity-common"],
    ["rare","Raro","pet-rarity-rare"],
    ["epic","Épico","pet-rarity-epic"],
    ["legendary","Lendário","pet-rarity-legendary"],
    ["mythic","Mítico","pet-rarity-mythic"]
  ]){
    assert.ok(html.includes(rarity+':{label:"'+label+'",css:"'+css+'"}'),"rarity "+rarity);
    assert.ok(html.includes("."+css+"{"),"style "+css);
  }
  assert.ok(html.includes('PET_RARITIES[String(p.rarity||"").toLowerCase()]'));
  assert.ok(html.includes("esc(rarity.label)"));
  assert.ok(!html.includes('esc(p.rarity||"")'));
});

test("painéis sem backend disponível ficam ocultos e sem resgates",async()=>{
  const ui=await read("player-engagement.js");
  assert.ok(ui.includes('else { tutorial.hidden=true; $("onboardingClaim").disabled=true; }'));
  assert.ok(ui.includes('else { daily.hidden=true; $("dailyClaim").disabled=true; }'));
  assert.ok(ui.includes('if (rewards.status==="fulfilled") drawDaily(rewards.value)'));
  assert.ok(ui.includes('if (onboarding.status==="fulfilled") drawOnboarding(onboarding.value)'));
});


test("retratos de mascotes usam IDs canônicos, arte local e fallback escapado",async()=>{
  const html=await read("kingdom.html");
  const catalog=await read("migrations/0022_pets_and_battle_replays.sql");
  const portraits=html.slice(html.indexOf("const PET_PORTRAITS="),html.indexOf("function renderPets(){"));
  for(const id of ["pet_raven","pet_wolf","pet_dragon"]){
    assert.ok(catalog.includes("'"+id+"'"));
    assert.ok(portraits.includes(id+":'<g"));
  }
  assert.ok(portraits.includes("Object.hasOwn(PET_PORTRAITS,p.id)"));
  assert.ok(portraits.includes('esc(p.icon||"🐾")'));
  assert.ok(!/https?:|<image|<script/i.test(portraits));
  assert.ok(html.includes("petPortrait(p,rarity)"));
  for(const action of ["unlock","activate","feed"]){
    assert.ok(html.includes("data-pet-"+action));
  }
});
