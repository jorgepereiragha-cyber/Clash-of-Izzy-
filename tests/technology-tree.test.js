import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTechnologyBonuses,
  technologyLevelCap,
  technologyAcademyRequirement,
  calculateTechnologyResearchCost,
  calculateTechnologyResearchDuration
} from "../technology-rules.js";

test("technology effects scale by kingdom level and stay within defined caps",()=>{
  const bonuses=calculateTechnologyBonuses([
    {effect_json:'{"infantry_attack":0.05,"march_speed":0.02}',level:3},
    {effect_json:'{"food_production":0.1,"wall_defense":0.03}',level:2}
  ]);
  assert.equal(bonuses.infantryAttackPercent,15);
  assert.equal(bonuses.marchSpeedPercent,6);
  assert.equal(bonuses.foodProductionPercent,20);
  assert.equal(bonuses.wallDefensePercent,6);
  assert.equal(calculateTechnologyBonuses([
    {effect_json:'{"infantry_attack":0.5,"wall_defense":0.5}',level:10}
  ]).infantryAttackPercent,50);
  assert.equal(calculateTechnologyBonuses([
    {effect_json:'{"wall_defense":0.5}',level:10}
  ]).wallDefensePercent,30);
});

test("academy unlocks three technology levels per academy level",()=>{
  assert.equal(technologyLevelCap(10,0),0);
  assert.equal(technologyLevelCap(10,1),3);
  assert.equal(technologyLevelCap(10,2),6);
  assert.equal(technologyLevelCap(8,10),8);
  assert.equal(technologyAcademyRequirement(1),1);
  assert.equal(technologyAcademyRequirement(4),2);
  assert.equal(technologyAcademyRequirement(10),4);
});

test("technology research cost and time increase predictably by level",()=>{
  assert.equal(calculateTechnologyResearchCost(500,0),500);
  assert.equal(calculateTechnologyResearchCost(500,1),775);
  assert.equal(calculateTechnologyResearchDuration(300,0),300);
  assert.equal(calculateTechnologyResearchDuration(300,1),405);
  assert.equal(calculateTechnologyResearchCost(-10,0),0);
  assert.equal(calculateTechnologyResearchDuration(0,0),30);
});

test("invalid or malformed catalog effects are ignored safely",()=>{
  const bonuses=calculateTechnologyBonuses([
    {effect_json:"not-json",level:5},
    {effect_json:'["invalid"]',level:5},
    {effect_json:'{"infantry_attack":-0.5}',level:5},
    {effect_json:'{"infantry_attack":"nope"}',level:5}
  ]);
  assert.equal(bonuses.infantryAttackPercent,0);
});
