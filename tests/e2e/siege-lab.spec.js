import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("siege lab has functional mobile controls and an isolated deterministic outcome", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/siege-lab.html");
  await expect(page.locator("#siegeViewport")).toBeVisible();
  await mkdir("test-results/visual-preview", { recursive: true });
  await page.locator("#siegeViewport").screenshot({ path: "test-results/visual-preview/cerco-android-360px.png" });
  await expect(page.locator("#gateValue")).toHaveText("1.300");
  await expect(page.locator("#towerValue")).toHaveText("600");
  await page.locator("#attackGate").click();
  await expect(page.locator("#gateValue")).toHaveText("960");
  await expect(page.locator("#towerValue")).toHaveText("600");
  for (let i = 0; i < 10; i++) {
    if (await page.locator("#attackGate").isDisabled()) break;
    await page.locator("#attackGate").click();
  }
  await expect(page.locator("#siegeStatus")).toContainText("Fortificação dominada");
  await expect(page.locator("#attackGate")).toBeDisabled();
  await page.locator("#resetSiege").click();
  await expect(page.locator("#gateValue")).toHaveText("1.300");
  await expect(page.locator("#attackGate")).toBeEnabled();
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});
