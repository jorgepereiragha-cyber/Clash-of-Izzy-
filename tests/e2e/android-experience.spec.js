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
      const button = document.querySelector("button");
      const field = document.querySelector('input:not([type="checkbox"]):not([type="radio"])');
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        buttonHeight: button ? button.getBoundingClientRect().height : 0,
        fieldHeight: field ? field.getBoundingClientRect().height : 0,
        androidCss: [...document.styleSheets].some(sheet => sheet.href?.includes("/styles/android-experience.css")),
        runtimeScript: Boolean(document.querySelector('script[src="/scripts/pwa-runtime.js"]')),
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(48);
    expect(metrics.fieldHeight).toBeGreaterThanOrEqual(48);
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
