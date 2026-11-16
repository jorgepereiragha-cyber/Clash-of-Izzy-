import { test, expect } from "@playwright/test";

const SESSION_TOKEN = "playwright-visual-audit-session";

function makeVisualAuditState() {
  return {
    player: {
      player_id: "visual-audit-player",
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
    queues: [],
    troops: [{ unit_type: "militia", tier: 1, quantity: 15 }],
    armyCount: 15,
    troopCapacity: 1000,
    research: [],
    marches: [],
    territories: [
      {
        id: 900,
        name: "Pedreira do Norte",
        territory_kind: "resource",
        resource_type: "stone",
        terrain: "mountain",
        x: -18,
        z: 8,
        owner_kingdom_id: null,
        resource_rate: 120,
        level: 2,
      },
      {
        id: 901,
        name: "Castelo de Eldoria",
        territory_kind: "castle",
        resource_type: "food",
        terrain: "plains",
        x: 0,
        z: 0,
        owner_kingdom_id: 77,
        commander_name: "ComandanteTeste",
        power: 1450,
        castle_level: 3,
      },
    ],
    recentEvents: [],
    alliance: null,
    dragon: null,
    pets: [],
    petGold: 0,
    battleReports: [],
  };
}

async function installVisualFixtures(page) {
  const state = makeVisualAuditState();

  await page.addInitScript(token => {
    window.localStorage.setItem("coi_game_token", token);
  }, SESSION_TOKEN);

  await page.route("**/api/game/state", async route => {
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Ação simulada para auditoria visual." }),
    });
  });

  await page.route("**/api/game/rally/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    const payload = pathname.endsWith("/nodes")
      ? {
          nodes: [{
            id: "mina-norte",
            node_type: "mine",
            level: 2,
            current_resources: 720,
            max_resources: 1500,
            occupied_by: null,
            is_mine: false,
            reserved_by_rally: false,
            map_x: -24,
            map_y: 16,
          }],
        }
      : { rallies: [], in_alliance: false };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

async function attachScreenshot(page, testInfo, name, options = {}) {
  const image = await page.screenshot({
    fullPage: false,
    animations: "disabled",
    ...options,
  });
  await testInfo.attach(name + ".png", {
    body: image,
    contentType: "image/png",
  });
}

async function attachLayoutMetrics(page, testInfo, name, selectors) {
  const configuredViewport = page.viewportSize();
  const metrics = await page.evaluate(({ items, configuredViewport: configured }) => {
    const rect = element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
        bottom: Math.round(box.bottom),
        visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0,
      };
    };
    const visual = window.visualViewport;

    return {
      configuredViewport: configured,
      viewport: { width: innerWidth, height: innerHeight },
      visualViewport: visual ? {
        width: Math.round(visual.width),
        height: Math.round(visual.height),
        scale: Number(visual.scale.toFixed(3)),
        offsetTop: Math.round(visual.offsetTop),
      } : null,
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      devicePixelRatio: window.devicePixelRatio,
      elements: Object.fromEntries(items.map(selector => [
        selector,
        [...document.querySelectorAll(selector)].map(rect),
      ])),
    };
  }, { items: selectors, configuredViewport });

  await testInfo.attach(name + "-layout.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
}

async function expectTouchTargetsAtLeast44(page, selectors) {
  const undersized = await page.evaluate(items => items.flatMap(selector => {
    return [...document.querySelectorAll(selector)].flatMap(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || box.width <= 0 || box.height <= 0) return [];
      if (box.width >= 44 && box.height >= 44) return [];
      return [{
        selector,
        width: Math.round(box.width),
        height: Math.round(box.height),
        text: (element.textContent || "").trim().slice(0, 60),
      }];
    });
  }), selectors);
  expect(undersized, "Interactive mobile controls must provide at least a 44x44 CSS-pixel target").toEqual([]);
}

test.describe("Mobile visual audit captures", () => {
  test("captures the kingdom dashboard and thumb-zone metrics", async ({ page }, testInfo) => {
    await installVisualFixtures(page);
    await page.goto("/kingdom.html");

    await expect(page.locator("#game")).toBeVisible();
    await expect(page.locator("#kingdomName")).toHaveText("Reino de Eldoria");
    await expect(page.locator("#trainButton")).toBeVisible();
    await expectTouchTargetsAtLeast44(page, [
      "#trainButton",
      "#researchButton",
      "#buildings button[data-upgrade]",
      "#coi-recorder-toggle",
    ]);

    await attachScreenshot(page, testInfo, "kingdom-mobile", {
      mask: [page.locator(".queue-remaining")],
    });
    await attachLayoutMetrics(page, testInfo, "kingdom-mobile", [
      "#trainButton",
      '#buildings [data-upgrade="farm"]',
      "#unitQuantity",
      "#city",
      "#coi-recorder-toggle",
    ]);
  });


  test("keeps the training submit action in view when quantity receives focus", async ({ page }) => {
    await installVisualFixtures(page);
    await page.goto("/kingdom.html");
    await expect(page.locator("#game")).toBeVisible();

    await page.locator("#unitQuantity").focus();
    const viewport = page.viewportSize();
    await expect.poll(async () => {
      const box = await page.locator("#trainButton").boundingBox();
      return Boolean(box && box.y >= 0 && box.y + box.height <= viewport.height);
    }, { timeout: 5_000 }).toBe(true);
    await expect(page.locator("#trailer-recorder-panel")).toHaveClass(/is-keyboard-open/);
  });

  test("captures the world map, territory pins and side panel", async ({ page }, testInfo) => {
    await installVisualFixtures(page);
    await page.goto("/world.html");

    await expect(page.locator("#worldMap")).toBeVisible();
    await expect(page.locator("#status")).toContainText("Reino sincronizado");
    await expect(page.locator(".territory-pin")).toHaveCount(2);
    await expect(page.locator(".territory-title")).toContainText("Pedreira do Norte");
    await expectTouchTargetsAtLeast44(page, [
      "#zoomIn",
      "#zoomOut",
      "#mapReset",
      ".territory-pin",
      "#gather",
      "#scout",
      "#attack",
    ]);

    await attachScreenshot(page, testInfo, "world-map-mobile");
    await attachLayoutMetrics(page, testInfo, "world-map-mobile", [
      "#worldMap",
      "#zoomIn",
      "#zoomOut",
      "#mapReset",
      ".territory-pin",
      "#territoryDetails",
      "#gather",
      "#scout",
      "#attack",
    ]);
  });

  test("captures the arena HUD, skills and touch controls", async ({ page }, testInfo) => {
    await page.goto("/arena.html");

    await expect(page.locator("#hud")).toBeVisible();
    await expect(page.locator("#objective")).toBeVisible();
    await expect(page.locator("#skills .skill")).toHaveCount(4);
    await expect(page.locator("#joystick")).toBeVisible();
    await expect(page.locator("#rightActions")).toBeVisible();
    await expectTouchTargetsAtLeast44(page, [
      "#skills .skill",
      "#attack",
      "#openShop",
    ]);

    await attachScreenshot(page, testInfo, "arena-mobile");
    await attachLayoutMetrics(page, testInfo, "arena-mobile", [
      "#skills .skill",
      "#joystick",
      "#attack",
      "#openShop",
      "#hud",
      "#objective",
    ]);
  });

  test("captures the Valhalla shop opened over the kingdom", async ({ page }, testInfo) => {
    await installVisualFixtures(page);

    await page.route("**/api/config/valhalla", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active: true }),
      });
    });

    await page.route("**/api/game/valhalla-shop/catalog", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          active: true,
          player_runes: 420,
          catalog: [{
            id: "visual-audit-pack",
            category: "troop_pack",
            name: "Guarda de Eldoria",
            description: "Pacote de tropas lendárias para a auditoria visual.",
            cost_runes: 120,
            remaining_stock: 12,
            is_featured: 1,
          }],
        }),
      });
    });

    await page.goto("/kingdom.html");
    await expect(page.locator("#game")).toBeVisible();
    const openShop = page.locator("#valhalla-shop-btn");
    await expect(openShop).toBeVisible();
    await openShop.click();

    const overlay = page.locator("#valhalla-shop-overlay");
    await expect(overlay).toHaveClass(/is-open/);
    await expect(overlay.locator("article.va-shop-item")).toBeVisible();
    await expect(page.locator("#valhalla-shop-balance")).toHaveText("420");
    await expectTouchTargetsAtLeast44(page, [
      ".va-shop-close",
      ".va-shop-buy",
    ]);

    // Let the one-time seasonal toast leave the product area before the audit capture.
    await expect(page.locator(".va-shop-toast")).toHaveCount(0);

    // The modal must sit above the persistent recorder panel while the shop is open.
    const layerOrder = await page.evaluate(() => ({
      shop: Number.parseInt(getComputedStyle(document.querySelector("#valhalla-shop-overlay")).zIndex, 10),
      recorder: Number.parseInt(getComputedStyle(document.querySelector("#trailer-recorder-panel")).zIndex, 10),
    }));
    expect(layerOrder.shop).toBeGreaterThan(layerOrder.recorder);

    await attachScreenshot(page, testInfo, "valhalla-shop-mobile");
    await attachLayoutMetrics(page, testInfo, "valhalla-shop-mobile", [
      "#valhalla-shop-overlay",
      "#valhalla-shop-dialog",
      ".va-shop-close",
      ".va-shop-item",
      ".va-shop-buy",
    ]);
  });
});
