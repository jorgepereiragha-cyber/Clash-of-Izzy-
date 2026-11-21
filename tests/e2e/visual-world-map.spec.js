import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("world map obeys local 2D graphics choice and keeps tactical pins on Android", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("coi_graphics_preference", "2d");
    localStorage.setItem("coi_game_token", "world-visual-fixture");
  });
  await page.route("**/api/game/state", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({state:{
      kingdom:{id:77,kingdom_name:"Eldoria QA",food:2000,wood:1500,stone:1300,iron:1000,gold:500,map_x:0,map_z:0},
      player:{name:"QA Visual",gems:0},
      troops:[],territories:[
        {id:1,name:"Bosque de Teste",x:5,y:5,terrain:"forest",owner_kingdom_id:null}
      ],marches:[],queues:[]
    }})
  }));
  await page.setViewportSize({width:360,height:740});
  await page.goto("/world.html");
  await expect(page.locator("#worldGraphicsStatus")).toContainText("2D leve");
  await expect(page.locator("#worldMap")).toHaveClass(/map-3d-fallback/);
  await expect(page.locator("#world3d")).toBeHidden();
  await expect(page.getByRole("link", {name:"Ajustes de imagem"})).toHaveAttribute("href","/kingdom.html#coiGraphicsPreset");
  expect(await page.evaluate(() => Boolean(window.__coiWorldMap3D))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(361);
  await mkdir("test-results/visual-preview", {recursive:true});
  await page.locator("#worldMap").screenshot({path:"test-results/visual-preview/mapa-360px-2d.png"});
});
