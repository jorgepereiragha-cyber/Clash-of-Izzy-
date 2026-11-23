import { test, expect } from "@playwright/test";

test("events shows account recovery instead of crashing or creating a realm when browser storage is blocked", async ({ page }) => {
  let created = 0;
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === "coi_game_token") throw new DOMException("Storage denied", "SecurityError");
      return get.call(this, key);
    };
  });
  await page.route("**/api/game/start", route => { created++; return route.abort(); });
  await page.goto("/events.html");
  await expect(page.locator("#eventStatus")).toContainText("bloqueou o armazenamento");
  await expect(page.locator("#eventStatus a[href='/account.html']")).toBeVisible();
  await expect(page.locator("#attack")).toBeDisabled();
  expect(created).toBe(0);
});

test("events use a valid sessionStorage token when localStorage refuses reads", async ({ page }) => {
  const authorizations = [];
  await page.addInitScript(() => {
    sessionStorage.setItem("coi_game_token", "synthetic-event-session");
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === "coi_game_token" && this === localStorage)
        throw new DOMException("Storage denied", "SecurityError");
      return get.call(this, key);
    };
  });
  await page.route("**/api/game/state", route => {
    authorizations.push(route.request().headers().authorization);
    return route.fulfill({
      status: 401, contentType: "application/json",
      body: '{"error":"Sessão sintética inválida para teste"}'
    });
  });
  await page.goto("/events.html");
  await expect(page.locator("#message")).toContainText("Sessão sintética inválida para teste");
  expect(authorizations).toEqual(["Bearer synthetic-event-session"]);
});
