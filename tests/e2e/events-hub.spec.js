import { test, expect } from "@playwright/test";

const SESSION_TOKEN = "playwright-events-fixture-session";

test("hub de sete eventos funciona em viewport Android estreito e identifica prêmios previstos", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(token => {
    window.localStorage.setItem("coi_game_token", token);
  }, SESSION_TOKEN);

  await page.route("**/api/game/state", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: { troops: [], inventoryItems: [] } })
  }));
  await page.route("**/api/game/event", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      event: { status: "active", boss_hp_remaining: 9000000000, boss_hp_total: 12000000000 },
      participant: { score: 0, attacks: 0, troops_lost: 0, rank: null },
      leaderboard: []
    })
  }));
  await page.route("**/api/config/valhalla", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ active: false, dailyRunesReward: 100 })
  }));

  await page.goto("/events.html");
  await expect(page.locator("#worldEventGrid .world-event-card")).toHaveCount(7);
  await expect(page.locator('[data-event-key="angel_of_death"] .world-event-status')).toHaveText("Em andamento");
  await expect(page.locator('[data-event-key="valhalla"] .world-event-status')).toHaveText("Desativado no servidor");
  await expect(page.locator('[data-event-key="shiva"]')).toContainText("Prévia de prêmios");
  await expect(page.locator('[data-event-key="khali"]')).toContainText("Prévia de prêmios");
  await expect(page.locator('[data-event-key="shiva"] .world-event-action')).toContainText("Integração em preparação");
  await expect(page.locator("#attack")).toBeDisabled();

  const layout = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    cardCount: document.querySelectorAll(".world-event-card").length,
    missingImages: [...document.querySelectorAll(".world-event-art")].filter(image => !image.complete || image.naturalWidth === 0).length
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.width + 1);
  expect(layout.cardCount).toBe(7);
  expect(layout.missingImages).toBe(0);
});
