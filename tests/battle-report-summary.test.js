import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const html=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
const start=html.indexOf("function battleReportSummary(data){"),end=html.indexOf("let battleReplayRequest=0;",start);
const summary=new Function("fmt",html.slice(start,end)+"\nreturn battleReportSummary;")(n=>String(n));
test("battle report shows only recorded authoritative modifiers and totals",()=>{
 const result=summary({result:{attacker_power:123,defender_power:90,losses:{archer:2,mage:3}},replay:{outcome:{rounds:4},modifiers:{hero:{attackPercent:2.5},equipment:{defense:1.5}}}});
 for(const s of ["Poder atacante","123","Baixas do atacante",">5<","Herói","2.5%","Equipamentos","1.5%","Dragão","Não registrado neste replay."])assert.ok(result.includes(s),s);
 assert.doesNotMatch(result,/NaN|Infinity|undefined/);
});
test("missing or malformed replay data does not invent zero bonuses or render untrusted labels",()=>{
 const s=summary({replay:{modifiers:{hero:{attackPercent:"<img onerror=x>"},dragon:{healthPercent:Infinity}},outcome:{losses:{archer:-1}}}});
 assert.doesNotMatch(s,/onerror|Infinity|>0%<|Baixas do atacante/);
 assert.match(s,/Não registrado neste replay/);
});
test("replay requests use raw IDs and only the latest response renders",()=>{
 assert.match(html,/data-battle-replay="'\+String\(replayId\)/);
 assert.match(html,/if\(requestId!==battleReplayRequest\)return/);
 assert.match(html,/Vitória do atacante/);
});
