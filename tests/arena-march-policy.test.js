import test from "node:test";
import assert from "node:assert/strict";
import { arenaMarchAvailability } from "../scripts/arena-march-policy.js";
const allDisabled={attack:false,gather:false,scout:false};
test("arena cannot offer ordinary marches to castles or throne",()=>{
 for(const target of [{territory_kind:"castle"},{territory_kind:"throne"},{territory_key:"royal_throne_1"},{territory_kind:"castle",owner_kingdom_id:7},null])assert.deepEqual(arenaMarchAvailability(target,7),allDisabled);
});
test("arena respects ownership and resource availability",()=>{
 const node={territory_kind:"resource",resource_type:"wood"};
 assert.deepEqual(arenaMarchAvailability(node,7),{attack:true,gather:true,scout:true});
 assert.deepEqual(arenaMarchAvailability({...node,owner_kingdom_id:7},7),{attack:false,gather:true,scout:true});
 assert.deepEqual(arenaMarchAvailability({...node,owner_kingdom_id:8},7),allDisabled);
 assert.deepEqual(arenaMarchAvailability({territory_kind:"monster"},7),{attack:true,gather:false,scout:true});
});
