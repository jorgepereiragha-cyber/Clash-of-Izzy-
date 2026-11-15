import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_RESEARCH,
  NORSE_SKINS,
  equipmentItemStats,
  equipmentBonuses
} from "../equipment-engine.js";

test("equipment catalog has unique ids and valid five-slot coverage",()=>{
  const ids=EQUIPMENT_CATALOG.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(new Set(EQUIPMENT_CATALOG.map(x=>x.slot)),new Set(["weapon","helmet","armor","boots","accessory"]));
});

test("equipment stats scale by level and stop at level 20",()=>{
  const item=EQUIPMENT_CATALOG.find(x=>x.id==="iron_sword");
  assert.deepEqual(equipmentItemStats(item,1),{attack:1.2,critical:0.2});
  assert.deepEqual(equipmentItemStats(item,2),{attack:1.55,critical:0.25});
  assert.deepEqual(equipmentItemStats(item,99),equipmentItemStats(item,20));
});

test("only equipped gear contributes to capped combat bonuses",()=>{
  const owned=[{item_key:"iron_sword",level:20},{item_key:"warden_plate",level:20},{item_key:"rune_spear",level:20}];
  const equipped=[{slot:"weapon",item_key:"iron_sword"},{slot:"armor",item_key:"warden_plate"}];
  const research=[{research_key:"gear_forging",level:10},{research_key:"gear_ward",level:10},{research_key:"gear_vitality",level:10}];
  const bonuses=equipmentBonuses(owned,equipped,research);
  assert.ok(bonuses.attackPercent>0&&bonuses.attackPercent<=30);
  assert.ok(bonuses.defensePercent>0&&bonuses.defensePercent<=30);
  assert.ok(bonuses.healthPercent>0&&bonuses.healthPercent<=25);
  assert.equal(bonuses.marchSpeedPercent,0);
});

test("Norse skins are distinct cosmetic catalog entries with no combat stats",()=>{
  assert.equal(NORSE_SKINS.length,5);
  assert.equal(new Set(NORSE_SKINS.map(x=>x.id)).size,5);
  for(const skin of NORSE_SKINS){
    assert.ok(skin.price>0);
    assert.ok(!("stats" in skin));
  }
});

test("equipment research has bounded progression and explicit academy costs",()=>{
  assert.equal(EQUIPMENT_RESEARCH.length,4);
  for(const tech of EQUIPMENT_RESEARCH){
    assert.equal(tech.max,10);
    assert.ok(tech.base.gold>0&&tech.base.stone>0);
  }
});
