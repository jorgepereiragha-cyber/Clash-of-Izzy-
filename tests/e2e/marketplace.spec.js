import { test, expect } from "@playwright/test";

test("Mercador, Loja de Heróis e aceleradores funcionam no viewport Android", async ({ page }) => {
  const now = new Date();
  const completesAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const state = {
    player: { gems: 1200 },
    kingdom: { food: 50000, wood: 50000, stone: 50000, iron: 50000, gold: 50000 },
    shop: {
      cycle: 100,
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
      }],
      offers: [],
      inventory: [{ item_id: "acc_5min", quantity: 1 }]
    },
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
    actions.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, state })
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

  await page.getByRole("button", { name: "TROCAR RECURSOS" }).click();
  await expect(page.locator("#market-status")).toContainText("Troca concluída");
  expect(actions[1]).toEqual({ type: "merchant_exchange", offerId: "wood_acc_5min" });

  await page.getByRole("button", { name: "CONVOCAR 1 HERÓI" }).click();
  await expect(page.locator("#market-status")).toContainText("Convocação concluída");
  expect(actions[0]).toEqual({ type: "hero_summon", quantity: 1 });

  await page.getByRole("button", { name: "COMPRAR FRAGMENTOS" }).click();
  await expect(page.locator("#market-status")).toContainText("Fragmentos comprados");
  expect(actions[2]).toEqual({ type: "hero_shop_buy", heroKey: "kael_sunwarden" });

  await page.getByRole("button", { name: /Acelerador 5 min/ }).click();
  await expect(page.locator("#market-status")).toContainText("Acelerador aplicado");
  expect(actions[3]).toEqual({ type: "queue_speedup", queueId: 42, itemId: "acc_5min", quantity: 1 });
});
