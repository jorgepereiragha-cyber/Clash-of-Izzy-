import { test, expect } from "@playwright/test";

const SESSION_TOKEN = "playwright-mobile-fixture-session";

function makeKingdomState() {
  const now = Date.now();
  return {
    player: {
      player_id: "e2e-player-001",
      name: "ComandanteTeste",
      nickname: "ComandanteTeste",
      gems: 150,
    },
    kingdom: {
      id: 77,
      kingdom_name: "Reino de Eldoria",
      castle_level: 3,
      food: 12500,
      wood: 8400,
      stone: 5000,
      iron: 2100,
      gold: 3000,
      power: 1450,
      prestige: 12,
    },
    buildings: [
      { building_type: "castle", level: 3 },
      { building_type: "barracks", level: 2 },
      { building_type: "farm", level: 2 },
      { building_type: "quarry", level: 1 },
      { building_type: "lumber_mill", level: 2 },
      { building_type: "iron_mine", level: 1 },
      { building_type: "market", level: 1 },
      { building_type: "academy", level: 1 },
      { building_type: "wall", level: 1 },
    ],
    queues: [
      {
        id: 501,
        queue_type: "construction",
        target_key: "quarry",
        from_level: 1,
        to_level: 2,
        status: "running",
        started_at: new Date(now - 30_000).toISOString(),
        completes_at: new Date(now + 120_000).toISOString(),
      },
    ],
    troops: [{ unit_type: "militia", tier: 1, quantity: 15 }],
    armyCount: 15,
    troopCapacity: 1000,
    research: [],
    marches: [],
    territories: [],
    recentEvents: [],
    alliance: null,
    dragon: null,
    pets: [],
    petGold: 0,
    battleReports: [],
  };
}

async function installApiFixtures(page) {
  const actions = [];
  const stateRequests = [];
  const state = makeKingdomState();

  await page.addInitScript(token => {
    window.localStorage.setItem("coi_game_token", token);
  }, SESSION_TOKEN);

  await page.route("**/api/game/state", async route => {
    stateRequests.push({
      method: route.request().method(),
      authorization: route.request().headers().authorization || "",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state }),
    });
  });

  await page.route("**/api/game/analytics", async route => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/game/action", async route => {
    actions.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  return { actions, stateRequests };
}

test.describe("Mobile kingdom rendering", () => {
  test("renders resources, buildings, queues and troop controls on Pixel 5", async ({ page }) => {
    const { stateRequests } = await installApiFixtures(page);

    await page.goto("/kingdom.html");
    await expect(page.locator("#game")).toBeVisible();
    await expect(page.locator("#status")).toContainText("Reino sincronizado");

    const ambientLayer = page.locator("#city .coi-ambient-layer");
    await expect(ambientLayer).toBeAttached();
    await expect(ambientLayer).toHaveAttribute("aria-hidden", "true");
    await expect(ambientLayer).toHaveCSS("pointer-events", "none");

    // The expanded recorder panel used to cover upgrade/training controls on phones.
    // It now starts minimized on mobile and remains accessible through its toggle.
    const recorderBody = page.locator("#coi-recorder-body");
    const recorderToggle = page.locator("#coi-recorder-toggle");
    await expect(recorderToggle).toHaveAttribute("aria-expanded", "false");
    await expect(recorderBody).toBeHidden();
    await recorderToggle.click();
    await expect(recorderToggle).toHaveAttribute("aria-expanded", "true");
    await expect(recorderBody).toBeVisible();
    await recorderToggle.click();
    await expect(recorderBody).toBeHidden();

    // The live HUD has five resources plus the server-owned premium currency.
    await expect(page.locator("#resources .resource")).toHaveCount(6);
    await expect(page.locator("#resources .resource").filter({ hasText: "Comida" }).locator("b"))
      .toHaveText("12.500");
    await expect(page.locator("#resources .resource").filter({ hasText: "Madeira" }).locator("b"))
      .toHaveText("8.400");
    await expect(page.locator("#resources .resource").filter({ hasText: "Pedra" }).locator("b"))
      .toHaveText("5.000");
    await expect(page.locator("#resources .resource").filter({ hasText: "Ferro" }).locator("b"))
      .toHaveText("2.100");
    await expect(page.locator("#resources .resource").filter({ hasText: "Ouro" }).locator("b"))
      .toHaveText("3.000");
    await expect(page.locator("#resources .resource").filter({ hasText: "Gemas" }).locator("b"))
      .toHaveText("150");

    const displayedResources = await page.locator("#resources .resource b").allTextContents();
    expect(displayedResources.every(value => !/NaN|undefined|null/.test(value))).toBe(true);

    await expect(page.locator("#kingdomName")).toHaveText("Reino de Eldoria");
    await expect(page.locator("#playerName")).toContainText("Castelo nível 3");

    const castle = page.locator('#city .building[data-building="castle"]');
    await expect(castle).toBeVisible();
    await expect(castle.locator("small")).toHaveText("Nível 3");
    await expect(page.locator('#buildings [data-upgrade="farm"]')).toBeVisible();
    await expect(page.locator('#buildings [data-upgrade="farm"]')).toHaveText("Evoluir");

    const construction = page.locator(".queue-card").filter({ hasText: "Construção" });
    await expect(construction).toBeVisible();
    await expect(construction.locator(".queue-remaining")).toContainText(/m/);
    await expect(construction.locator(".queue-progress span"))
      .toHaveAttribute("style", /width:\s*\d+%/);
    await expect(construction.locator('[role="progressbar"]'))
      .toHaveAttribute("aria-valuenow", /\d+/);

    await expect(page.locator("#trainingForm")).toBeVisible();
    await expect(page.locator("#trainButton")).toBeEnabled();

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      cityWidth: document.getElementById("city").getBoundingClientRect().width,
      cityHeight: document.getElementById("city").getBoundingClientRect().height,
      canvasIds: [...document.querySelectorAll("#city canvas")].map(canvas => canvas.id),
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.cityWidth).toBeGreaterThan(300);
    expect(layout.cityHeight).toBeGreaterThan(250);
    expect(layout.canvasIds).toContain("kingdomScene");
    expect(stateRequests.length).toBeGreaterThan(0);
    expect(stateRequests.every(request => request.authorization === "Bearer " + SESSION_TOKEN)).toBe(true);
  });

  test("keeps the kingdom usable at a narrower 360px mobile viewport", async ({ page }) => {
    await installApiFixtures(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/kingdom.html");

    await expect(page.locator("#game")).toBeVisible();
    await expect(page.locator("#resources .resource")).toHaveCount(6);
    await expect(page.locator('#city .building[data-building="castle"]')).toBeVisible();
    await expect(page.locator("#trainButton")).toBeEnabled();

    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      cityWidth: document.getElementById("city").getBoundingClientRect().width,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.width + 1);
    expect(dimensions.cityWidth).toBeGreaterThan(300);
  });

  test("upgrade and training controls submit the expected game actions", async ({ page }) => {
    const { actions } = await installApiFixtures(page);
    await page.goto("/kingdom.html");
    await expect(page.locator("#game")).toBeVisible();

    await page.locator('#buildings [data-upgrade="farm"]').click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0]).toEqual({ type: "upgrade", building: "farm" });

    await page.locator("#unitType").selectOption("archer");
    await page.locator("#unitQuantity").fill("4");
    await page.locator("#trainButton").click();

    await expect.poll(() => actions.length).toBe(2);
    expect(actions[1]).toEqual({ type: "train", unit: "archer", quantity: 4 });
  });

  test("graphics preferences persist and 2D mode keeps mobile controls usable", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("coi_graphics_preference", "2d"));
    await installApiFixtures(page);
    await page.setViewportSize({width:360,height:740});
    await page.goto("/kingdom.html");
    await expect(page.locator("#game")).toBeVisible();
    await expect(page.locator("#coiGraphicsPreset")).toHaveValue("2d");
    await expect(page.locator("#coiGraphicsStatus")).toContainText("2D leve");
    await expect(page.locator("#city #kingdom3d")).toHaveCount(0);
    await expect(page.locator('#city .building[data-building="castle"]')).toBeVisible();
    await expect(page.locator("#coiGraphicsApply")).toBeDisabled();
    await page.locator("#coiGraphicsPreset").selectOption("low");
    await expect(page.locator("#coiGraphicsApply")).toBeEnabled();
    await page.locator("#coiGraphicsApply").click();
    await expect(page.locator("#coiGraphicsPreset")).toHaveValue("low");
    await expect(page.locator("#game")).toBeVisible();
    const saved = await page.evaluate(() => ({
      value:localStorage.getItem("coi_graphics_preference"),
      width:document.documentElement.scrollWidth,
      viewport:innerWidth
    }));
    expect(saved.value).toBe("low");
    expect(saved.width).toBeLessThanOrEqual(saved.viewport + 1);
  });

});
