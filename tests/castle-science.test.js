import test from "node:test";
import assert from "node:assert/strict";
import {SCIENCE_CATALOG,scienceEnabled,scienceView,sciencePercent,scienceDuration,hospitalScienceCapacity} from "../castle-science.js";
test("science requires completed prerequisites and academy levels; effects bounded",()=>{
 assert.equal(scienceEnabled({ENVIRONMENT:"production",GAME_4X_SYSTEMS_ENABLED:"true"}),false);
 const empty=scienceView([],1);assert.ok(empty.every(x=>!x.available));
 const ready=scienceView([{research_key:"economy",level:1}],1);
 assert.equal(ready.find(x=>x.key==="scholarship").available,true);
 assert.equal(ready.find(x=>x.key==="field_logistics").available,false);
 assert.equal(Object.keys(SCIENCE_CATALOG).length,4);
 assert.equal(sciencePercent("scholarship",999),15);
 assert.equal(scienceDuration(100,"conscription",10),85);
 assert.equal(sciencePercent("field_logistics",10),10);
 assert.equal(hospitalScienceCapacity(30,10),3600);
 assert.equal(hospitalScienceCapacity(0,10),0);
 assert.equal(sciencePercent("__proto__",10),0);
});
