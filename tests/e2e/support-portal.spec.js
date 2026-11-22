import { test, expect } from "@playwright/test";

test("campaign stays transparent and cannot collect payments before configuration", async ({ page }) => {
  await page.route("**/support-link.json", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ enabled: false })
  }));
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: /Ajude a construir o próximo capítulo/ })).toBeVisible();
  await expect(page.getByText("Arrecadação verificada:")).toBeVisible();
  const link = page.locator("#support-payment-link");
  await expect(link).toHaveAttribute("aria-disabled", "true");
  await expect(link).not.toHaveAttribute("href");
  await expect(page.getByText(/Contribuições financeiras ainda não estão habilitadas/)).toBeVisible();
  await expect(page.locator('a[href="/portal"]')).toHaveCount(3);
});

test("only an explicitly configured official Mercado Pago link enables voluntary payment", async ({ page }) => {
  const officialUrl = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=example";
  await page.route("**/support-link.json", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ enabled: true, url: officialUrl })
  }));
  await page.goto("/support");
  const link = page.locator("#support-payment-link");
  await expect(link).toHaveAttribute("href", officialUrl);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText(/Link disponível. O valor final e o titular devem ser conferidos/)).toBeVisible();
});

test("forged payment-link response is rejected by the browser", async ({ page }) => {
  await page.route("**/support-link.json", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ enabled: true, url: "https://mercadopago.com.br.evil.example/checkout" })
  }));
  await page.goto("/support");
  const link = page.locator("#support-payment-link");
  await expect(link).toHaveAttribute("aria-disabled", "true");
  await expect(link).not.toHaveAttribute("href");
});
