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
  assert.deepEqual(HERO_SUMMON_RARITY_ODDS, { white: 70, blue: 25, purple: 5 });
  const odds = getHeroSummonOdds();
  assert.deepEqual(odds.map(row => [row.rarity, row.heroCount, row.perHeroPercent]), [
    ["white", 4, 17.5],
    ["blue", 5, 5],
    ["purple", 9, 0.5556]
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
  assert.equal(maxed.attackPercent, 2.2);
  assert.equal(maxed.defensePercent, 1.7);
  assert.ok(maxed.attackPercent <= 3 && maxed.defensePercent <= 3);
  const card = heroView({ hero_key: "kael_sunwarden", rarity: "blue", level: 50, stars: 6 });
  assert.deepEqual(card.combat_bonuses, maxed);
});

test("23 heróis canônicos e sazonais possuem aura própria e história de Eldoria",async()=>{
  const {HERO_IDENTITIES}=await import("../hero-identities.js");
  const ids=[...Object.keys(HERO_TEMPLATES),"odin_awakened","thor_ragnarok","freya_vanir","loki_chaos","valhalla_king"];
  assert.equal(ids.length,23);
  assert.equal(new Set(ids).size,23);
  assert.equal(new Set(ids.map(key=>HERO_IDENTITIES[key]?.aura)).size,23);
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
