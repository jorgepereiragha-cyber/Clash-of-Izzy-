import { test, expect } from "@playwright/test";

async function fixtureWorldState(page) {
  await page.route("**/api/game/state", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({state:{
      kingdom:{id:77,kingdom_name:"Eldoria Performance QA",food:2000,wood:1500,stone:1200,iron:900,gold:500,map_x:0,map_z:0},
      player:{name:"QA",gems:0},territories:[],troops:[],marches:[],queues:[]
    }})
  }));
}


test("low-memory mobile forces 2D without downloading or importing Three.js world", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 2 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 4 });
    // Even a saved high preference cannot override the low-memory safety gate.
    localStorage.setItem("coi_graphics_preference", "high");
    localStorage.setItem("coi_game_token", "world-performance-fixture");
  });
  await fixtureWorldState(page);
  let worldModuleRequests = 0;
  await page.route("**/world-map-3d.js", route => {
    worldModuleRequests++;
    return route.abort();
  });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/world.html");
  await expect(page).toHaveURL(/\/world(?:\.html)?$/);
  await expect(page.locator("html")).toHaveClass(/force-2d-map/);
  await expect(page.locator("#worldMap")).toHaveClass(/map-3d-fallback/);
  await expect(page.locator("#world3d")).toBeHidden();
  await expect(page.locator("#worldGraphicsStatus")).toContainText("baixa memória");
  expect(worldModuleRequests).toBe(0);
  expect(await page.evaluate(() => Boolean(window.__coiWorldMap3D))).toBe(false);
});

test("simulated desktop loads 3D just once through the existing lazy boot", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 8 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
    localStorage.setItem("coi_graphics_preference", "balanced");
    localStorage.setItem("coi_game_token", "world-performance-fixture");
  });
  let worldModuleRequests = 0;
  // Isolate the boot mechanics from the runner's software WebGL implementation.
  await page.route("**/world-map-3d.js", route => {
    worldModuleRequests++;
    return route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "window.__coiWorldMap3D={update(){},project(){},setProjectionButtons(){},setValhallaMode(){}};"
        + "window.dispatchEvent(new CustomEvent('coi:world-map-3d-ready'));"
    });
  });
  await page.goto("/world.html");
  await expect(page).toHaveURL(/\/world(?:\.html)?$/);
  await expect(page.locator("html")).not.toHaveClass(/force-2d-map/);
  await expect(page.locator("#worldGraphicsStatus")).toContainText("Mapa 3D");
  await expect(page.locator("#world3d")).toHaveAttribute("data-loaded", "true");
  expect(worldModuleRequests).toBe(1);
});
