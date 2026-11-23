import {test,expect} from "@playwright/test";

test("ambiguous anonymous kingdom start does not expose a second create retry",async ({page})=>{
  let starts=0;
  await page.route("**/api/game/start",route=>{
    starts++;
    return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Banco D1 temporariamente indisponível"})});
  });
  await page.goto("/kingdom.html");
  await expect(page.locator("#loading")).toContainText("não repita automaticamente");
  await expect(page.locator("#retryConnection")).toHaveCount(0);
  await expect(page.locator("#loading").getByRole("link",{name:"Acessar minha conta"})).toHaveAttribute("href","/account.html");
  expect(starts).toBe(1);
});

test("previously authenticated kingdom keeps retry on temporary D1 error",async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("coi_game_token","synthetic-existing-realm-token"));
  let states=0,starts=0;
  await page.route("**/api/game/state",route=>{
    states++;
    return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Banco D1 temporariamente indisponível"})});
  });
  await page.route("**/api/game/start",route=>{starts++;return route.abort();});
  await page.goto("/kingdom.html");
  const retry=page.locator("#retryConnection");
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(()=>states).toBe(2);
  expect(starts).toBe(0);
});
