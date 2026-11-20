import { test, expect } from "@playwright/test";
import { buildSkinSetGallery } from "../../skin-sets.js";

const TOKEN = "playwright-hero-fixture-token";

function makeHeroState() {
  const pantheonGallery = buildSkinSetGallery([]);
  const item = {
    id: "iron_sword",
    name: "Lâmina de Ferro",
    slot: "weapon",
    level: 1,
    maxLevel: 10,
    rarity: "comum",
    stats: { attack: 10, defense: 0, health: 0, resourceBonus: 0, critical: 0, march: 0 },
    nextLevelStats: { attack: 12, defense: 0, health: 0, resourceBonus: 0, critical: 0, march: 0 },
    upgradeCost: 120,
    isLocked: false,
    equippedHeroId: 101,
  };
  const hero = {
    id: 101,
    hero_key: "kael_sunwarden",
    hero_name: "Kael",
    level: 1,
    experience: 0,
    rarity: "rare",
  };
  const heroCard = {
    hero_key: "kael_sunwarden",
    name: "Kael",
    title: "Guardião do Sol",
    rarity: "blue",
    rarity_label: "Azul · Raro",
    level: 1,
    max_level: 50,
    stars: 1,
    max_stars: 6,
    fragments: 0,
    fragments_to_next: 10,
    stats: { hp: 1400, attack: 250, defense: 180, speed: 64 },
    combat_bonuses: { attackPercent: 0.99, defensePercent: 0.77, healthPercent: 0.45, criticalChancePercent: 0.07 },
    skill: "Lâmina Solar",
    skill_description: "Golpe de luz que fortalece a linha de frente",
    skill_power: 2.1,
    portrait_symbol: "kael",
    portrait_alt: "Kael — Guardião do Sol",
  };
  return {
    player: { player_id: "hero-e2e-player", name: "QA", nickname: "QA", gems: 1000 },
    kingdom: { id: 101, kingdom_name: "Eldoria QA", gold: 5000, iron: 1500, castle_level: 3 },
    equipment: [item],
    heroes: [hero],
    heroInventory: [heroCard],
    heroSummonOdds: [
      { rarity: "white", chancePercent: 70, heroCount: 4, perHeroPercent: 17.5 },
      { rarity: "blue", chancePercent: 25, heroCount: 5, perHeroPercent: 5 },
      { rarity: "purple", chancePercent: 5, heroCount: 4, perHeroPercent: 1.25 },
    ],
    heroEquipment: [],
    equipmentCatalog: [],
    equipmentResearch: [],
    equipmentProgression: [],
    cosmetics: { skins: {}, owned: [], collections: [], claimed: [], shards: 0, skinSets: pantheonGallery.sets, skinSetBonuses: pantheonGallery.bonuses },
    castleSkins: [],
    inventoryItems: [],
    buildings: [{ building_type: "academy", level: 1 }],
    pets: [],
    petGold: 0,
    petBonuses: {},
    shop: {},
  };
}

test("equipment page shows hero portraits, combat passives and exact summon rates", async ({ page, request }) => {
  const actions = [];
  let state = makeHeroState();

  await page.addInitScript(token => {
    window.localStorage.setItem("coi_game_token", token);
  }, TOKEN);

  await page.route("**/api/game/state", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state }),
    });
  });

  await page.route("**/api/game/action", async route => {
    const action = route.request().postDataJSON();
    actions.push(action);
    state = {
      ...state,
      player: { ...state.player, gems: 900 },
      heroInventory: [
        ...state.heroInventory,
        {
          ...state.heroInventory[0],
          hero_key: "merlin_arquimago",
          name: "Merlin",
          title: "O Arquimago Supremo",
          rarity: "purple",
          rarity_label: "Roxo · Lendário",
          level: 1,
          max_level: 70,
          stars: 1,
          max_stars: 7,
          stats: { hp: 2800, attack: 650, defense: 250, speed: 65 },
          combat_bonuses: { attackPercent: 0.99, defensePercent: 0.23, healthPercent: 0.23, criticalChancePercent: 0.45 },
          skill: "Meteoro Ancestral",
          skill_description: "Invoca destruição dos céus",
          skill_power: 5,
          portrait_symbol: "mage",
          portrait_alt: "Merlin — O Arquimago Supremo",
        },
      ],
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        state,
        battle: {
          summons: [{ hero_key: "merlin_arquimago", name: "Merlin", rarity: "purple", result_type: "new", fragments: 0 }],
          cost: 100,
        },
      }),
    });
  });

  const spriteResponse = await request.get("/assets/art/heroes/portraits.svg");
  expect(spriteResponse.ok()).toBe(true);
  const pantheonSpriteResponse = await request.get("/assets/art/skins/pantheon-relics.svg");
  expect(pantheonSpriteResponse.ok()).toBe(true);

  await page.goto("/equipment-ui.html");
  await expect(page.locator("#pantheon-skin-set-grid .pantheon-set-card")).toHaveCount(4);
  await expect(page.locator("#pantheon-skin-set-grid")).toContainText("Corte Solar do Egito");
  await expect(page.locator("#pantheon-skin-set-grid [data-set-id='egyptian_solar_court'] .pantheon-relic-card")).toHaveCount(5);
  await expect(page.locator("#pantheon-skin-set-grid [data-item-id='eg_ra_crown'] .pantheon-relic-art use")).toHaveAttribute("href", "/assets/art/skins/pantheon-relics.svg#eg_ra_crown");
  await expect(page.locator("#pantheon-skin-set-grid [data-item-id='eg_ra_crown'] .pantheon-skin-action")).toHaveText("COMPRAR · 1.400 gemas");
  await expect(page.locator(".hero-roster-card")).toHaveCount(1);
  await expect(page.locator(".hero-roster-name")).toHaveText("Kael");
  await expect(page.locator(".hero-roster-portrait use")).toHaveAttribute("href", /portraits\.svg#kael$/);
  await expect(page.locator(".hero-roster-combat")).toContainText("ATQ +1.0%");
  await expect(page.locator(".hero-summon-rates")).toContainText("17,5% por herói");
  await expect(page.locator(".hero-summon-rates")).toContainText("1,25% por herói");
  await expect(page.locator(".hero-summon-probability-note")).toContainText("40,13%");
  await expect(page.locator(".hero-summon-probability-note")).toContainText("11,82%");
  await expect(page.locator("#hero-summon-one")).toBeEnabled();
  await expect(page.locator("#hero-summon-ten")).toBeEnabled();

  await page.locator("#hero-summon-one").click();
  await expect(page.locator("#hero-summon-status")).toContainText("1 herói(s) novo(s)");
  await expect(page.locator("#hero-gem-balance")).toHaveText("Gemas: 900");
  await expect(page.locator(".hero-roster-card")).toHaveCount(2);
  await expect(page.locator(".hero-summon-result")).toContainText("Merlin");
  await expect(page.locator(".hero-roster-card").nth(1).locator(".hero-roster-portrait use")).toHaveAttribute("href", "/assets/art/heroes/portraits.svg#mage");
  expect(actions).toEqual([{ type: "hero_summon", quantity: 1 }]);
});
