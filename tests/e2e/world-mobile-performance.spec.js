import { test, expect } from "@playwright/test";

test("low-memory mobile forces 2D without downloading or importing Three.js world", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 2 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 4 });
    // Even a saved high preference cannot override the low-memory safety gate.
    localStorage.setItem("coi_graphics_preference", "high");
  });
  let worldModuleRequests = 0;
  await page.route("**/world-map-3d.js", route => {
    worldModuleRequests++;
    return route.abort();
  });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/world.html");
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
  await expect(page.locator("html")).not.toHaveClass(/force-2d-map/);
  await expect(page.locator("#worldGraphicsStatus")).toContainText("Mapa 3D");
  await expect(page.locator("#world3d")).toHaveAttribute("data-loaded", "true");
  expect(worldModuleRequests).toBe(1);
});
