import { test, expect } from "@playwright/test";

const releases = "https://api.github.com/repos/jorgepereiragha-cyber/Clash-of-Izzy-/releases/latest";
const prefix = "https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases/download/v1.2.3/";
const apk = "clash-of-izzy-android.apk";

test("Android: homepage is a promotional download portal, never a web-game entry", async ({ page }) => {
  await page.route(releases, route => route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "{}" }));
  await page.goto("/");
  // Workers Static Assets canonicalizes /portal.html to /portal.
  await expect(page).toHaveURL(/\/portal(?:\.html)?$/);
  await expect(page.locator("h1")).toHaveText("CLASH OF IZZY");
  const button = page.locator("#download-apk");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).not.toHaveAttribute("href", /./);
  await expect(page.locator("a[href='/kingdom.html'],a[href='/world.html'],a[href='/arena.html']")).toHaveCount(0);
  await expect(page.getByText("O APK oficial ainda não está disponível")).toBeVisible();
});

test("Android: only signed release names on official GitHub download host are offered", async ({ page }) => {
  await page.route(releases, route => route.fulfill({
    status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json",
    body: JSON.stringify({
      draft: false, prerelease: false, tag_name: "v1.2.3",
      assets: [
        { name: apk, state: "uploaded", size: 4000000, browser_download_url: prefix + apk },
        { name: apk + ".sha256", state: "uploaded", size: 96, browser_download_url: prefix + apk + ".sha256" }
      ]
    })
  }));
  await page.goto("/portal.html");
  const download = page.locator("#download-apk");
  await expect(download).toHaveAttribute("href", prefix + apk);
  await expect(download).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#checksum-link")).toHaveAttribute("href", prefix + apk + ".sha256");
  await expect(page.getByText("Versão v1.2.3 disponível")).toBeVisible();
});

test("Android: reject download redirection to another domain even if release metadata contains an asset", async ({ page }) => {
  await page.route(releases, route => route.fulfill({
    status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json",
    body: JSON.stringify({
      draft: false, prerelease: false, tag_name: "v1.2.3",
      assets: [
        { name: apk, state: "uploaded", size: 4000000, browser_download_url: "https://evil.example/app.apk" },
        { name: apk + ".sha256", state: "uploaded", size: 96, browser_download_url: prefix + apk + ".sha256" }
      ]
    })
  }));
  await page.goto("/portal.html");
  await expect(page.locator("#download-apk")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#download-apk")).not.toHaveAttribute("href", /./);
});
