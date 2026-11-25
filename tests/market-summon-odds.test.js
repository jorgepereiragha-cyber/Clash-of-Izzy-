import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { getHeroSummonOdds } from "../hero-catalog.js";

const source=await readFile(new URL("../market.js",import.meta.url),"utf8");
async function render(odds){
 const roots=new Map();
 function element(tag){
  return {tag,dataset:{},children:[],textContent:"",disabled:false,
   append(...items){this.children.push(...items);},
   replaceChildren(...items){this.children=items;},
   get childElementCount(){return this.children.length;},
   addEventListener(){}};
 }
 const document={getElementById(id){if(!roots.has(id))roots.set(id,element("root"));return roots.get(id);},createElement:element,addEventListener(){}};
 const window={localStorage:{getItem(){return "test-session";}}};
 const state={heroSummonOdds:odds,player:{gems:1000},kingdom:{},shop:{},queues:[]};
 runInNewContext(source,{document,window,fetch:async()=>({ok:true,json:async()=>({state})})});
 await new Promise(resolve=>setImmediate(resolve));
 return roots.get("hero-recruitment").children;
}
test("market uses authoritative recruitment odds and all four rarities",async()=>{
 const cards=await render(getHeroSummonOdds());
 assert.equal(cards.length,2);
 for(const card of cards){
  const text=card.children.map(x=>x.textContent).join(" ");
  for(const expected of ["55% Branco","30% Azul","13% Roxo","2% Dourado"])assert.ok(text.includes(expected),text);
  assert.equal(card.children.find(x=>x.tag==="button").disabled,false);
 }
 const changed=await render([{rarity:"white",chancePercent:40},{rarity:"blue",chancePercent:30},{rarity:"purple",chancePercent:20},{rarity:"gold",chancePercent:10}]);
 assert.ok(changed[0].children.some(x=>x.textContent.includes("10% Dourado")));
});
test("market fails closed when odds are absent, duplicated or inconsistent",async()=>{
 for(const odds of [undefined,[],[{rarity:"gold",chancePercent:100}],getHeroSummonOdds().map(x=>({...x,chancePercent:1})),getHeroSummonOdds().map(x=>({...x,rarity:"gold"}))]){
  const cards=await render(odds);
  assert.equal(cards.length,2);
  for(const card of cards){
   assert.ok(card.children.some(x=>x.textContent.includes("Probabilidades indisponíveis")));
   assert.equal(card.children.find(x=>x.tag==="button").disabled,true);
  }
 }
});
