import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { heroView, HERO_TEMPLATES, HERO_RARITY, HERO_SUMMON_RARITY_ODDS, getHeroCombatBonuses, getHeroSummonOdds } from "../hero-catalog.js";

test("Kael tem ficha canônica, retrato e progressão consistente", () => {
  const base = heroView({ hero_key: "kael_sunwarden", rarity: "blue", level: 1, stars: 1 });
  assert.equal(base.name, "Kael");
  assert.equal(base.title, "Guardião do Sol");
  assert.equal(base.portrait_symbol, "kael");
  assert.equal(base.stats.hp, 1400);
  assert.equal(base.max_level, 50);
  const progressed = heroView({ hero_key: "kael_sunwarden", rarity: "blue", level: 50, stars: 6 });
  assert.equal(progressed.stats.hp, 4508);
  assert.ok(progressed.stats.hp < 1400 * 1.8 * 3.22, "a raridade não deve ser multiplicada duas vezes");
});

test("a raridade base não é multiplicada novamente na ficha", () => {
  const common = heroView({ hero_key: "soldado_basico", rarity: "white", level: 1, stars: 1 });
  const rare = heroView({ hero_key: "capitao_espada", rarity: "blue", level: 1, stars: 1 });
  const legendary = heroView({ hero_key: "rei_artur", rarity: "purple", level: 1, stars: 1 });
  assert.equal(common.stats.hp, 500);
  assert.equal(rare.stats.hp, 1200);
  assert.equal(legendary.stats.hp, 3500);
  assert.ok(legendary.stats.hp / common.stats.hp === 7);
});

test("heróis sazonais usam o catálogo D1 e preservam nível-base", () => {
  const odin = heroView({
    hero_key: "odin_awakened",
    rarity: "purple",
    level: 5,
    stars: 1,
    seasonal_hero_name: "Odin Desperto",
    seasonal_rarity: "mythic",
    seasonal_description: "O Pai de Todos em sua forma divina",
    seasonal_base_level: 5,
    seasonal_stats_json: JSON.stringify({ hp: 12000, attack: 2400, defense: 1800, speed: 95 })
  });
  assert.equal(odin.name, "Odin Desperto");
  assert.equal(odin.rarity_label, "Mítico");
  assert.equal(odin.stats.hp, 12000);
  assert.equal(odin.portrait_symbol, "odin");
});

test("nível, estrelas e estatísticas inválidas são limitados sem NaN", () => {
  const hero = heroView({ hero_key: "kael_sunwarden", rarity: "blue", level: 999, stars: 999, fragments: -5 });
  assert.equal(hero.level, HERO_RARITY.blue.maxLevel);
  assert.equal(hero.stars, HERO_RARITY.blue.maxStars);
  assert.equal(hero.fragments, 0);
  assert.ok(Object.values(hero.stats).every(value => Number.isFinite(value) && value >= 0));
});

test("todo herói invocável tem símbolo de retrato definido", async () => {
  const sprite = await readFile(new URL("../assets/art/heroes/portraits.svg", import.meta.url), "utf8");
  const portraitSymbols = Object.entries(HERO_TEMPLATES).map(([key, hero]) => {
    assert.ok(hero.portrait, "símbolo de retrato ausente: " + key);
    assert.ok(sprite.includes('id="' + hero.portrait + '"'), "arte ausente: " + hero.portrait);
    return hero.portrait;
  });
  assert.equal(
    new Set(portraitSymbols).size,
    portraitSymbols.length,
    "cada herói do sorteio padrão precisa ter um retrato exclusivo"
  );
  for (const symbol of ["odin", "thor", "freya", "loki", "valhalla-king"]) {
    assert.ok(sprite.includes('id="' + symbol + '"'), "arte sazonal ausente: " + symbol);
  }
});

test("probabilidades de convocação são calculadas pelo catálogo canônico", () => {
  assert.deepEqual(HERO_SUMMON_RARITY_ODDS, { white: 55, blue: 30, purple: 13, gold: 2 });
  const odds = getHeroSummonOdds();
  assert.deepEqual(odds.map(row => [row.rarity, row.heroCount, row.perHeroPercent]), [
    ["white", 18, 3.0556],
    ["blue", 18, 1.6667],
    ["purple", 18, 0.7222],
    ["gold", 11, 0.1818]
  ]);
});

test("os cinco comandantes do panteão egípcio têm retratos, auras e passivos canônicos", async () => {
  const sprite = await readFile(new URL("../assets/art/heroes/portraits.svg", import.meta.url), "utf8");
  const egyptian = [
    ["amun_ra_solar", "Amon-Rá", "amun-ra", "solar"],
    ["anubis_duat", "Anúbis", "anubis", "duat"],
    ["isis_eternal_wings", "Ísis", "isis", "wings"],
    ["horus_eternal_eye", "Hórus", "horus", "falcon"],
    ["sekhmet_crimson_lioness", "Sekhmet", "sekhmet", "crimson"]
  ];
  for (const [key, name, portrait, aura] of egyptian) {
    const hero = HERO_TEMPLATES[key];
    assert.ok(hero, "herói ausente: " + key);
    assert.equal(hero.name, name);
    assert.equal(hero.rarity, "purple");
    assert.equal(hero.portrait, portrait);
    assert.ok(sprite.includes('id="' + portrait + '"'), "retrato ausente: " + portrait);
    const view = heroView({ hero_key: key, rarity: "purple", level: 1, stars: 1 });
    assert.equal(view.theme_key, "egypt");
    assert.equal(view.aura_key, aura);
    assert.ok(view.combat_bonuses.attackPercent > 0 || view.combat_bonuses.defensePercent > 0);
  }
});

test("passivos dos heróis escalam de forma limitada por nível e estrelas", () => {
  const starter = getHeroCombatBonuses({ hero_key: "kael_sunwarden", rarity: "blue", level: 1, stars: 1 });
  const maxed = getHeroCombatBonuses({ hero_key: "kael_sunwarden", rarity: "blue", level: 50, stars: 6 });
  assert.ok(starter.attackPercent > 0);
  assert.ok(starter.attackPercent < maxed.attackPercent);
  assert.ok(maxed.attackPercent >= 3 && maxed.attackPercent <= 6);
  assert.ok(maxed.defensePercent >= 3 && maxed.defensePercent <= 6);
  const card = heroView({ hero_key: "kael_sunwarden", rarity: "blue", level: 50, stars: 6 });
  assert.deepEqual(card.combat_bonuses, maxed);
});

test("70 heróis invocáveis e sazonais possuem aura própria e história de Eldoria",async()=>{
  const {HERO_IDENTITIES}=await import("../hero-identities.js");
  const ids=[...Object.keys(HERO_TEMPLATES),"odin_awakened","thor_ragnarok","freya_vanir","loki_chaos","valhalla_king"];
  assert.equal(ids.length,70);
  assert.equal(new Set(ids).size,70);
  assert.equal(new Set(ids.map(key=>HERO_IDENTITIES[key]?.aura)).size,70);
  for(const key of ids){
    const identity=HERO_IDENTITIES[key];
    assert.ok(identity?.faction && identity?.aura_label && identity?.lore && identity?.motto,key);
    const row={hero_key:key,rarity:HERO_TEMPLATES[key]?.rarity||"purple",seasonal_hero_name:key};
    const card=heroView(row);
    assert.equal(card.aura_key,identity.aura,key);
    assert.equal(card.identity_lore,identity.lore,key);
  }
});
test("nomes do catálogo de recrutamento são únicos",()=>{
  const names=Object.values(HERO_TEMPLATES).map(hero=>hero.name);
  assert.equal(new Set(names).size,names.length);
});

test("catálogo contém exatamente 70 identidades distintas: 65 invocáveis e cinco sazonais",async()=>{
 const names=Object.values(HERO_TEMPLATES).map(hero=>hero.name);
 const keys=Object.keys(HERO_TEMPLATES);
 const seasonal=["odin_awakened","thor_ragnarok","freya_vanir","loki_chaos","valhalla_king"];
 assert.equal(keys.length,65);
 assert.equal(new Set(names).size,65);
 assert.equal(new Set([...keys,...seasonal]).size,70);
 const rarityCount=Object.groupBy(Object.values(HERO_TEMPLATES),hero=>hero.rarity);
 assert.deepEqual(Object.fromEntries(Object.entries(rarityCount).map(([key,v])=>[key,v.length])),{white:18,blue:18,purple:18,gold:11});
 assert.equal(HERO_SUMMON_RARITY_ODDS.white+HERO_SUMMON_RARITY_ODDS.blue+HERO_SUMMON_RARITY_ODDS.purple+HERO_SUMMON_RARITY_ODDS.gold,100);
});
test("atlas SVG contém 70 símbolos de retratos sem IDs repetidos ou referências quebradas",async()=>{
 const source=await readFile(new URL("../assets/art/heroes/portraits.svg",import.meta.url),"utf8");
 const symbols=[...source.matchAll(/<symbol\s+id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(symbols).size,symbols.length);
 const selected=[...Object.values(HERO_TEMPLATES).map(hero=>hero.portrait),"odin","thor","freya","loki","valhalla-king"];
 assert.equal(selected.length,70);
 assert.equal(new Set(selected).size,70);
 for(const symbol of selected)assert.ok(symbols.includes(symbol),"Falta retrato "+symbol);
});
test("raridade dourada sempre supera a roxa em ataque e defesa em qualquer nível",()=>{
 const purple=Object.entries(HERO_TEMPLATES).find(([,hero])=>hero.rarity==="purple")[0];
 const gold=Object.entries(HERO_TEMPLATES).find(([,hero])=>hero.rarity==="gold")[0];
 for(const rarity of ["white","blue","purple","gold"]){
   for(const [key,template] of Object.entries(HERO_TEMPLATES).filter(([,x])=>x.rarity===rarity)){
     const min=getHeroCombatBonuses({hero_key:key,rarity,level:1,stars:1});
     const max=getHeroCombatBonuses({hero_key:key,rarity,level:HERO_RARITY[rarity].maxLevel,stars:HERO_RARITY[rarity].maxStars});
     assert.ok(min.attackPercent>0&&min.defensePercent>0,key);
     assert.ok(max.attackPercent>=min.attackPercent&&max.defensePercent>=min.defensePercent,key);
     assert.ok(max.attackPercent<=20&&max.defensePercent<=20,key);
     assert.deepEqual(heroView({hero_key:key,rarity,level:1,stars:1}).combat_bonuses,min);
   }
 }
 const topPurple=getHeroCombatBonuses({hero_key:purple,rarity:"purple",level:70,stars:7});
 const baseGold=getHeroCombatBonuses({hero_key:gold,rarity:"legendary",level:1,stars:1});
 assert.ok(baseGold.attackPercent>topPurple.attackPercent);
 assert.ok(baseGold.defensePercent>topPurple.defensePercent);
 assert.deepEqual(getHeroCombatBonuses({}),{attackPercent:0,defensePercent:0,healthPercent:0,criticalChancePercent:0});
});

test("ficha dourada mantém raridade canônica mesmo se D1 legada gravou legendary/epic",()=>{
  const [key,template]=Object.entries(HERO_TEMPLATES).find(([,hero])=>hero.rarity==="gold");
  assert.ok(key&&template);
  for(const legacy of ["legendary","epic","purple","white"]){
    const card=heroView({hero_key:key,rarity:legacy,level:100,stars:10});
    assert.equal(card.rarity_key,"gold",legacy);
    assert.equal(card.rarity_label,HERO_RARITY.gold.label,legacy);
    assert.equal(card.max_level,HERO_RARITY.gold.maxLevel,legacy);
    assert.equal(card.max_stars,HERO_RARITY.gold.maxStars,legacy);
    const combat=getHeroCombatBonuses({hero_key:key,rarity:legacy,level:card.level,stars:card.stars});
    assert.deepEqual(card.combat_bonuses,combat,legacy);
  }
  for(const [heroKey,record] of Object.entries(HERO_TEMPLATES)){
    const view=heroView({hero_key:heroKey,rarity:"legendary"});
    assert.equal(view.rarity_key,record.rarity,heroKey);
  }
  const seasonal=heroView({hero_key:"odin_awakened",rarity:"purple",seasonal_rarity:"mythic"});
  assert.equal(seasonal.rarity_key,"purple");
  assert.equal(seasonal.rarity_label,"Mítico");
});
