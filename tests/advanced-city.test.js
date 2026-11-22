import test from "node:test";
import assert from "node:assert/strict";
import {
 castleVisualTier,unlockedCitySize,rotatedFootprint,rectanglesOverlap,
 validateCityPosition,proximityBuffs,projectedCityProduction
} from "../advanced-city.js";

test("castle tier respects 1–30 without changing VIP progression",()=>{
 assert.deepEqual([1,3,4,6,7,9,10,30].map(castleVisualTier),[1,1,2,2,3,3,4,4]);
 assert.deepEqual([1,9,10,19,20,30].map(unlockedCitySize),[20,20,30,30,50,50]);
});
test("rotated footprints and rectangle edges are exact",()=>{
 assert.deepEqual(rotatedFootprint(3,2,0),{width:3,height:2});
 assert.deepEqual(rotatedFootprint(3,2,90),{width:2,height:3});
 assert.deepEqual(rotatedFootprint(3,2,270),{width:2,height:3});
 assert.equal(rotatedFootprint(3,2,45),null);
 const a={id:1,grid_x:20,grid_y:20,width:5,height:5};
 assert.equal(rectanglesOverlap(a,{grid_x:25,grid_y:20,width:2,height:2}),false);
 assert.equal(rectanglesOverlap(a,{grid_x:24,grid_y:24,width:2,height:2}),true);
 assert.equal(validateCityPosition([a],24,24,2,2,20).valid,false);
 assert.equal(validateCityPosition([a],25,24,2,2,20).valid,true);
 assert.equal(validateCityPosition([a],20,20,5,5,20,1).valid,true);
 assert.equal(validateCityPosition([a],14,20,1,1,20).valid,false);
 assert.equal(validateCityPosition([a],34,34,2,2,20).valid,false);
 assert.equal(validateCityPosition([a],1.5,1,2,2,20).valid,false);
});
test("buffs use footprint distances, cap stacking, and ignore pending works",()=>{
 const done=new Date(Date.now()-60000).toISOString(),later=new Date(Date.now()+60000).toISOString();
 const buildings=[
  {building_type:"barracks",grid_x:0,grid_y:0,width:3,height:3,finishes_at:done},
  {building_type:"blacksmith",grid_x:3,grid_y:0,width:2,height:2,finishes_at:done},
  {building_type:"warehouse",grid_x:8,grid_y:1,width:2,height:2,finishes_at:done},
  {building_type:"farm",grid_x:10,grid_y:1,width:2,height:2,finishes_at:done},
  {building_type:"market",grid_x:8,grid_y:3,width:2,height:2,finishes_at:done},
  {building_type:"blacksmith",grid_x:0,grid_y:5,width:2,height:2,finishes_at:later}
 ];
 const b=proximityBuffs(buildings);
 assert.equal(b.attack_bonus,0.1);
 assert.equal(b.storage_bonus,0.05);
 assert.equal(b.production_bonus,0.1);
});
function structure(type,input,output,inputRate,outputRate,workers=1,finished=null){
 return {building_type:type,input_resource:input,output_resource:output,
  input_rate:inputRate,output_rate:outputRate,workers_required:workers,
  workers_assigned:workers,level:1,finishes_at:finished||new Date(Date.now()-7200000).toISOString()};
}
const stock=()=>({wheat:0,flour:0,iron_ore:0,weapons:0,food_credit:0,iron_credit:0});
test("production chain consumes intermediates once and settles food / iron",()=>{
 const now=Date.now(),rows=[
  structure("farm",null,"wheat",0,100),
  structure("iron_mine",null,"iron_ore",0,40,2),
  structure("mill","wheat","flour",100,80),
  structure("bakery","flour","food",80,60),
  structure("smelter","iron_ore","iron",40,30,2),
  structure("forge","iron","weapons",30,20,2)
 ];
 const result=projectedCityProduction(rows,stock(),{iron:0},now-3600000,now,100);
 assert.equal(result.foodGain,60);
 assert.equal(result.ironGain,30);
 assert.equal(result.ironSpent,30);
 assert.equal(result.deltas.weapons,20000);
 assert.equal(result.deltas.wheat,0);
 assert.equal(result.deltas.flour,0);
 assert.equal(result.deltas.iron_ore,0);
});
test("unallocated workers halt production; future buildings never produce early",()=>{
 const now=Date.now(),farm=structure("farm",null,"wheat",0,100);
 farm.workers_assigned=0;
 const none=projectedCityProduction([farm],stock(),{iron:10},now-3600000,now);
 assert.equal(none.deltas.wheat,0);
 farm.workers_assigned=1;farm.finishes_at=new Date(now+3600000).toISOString();
 const future=projectedCityProduction([farm],stock(),{iron:10},now-3600000,now);
 assert.equal(future.deltas.wheat,0);
 farm.finishes_at=new Date(now-1800000).toISOString();
 const half=projectedCityProduction([farm],stock(),{iron:10},now-3600000,now);
 assert.equal(half.deltas.wheat,50000);
});
test("fractional iron stays in fixed-point stock and cannot be awarded twice",()=>{
 const now=Date.now();
 const rows=[structure("iron_mine",null,"iron_ore",0,40,2),
  structure("smelter","iron_ore","iron",40,30,2)];
 const a=projectedCityProduction(rows,stock(),{iron:0},now-300000,now);
 assert.equal(a.ironGain,2);
 assert.equal(a.deltas.iron_credit,500);
 const carry=stock();carry.iron_credit=500;
 const b=projectedCityProduction(rows,carry,{iron:2},now-300000,now);
 assert.equal(b.ironGain,3);
 assert.equal(b.deltas.iron_credit,-500);
 assert.equal(a.ironGain+b.ironGain,5);
});
