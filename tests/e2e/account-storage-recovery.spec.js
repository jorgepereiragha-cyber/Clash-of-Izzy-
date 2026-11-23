import { test, expect } from "@playwright/test";

test("account blocks new realm creation when neither browser storage can save the token", async ({ page }) => {
  let created = 0;
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key === "coi_game_token" || key === "coi_account_storage_probe")
        throw new DOMException("Storage denied", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key === "coi_game_token" || key === "coi_account_storage_probe")
        throw new DOMException("Storage denied", "SecurityError");
      return set.call(this, key, value);
    };
  });
  await page.route("**/api/game/start", route => { created++; return route.abort(); });
  await page.route("**/api/account/google/config", route => route.fulfill({
    status: 200, contentType: "application/json", body: '{"enabled":false,"clientId":null}'
  }));
  await page.goto("/account.html");
  await expect(page.locator("#accountStatus")).toContainText("Nenhum reino está conectado");
  await page.locator("#registerUsername").fill("StorageQA");
  await page.locator("#registerPassword").fill("Teste-Forte-2026!");
  await page.locator("#registerPasswordConfirm").fill("Teste-Forte-2026!");
  await page.locator("#registerButton").click();
  await expect(page.locator("#accountStatus")).toContainText("bloqueou o armazenamento");
  expect(created).toBe(0);
});

test("account recovers a session in sessionStorage after localStorage refuses token reads", async ({ page }) => {
  const tokens = [];
  await page.addInitScript(() => {
    sessionStorage.setItem("coi_game_token", "protected-session-only");
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === "coi_game_token" && this === localStorage)
        throw new DOMException("Storage denied", "SecurityError");
      return get.call(this, key);
    };
  });
  await page.route("**/api/account/status", route => {
    tokens.push(route.request().headers().authorization);
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        hasAccount: true, googleLinked: false,
        account: { username: "StorageQA", emailMasked: null }
      })
    });
  });
  await page.route("**/api/account/google/config", route => route.fulfill({
    status: 200, contentType: "application/json", body: '{"enabled":false,"clientId":null}'
  }));
  await page.goto("/account.html");
  await expect(page.locator("#accountStatus")).toContainText("Conta vinculada: StorageQA");
  expect(tokens).toEqual(["Bearer protected-session-only"]);
});

test("account logout reports unconfirmed revocation even when local token removal fails", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("coi_game_token", "protected-session-only");
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      if (key === "coi_game_token" && this === localStorage)
        throw new DOMException("Storage denied", "SecurityError");
      return remove.call(this, key);
    };
  });
  await page.route("**/api/account/status", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: '{"hasAccount":true,"googleLinked":false,"account":{"username":"StorageQA","emailMasked":null}}'
  }));
  await page.route("**/api/account/logout", route => route.fulfill({
    status: 503, contentType: "application/json", body: '{"error":"Banco indisponível"}'
  }));
  await page.route("**/api/account/google/config", route => route.fulfill({
    status: 200, contentType: "application/json", body: '{"enabled":false,"clientId":null}'
  }));
  await page.goto("/account.html");
  await expect(page.locator("#logoutButton")).toBeVisible();
  await page.locator("#logoutButton").click();
  await expect(page.locator("#accountStatus")).toContainText("não foi possível confirmar a revogação");
  await expect(page.locator("#accountStatus")).toContainText("um armazenamento local não pôde ser limpo");
  expect(await page.evaluate(() => sessionStorage.getItem("coi_game_token"))).toBe(null);
});
