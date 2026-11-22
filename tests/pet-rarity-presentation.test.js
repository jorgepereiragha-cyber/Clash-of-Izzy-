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
