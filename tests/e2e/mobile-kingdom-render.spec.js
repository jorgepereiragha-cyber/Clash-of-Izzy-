import { test, expect } from "@playwright/test";

function createKingdomState() {
  const now = Date.now();

  return {
    player: {
      name: "ComandanteTeste",
      nickname: "ComandanteTeste",
      gems: 150
    },
    kingdom: {
      id: 7,
      kingdom_name: "Reino de Eldoria",
      castle_level: 3,
      food: 12500,
      wood: 8400,
      stone: 5000,
      iron: 2100,
      gold: 3000,
      power: 1450,
      prestige: 0
    },
    buildings: [
      { building_type: "castle", level: 3 },
      { building_type: "farm", level: 2 },
      { building_type: "barracks", level: 2 }
    ],
    queues: [
      {
        queue_type: "construction",
        target_key: "farm",
        to_level: 3,
        status: "running",
        started_at: new Date(now - 30_000).toISOString(),
        completes_at: new Date(now + 120_000).toISOString()
      }
    ],
    troops: [{ unit_type: "militia", quantity: 15 }],
    armyCount: 15,
    troopCapacity: 1000,
    marches: [],
    territories: [],
    alliance: null,
    research: [],
    recentEvents: [],
    pets: [],
    battleReports: [],
    dragon: null,
    petGold: 0
  };
}

test.beforeEach(async ({ page }) => {
  // The real page uses this token to choose GET /api/game/state over account creation.
  await page.addInitScript(() => {
    window.localStorage.setItem("coi_game_token", "playwright-mobile-fixture-token");
  });

  await page.route("**/api/game/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state: createKingdomState() })
    });
  });

  // Analytics is not part of this rendering test and must not reach a real backend.
  await page.route("**/api/game/analytics", async (route) => {
    await route.fulfill({ status: 204 });
  });

  // Three.js is optional here: the page's built-in 2D city renderer is the deterministic fallback.
  await page.route("https://cdn.jsdelivr.net/**", async (route) => {
    await route.abort();
  });
});

test("renders kingdom resources, buildings, queue and training controls on mobile", async ({ page }) => {
  await page.goto("/kingdom.html");
  await expect(page.locator("#game")).toBeVisible();

  // HUD: the real UI displays five resources plus gems.
  const resources = page.locator("#resources .resource");
  await expect(resources).toHaveCount(6);
  await expect(resources.filter({ hasText: "Comida" }).locator("b")).toHaveText("12.500");
  await expect(resources.filter({ hasText: "Madeira" }).locator("b")).toHaveText("8.400");
  await expect(resources.filter({ hasText: "Gemas" }).locator("b")).toHaveText("150");

  // Kingdom identity and castle level.
  await expect(page.locator("#kingdomName")).toHaveText("Reino de Eldoria");
  await expect(page.locator("#playerName")).toHaveText("ComandanteTeste · Castelo nível 3");

  // City building tiles are real buttons generated from the server state.
  const castle = page.locator('#city .building[data-building="castle"]');
  await expect(castle).toBeVisible();
  await expect(castle.locator("small")).toHaveText("Nível 3");
  await expect(page.locator('#city .building[data-building="farm"]')).toBeVisible();

  // The active farm queue intentionally changes this action to a disabled state.
  const farmUpgrade = page.locator('#buildings [data-upgrade="farm"]');
  await expect(farmUpgrade).toBeVisible();
  await expect(farmUpgrade).toHaveText("EM CONSTRUÇÃO");
  await expect(farmUpgrade).toBeDisabled();

  const barracksUpgrade = page.locator('#buildings [data-upgrade="barracks"]');
  await expect(barracksUpgrade).toBeVisible();
  await expect(barracksUpgrade).toHaveText("Evoluir");
  await expect(barracksUpgrade).toBeEnabled();

  // Queue countdown and progress are rendered from the controlled timestamps.
  const queueCard = page.locator("#queues .queue-card").filter({
    hasText: "Construção · Fazenda"
  });
  await expect(queueCard).toBeVisible();
  await expect(queueCard.locator(".queue-remaining")).toHaveText(/\d+\s*[hms]/);
  const progress = queueCard.locator(".queue-progress");
  await expect(progress).toHaveAttribute("aria-valuenow", /^(?:[1-9]\d?|100)$/);
  await expect(queueCard.locator(".queue-progress span")).toHaveAttribute(
    "style",
    /width:\s*\d+(?:\.\d+)?%/
  );

  // Training remains available because the fixture army is below capacity.
  await expect(page.locator("#trainingForm")).toBeVisible();
  await expect(page.locator("#trainButton")).toBeEnabled();

  // Small-screen layout must not create horizontal page scrolling or collapse the city.
  const metrics = await page.evaluate(() => {
    const city = document.getElementById("city");
    const box = city.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      cityWidth: box.width,
      cityHeight: box.height
    };
  });
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.cityWidth).toBeGreaterThan(0);
  expect(metrics.cityHeight).toBeGreaterThan(250);

  // Selecting a city building scrolls its matching action into view.
  await page.locator('#city [data-building="farm"]').click();
  await expect(farmUpgrade).toBeInViewport();
});
