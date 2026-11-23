import { test, expect } from "@playwright/test";

test("arena never retries anonymous kingdom creation after an ambiguous startup failure", async ({ page }) => {
  let starts=0;
  await page.route("**/api/game/start",route=>{
    starts++;
    return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Banco temporariamente indisponível."})});
  });
  await page.goto("/arena.html");
  await expect(page.locator("#kingdomStatus")).toContainText("Banco temporariamente indisponível");
  await expect(page.locator("#retryArenaConnection")).toHaveCount(0);
  await expect(page.locator("#kingdomStatus").getByRole("link",{name:"Acessar minha conta"}))
    .toHaveAttribute("href","/account.html");
  expect(starts).toBe(1);
});

test("arena retries state for existing saved kingdom instead of founding another", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("coi_game_token","existing-synthetic-token"));
  let states=0,starts=0;
  await page.route("**/api/game/state",route=>{
    states++;
    return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Banco temporariamente indisponível."})});
  });
  await page.route("**/api/game/start",route=>{
    starts++;
    return route.fulfill({status:500,contentType:"application/json",body:"{}"});
  });
  await page.goto("/arena.html");
  const retry=page.locator("#retryArenaConnection");
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(()=>states).toBe(2);
  expect(starts).toBe(0);
});
