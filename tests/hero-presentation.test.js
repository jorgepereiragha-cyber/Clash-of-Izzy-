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
  for (const [key, hero] of Object.entries(HERO_TEMPLATES)) {
    assert.ok(hero.portrait, "símbolo de retrato ausente: " + key);
    assert.ok(sprite.includes('id="' + hero.portrait + '"'), "arte ausente: " + hero.portrait);
  }
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
    ["purple", 4, 1.25]
  ]);
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
