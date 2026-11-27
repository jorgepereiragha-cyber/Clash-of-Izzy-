import { test, expect } from "@playwright/test";

test("mercado usa sessão preservada no sessionStorage quando localStorage falha", async ({page}) => {
  const headers=[];
  await page.addInitScript(() => {
    sessionStorage.setItem("coi_game_token","session-storage-only-token");
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key){
      if(key==="coi_game_token" && this===localStorage)throw new DOMException("Access denied","SecurityError");
      return original.call(this,key);
    };
  });
  await page.route("**/api/game/state", route => {
    headers.push(route.request().headers()["authorization"]);
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      state:{player:{gems:0},kingdom:{food:0,wood:0,stone:0,iron:0,gold:0},
        shop:{items:{},exchangeOffers:[],offers:[],inventory:[]},heroShop:{offers:[]},queues:[]}
    })});
  });
  await page.goto("/market.html");
  await expect(page.locator("#market-status")).toContainText("Mercado sincronizado");
  expect(headers).toEqual(["Bearer session-storage-only-token"]);
});

test("Mercador, Loja de Heróis e aceleradores funcionam no viewport Android", async ({ page }) => {
  const now = new Date();
  const completesAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const state = {
    player: { gems: 1200 },
    kingdom: { food: 50000, wood: 50000, stone: 50000, iron: 50000, gold: 50000 },
    shop: {
      cycle: 100,
      serverTime: now.getTime(),
      refreshAt: now.getTime() + 60 * 60 * 1000,
      items: {
        acc_5min: { name: "Acelerador 5 min", icon: "⚡", desc: "Acelera construção", price: 20, currency: "gems", category: "accelerators" },
        acc_1h: { name: "Acelerador 1 hora", icon: "⚡", desc: "Acelera construção", price: 50, currency: "gems", category: "accelerators" }
      },
      exchangeOffers: [{
        id: "wood_acc_5min", name: "Madeira por aceleração",
        description: "Troque madeira excedente por 5 minutos de construção.",
        costs: { wood: 2500 }, reward: { item: "acc_5min", quantity: 1 },
        rewardName: "Acelerador 5 min", stock: 3
      }, {
        id: "expensive", name: "Materiais de construção", costs: {wood: 52000},
        reward: { item: "acc_1h", quantity: 1 }, stock: 1
      }],
      offers: [{id:"food_large",name:"Celeiro Real",price:7000,currency:"gold",stock:2,originalPrice:10000,discount:30}],
      inventory: [{ item_id: "acc_5min", quantity: 1 }, { item_id: "hero_exp", quantity: 1 }]
    },
    heroSummonOptions: [{quantity:1,cost:100},{quantity:10,cost:900}],
    heroSummonOdds: [{rarity:"white",chancePercent:55},{rarity:"blue",chancePercent:30},{rarity:"purple",chancePercent:13},{rarity:"gold",chancePercent:2}],
    heroInventory: [{hero_key:"kael_sunwarden",name:"Kael",level:2,max_level:50,portrait_symbol:"kael"}],
    heroShop: {
      offers: [{
        id: "hero_frag_kael_sunwarden", heroKey: "kael_sunwarden",
        name: "Kael · Guardião do Sol", rarity: "purple", stars: 2,
        fragments: 12, quantity: 5, costs: { gold: 14500, food: 18000 },
        stock: 1, description: "Fragmentos para evoluir este herói"
      }]
    },
    queues: [{
      id: 42, queue_type: "construction", target_key: "castle",
      status: "running", started_at: now.toISOString(), completes_at: completesAt
    }]
  };
  const actions = [];
  await page.addInitScript(() => localStorage.setItem("coi_game_token", "market-e2e-session"));
  await page.route("**/api/game/state", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ state })
  }));
  await page.route("**/api/game/action", async route => {
    const action=route.request().postDataJSON();
    actions.push(action);
    const battle=action.type==="hero_summon"?{summons:[{name:"Kael",result_type:"duplicate",fragments:15}]}:undefined;
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, state, battle })
    });
  });

  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/market.html");
  await expect(page.getByRole("heading", { name: "Mercador de Eldoria" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loja de Heróis", exact: true })).toBeVisible();
  await expect(page.getByText("Kael · Guardião do Sol")).toBeVisible();
  await expect(page.getByRole("button", { name: "Acelerador 5 min × 1", exact: true })).toBeVisible();
  await expect(page.getByText("Construção · castle")).toBeVisible();
  await page.locator(".coi-nav-toggle").click();
  await expect(page.getByRole("link", { name: /Mercador & Heróis/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await expect(page.locator("#summon-odds")).toContainText("13% Épico · 2% Lendário");
  const goldOffer=page.locator("#merchant-specials article").filter({hasText:"Celeiro Real"});
  await expect(goldOffer).toContainText("7.000 ouro");
  await expect(goldOffer.getByRole("button")).toBeEnabled();
  const collectionLink=page.getByRole("link",{name:"2.000 madeira"});
  await expect(collectionLink).toHaveAttribute("href","/world.html?coleta=forest#resource-nodes");
  await page.getByLabel("Só ofertas que posso trocar").check();
  await expect(collectionLink).toHaveCount(0);
  await page.getByRole("button", { name: "TROCAR RECURSOS" }).click();
  await expect(page.locator("#market-status")).toContainText("Troca concluída");
  expect(actions[0]).toEqual({ type: "merchant_exchange", offerId: "wood_acc_5min",cycle:100 });

  await page.getByRole("button", { name: "CONVOCAR 1 HERÓI" }).click();
  await expect(page.locator("#market-status")).toContainText("Convocação concluída");
  await expect(page.locator("#summon-results")).toContainText("+15 fragmentos");
  expect(actions[1]).toEqual({ type: "hero_summon", quantity: 1 });

  await page.getByRole("button", { name: "COMPRAR FRAGMENTOS" }).click();
  await expect(page.locator("#market-status")).toContainText("Fragmentos comprados");
  expect(actions[2]).toEqual({ type: "hero_shop_buy", heroKey: "kael_sunwarden",cycle:100 });

  await page.getByRole("button", { name: /Acelerador 5 min/ }).click();
  await expect(page.locator("#market-status")).toContainText("Acelerador aplicado");
  expect(actions[3]).toEqual({ type: "queue_speedup", queueId: 42, itemId: "acc_5min", quantity: 1 });

  await goldOffer.getByRole("button").click();
  await expect(page.locator("#market-status")).toContainText("Compra concluída");
  expect(actions[4]).toEqual({type:"shop_buy",source:"merchant",item:"food_large",cycle:100});
  await page.getByRole("button",{name:"USAR LIVRO"}).click();
  await expect(page.locator("#market-status")).toContainText("Experiência aplicada");
  expect(actions[5]).toEqual({type:"hero_use_exp_book",heroKey:"kael_sunwarden"});
});

test("caravana renova automaticamente pelo relógio do servidor",async ({page})=>{
  await page.clock.install();
  await page.addInitScript(()=>localStorage.setItem("coi_game_token","market-e2e-session"));
  let reads=0;
  const now=Date.UTC(2026,10,27,15);
  await page.route("**/api/game/state",route=>{
    reads++;
    const offer={id:"food_large",name:"Caravana "+reads,price:7000,currency:"gold",stock:1};
    const shop={cycle:reads,serverTime:now,refreshAt:now+(reads===1?3000:3600000),offers:[offer]};
    return route.fulfill({json:{state:{shop,kingdom:{gold:8000}}}});
  });
  await page.goto("/market.html");
  await expect(page.getByRole("heading",{name:"Caravana 1"})).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(page.getByRole("heading",{name:"Caravana 2"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Caravana 1"})).toHaveCount(0);
  expect(reads).toBe(2);
});
