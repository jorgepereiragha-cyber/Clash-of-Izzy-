import { test, expect } from "@playwright/test";

test("Android layouts stay within the screen and keep primary touch targets at 48px", async ({ page }) => {
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 600, height: 960 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/kingdom.html");
    const metrics = await page.evaluate(() => {
      const button = document.querySelector(".coi-nav-search button");
      const field = document.querySelector("#coi-nav-query");
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        buttonHeight: button ? button.getBoundingClientRect().height : 0,
        fieldHeight: field ? field.getBoundingClientRect().height : 0,
        navMounted: Boolean(document.querySelector(".coi-global-nav")),
        androidCss: [...document.styleSheets].some(sheet => sheet.href?.includes("/styles/android-experience.css")),
        runtimeScript: Boolean(document.querySelector('script[src="/scripts/pwa-runtime.js"]')),
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(48);
    expect(metrics.fieldHeight).toBeGreaterThanOrEqual(48);
    expect(metrics.navMounted).toBe(true);
    expect(metrics.androidCss).toBe(true);
    expect(metrics.runtimeScript).toBe(true);
  }
});

test("Android runtime announces offline and restored connectivity accessibly", async ({ page }) => {
  await page.goto("/");
  const status = page.locator("#coi-runtime-status");
  await expect(status).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(status).toBeVisible();
  await expect(status).toContainText("Sem conexão");
  await expect(status).toHaveAttribute("role", "status");

  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(status).toContainText("Conexão restabelecida");
});


test("Android world map supports one-finger pan and two-finger pinch zoom", async ({ page }) => {
  const token = "android-world-map-fixture";
  await page.addInitScript(value => {
    window.localStorage.setItem("coi_game_token", value);
  }, token);

  const state = {
    kingdom: {
      id: 77,
      kingdom_name: "Eldoria",
      food: 1000,
      wood: 1000,
      stone: 1000,
      iron: 1000,
      gold: 1000,
      equipped_skin_id: 0,
    },
    territories: [{
      id: 501,
      name: "Bosque do Norte",
      x: 12,
      z: -8,
      terrain: "forest",
      resource_type: "wood",
      resource_rate: 100,
      level: 1,
      owner_kingdom_id: null,
    }],
    troops: [{ unit_type: "militia", quantity: 100, tier: 1 }],
    marches: [],
  };

  await page.route("**/api/game/state", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state }),
  }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/world.html");
  await expect(page.locator("#worldMap")).toBeVisible();
  await expect(page.locator("#worldMap .territory-pin")).toHaveCount(1);

  const map = page.locator("#worldMap");
  const bounds = await map.boundingBox();
  expect(bounds).not.toBeNull();
  // At 100% the map exactly fills its viewport, so no pan range exists yet.
  await page.locator("#zoomIn").click();
  await page.locator("#zoomIn").click();
  await expect(page.locator("#mapScale")).toHaveText("150%");

  const gestureX = bounds.x + bounds.width * 0.2;
  const gestureY = bounds.y + bounds.height * 0.72;
  const client = await page.context().newCDPSession(page);
  const beforePan = await page.locator("#mapContent").evaluate(node => node.style.transform);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: gestureX, y: gestureY, id: 11 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: gestureX + 30, y: gestureY + 18, id: 11 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(() => page.locator("#mapContent").evaluate(node => node.style.transform))
    .not.toBe(beforePan);

  await page.locator("#mapReset").click();
  await expect(page.locator("#mapScale")).toHaveText("100%");

  const pinchY = bounds.y + bounds.height * 0.2;
  const pinchX1 = bounds.x + bounds.width * 0.3;
  const pinchX2 = bounds.x + bounds.width * 0.6;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: pinchX1, y: pinchY, id: 21 },
      { x: pinchX2, y: pinchY, id: 22 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: bounds.x + bounds.width * 0.225, y: pinchY, id: 21 },
      { x: bounds.x + bounds.width * 0.675, y: pinchY, id: 22 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(() => page.locator("#mapScale").textContent())
    .toBe("150%");
  await client.detach();
});
