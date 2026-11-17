import { test, expect } from "@playwright/test";

test.describe("Landing install guide", () => {
  test("opens with focus on the dialog container and keeps the close control keyboard reachable", async ({ page }) => {
    await page.goto("/");

    const modal = page.locator("#install-modal");
    await page.locator("#install-button").click();

    await expect(modal).toBeVisible();
    await expect(modal).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator(".install-close")).toBeFocused();
    await expect(page.locator(".install-close")).toHaveAttribute("aria-label", "Fechar instruções");
  });

  test("close and Entendi both dismiss the guide without leaving page scroll locked", async ({ page }) => {
    await page.goto("/");

    const modal = page.locator("#install-modal");
    const initialScrollStyles = await page.evaluate(() => ({
      body: document.body.style.overflow,
      root: document.documentElement.style.overflow,
    }));

    await page.locator("#install-button").click();
    await expect(modal).toBeVisible();
    await page.locator(".install-close").click();
    await expect(modal).toBeHidden();

    let scrollStyles = await page.evaluate(() => ({
      body: document.body.style.overflow,
      root: document.documentElement.style.overflow,
    }));
    expect(scrollStyles).toEqual(initialScrollStyles);

    await page.locator("#install-button").click();
    await expect(modal).toBeVisible();
    await page.locator("#install-confirm").click();
    await expect(modal).toBeHidden();

    scrollStyles = await page.evaluate(() => ({
      body: document.body.style.overflow,
      root: document.documentElement.style.overflow,
    }));
    expect(scrollStyles).toEqual(initialScrollStyles);
  });
});
