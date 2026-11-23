import {test, expect} from "@playwright/test";

test("kingdom reuses a sessionStorage token when localStorage is blocked", async ({page}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("coi_game_token","session-only-kingdom-token");
    const get=Storage.prototype.getItem;
    const set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){
      if(key==="coi_game_token" && this===localStorage)throw new DOMException("Blocked","SecurityError");
      return get.call(this,key);
    };
    Storage.prototype.setItem=function(key,value){
      if(key==="coi_game_token" && this===localStorage)throw new DOMException("Blocked","SecurityError");
      return set.call(this,key,value);
    };
  });
  let stateToken=null,starts=0;
  await page.route("**/api/game/state",route=>{
    stateToken=route.request().headers()["authorization"]||null;
    return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"D1 temporariamente indisponível"})});
  });
  await page.route("**/api/game/start",route=>{starts++;return route.abort();});
  await page.goto("/kingdom.html");
  await expect(page.locator("#loading")).toContainText("D1 temporariamente indisponível");
  await expect(page.locator("#retryConnection")).toBeVisible();
  expect(stateToken).toBe("Bearer session-only-kingdom-token");
  expect(starts).toBe(0);
});

test("kingdom avoids repeating an anonymous start when its response is ambiguous", async ({page}) => {
  let starts=0;
  await page.route("**/api/game/start",route=>{
    starts++;
    return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"D1 temporariamente indisponível"})});
  });
  await page.goto("/kingdom.html");
  await expect(page.locator("#loading")).toContainText("não a repita automaticamente");
  await expect(page.locator("#retryConnection")).toHaveCount(0);
  await expect(page.locator("#loading").getByRole("link",{name:"Acessar minha conta"})).toHaveAttribute("href","/account.html");
  expect(starts).toBe(1);
});

test("kingdom never creates a guest realm when both token stores are inaccessible", async ({page}) => {
  await page.addInitScript(() => {
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){
      if(key==="coi_game_token")throw new DOMException("Blocked","SecurityError");
      return get.call(this,key);
    };
  });
  let starts=0;
  await page.route("**/api/game/start",route=>{starts++;return route.abort();});
  await page.goto("/kingdom.html");
  await expect(page.locator("#loading")).toContainText("bloqueou o armazenamento");
  await expect(page.locator("#retryConnection")).toBeVisible();
  expect(starts).toBe(0);
});
