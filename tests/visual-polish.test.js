import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("camada de arte consistente é usada por heróis, equipamentos, mercado e arena",async()=>{
 const [styles,equipment,market,arena]=await Promise.all([
  read("styles/visual-polish.css"),read("equipment-ui.html"),read("market.html"),read("arena.html")
 ]);
 for(const html of [equipment,market,arena]){
  assert.match(html,/href="\/styles\/visual-polish\.css"/);
 }
 for(const selector of [
  ".hero-roster-card",'.hero-roster-card[data-hero-rarity="gold"]',
  ".equipment-tier-card.rarity-lendario", ".pantheon-relic-card",
  ".market-card[data-hero-rarity=", "#kingdomStore .storeCard"
 ]) assert.ok(styles.includes(selector),selector);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(styles,/:focus-visible/);
 assert.ok(!/https?:\/\/|@import|@font-face|@keyframes/.test(styles),"sem downloads ou animações pesadas");
});

test("a apresentação da raridade no mercado corresponde ao catálogo canônico",async()=>{
 const market=await read("market.js");
 assert.match(market,/purple:"Roxo · Épico"/);
 assert.match(market,/gold:"Dourado · Lendário"/);
 assert.match(market,/card\.dataset\.heroRarity=/);
 assert.doesNotMatch(market,/purple:"Lendário"/);
});

test("aperfeiçoamento não altera índices, atributos de combate ou integridade de arte",async()=>{
 const [styles,worker,hero,portrait]=await Promise.all([
  read("styles/visual-polish.css"),read("worker.js"),
  read("hero-catalog.js"),read("assets/art/heroes/portraits.svg")
 ]);
 assert.match(worker,/\/api\/health/);
 assert.match(hero,/HERO_RARITY/);
 assert.ok((portrait.match(/<symbol\b/g)||[]).length>=70);
 assert.doesNotMatch(styles,/display\s*:\s*none\s*!important/);
});
