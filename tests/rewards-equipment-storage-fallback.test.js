import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const engagement=await readFile(new URL("../player-engagement.js",import.meta.url),"utf8");
const equipment=await readFile(new URL("../equipment-system.js",import.meta.url),"utf8");

function getReader(source, name, end) {
  const start=source.indexOf("function "+name+"() {");
  const last=source.indexOf(end,start);
  assert.ok(start>=0&&last>start,"reader must be present: "+name);
  const text=source.slice(start,last);
  return (local,session)=>vm.runInNewContext(text+String.fromCharCode(10)+name+"()",{
    window:{localStorage:local,sessionStorage:session}
  });
}

test("engagement rewards preserve a valid session if localStorage is blocked",()=>{
  const get=getReader(engagement,"readEngagementToken","const token = readEngagementToken");
  const denied={getItem(){throw new Error("SecurityError")}};
  const valid={getItem(key){return key==="coi_game_token"?"game-session":null}};
  assert.equal(get(denied,valid),"game-session");
  assert.equal(get(valid,denied),"game-session");
  assert.equal(get(denied,denied),"");
  assert.ok(engagement.includes("const token = readEngagementToken;"));
});

test("equipment inventory uses the alternate saved session without creating a kingdom",()=>{
  const get=getReader(equipment,"readEquipmentToken","const requestedSkinSearch");
  const denied={getItem(){throw new Error("SecurityError")}};
  const valid={getItem(key){return key==="coi_game_token"?"equipment-session":null}};
  assert.equal(get(denied,valid),"equipment-session");
  assert.equal(get(valid,denied),"equipment-session");
  assert.equal(get(denied,denied),"");
  assert.ok(equipment.includes("token=readEquipmentToken();"));
  assert.ok(!equipment.includes("/game/start"),"inventory must never create new anonymous kingdoms");
});
