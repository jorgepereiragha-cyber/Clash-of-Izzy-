import test from "node:test";
import assert from "node:assert/strict";
import {DRAGON_CATALOG} from "../dragon-catalog.js";
import {DRAGON_PALETTES,projectDragonVisual,poseDragon,dragonHoverOffset} from "../scripts/kingdom-dragon-visual.js";
test("nine canonical equipped dragons have visual palettes; invalid keys fail closed",()=>{
 assert.deepEqual(Object.keys(DRAGON_PALETTES).sort(),DRAGON_CATALOG.map(d=>d.key).sort());
 assert.equal(projectDragonVisual(null),null);
 assert.equal(projectDragonVisual({dragon_key:"constructor"}),null);
 for(const d of DRAGON_CATALOG){
  const a=projectDragonVisual({dragon_key:d.key,level:1}),b=projectDragonVisual({dragon_key:d.key,level:1000});
  assert.equal(b.level,100);assert.equal(a.key,d.key);assert.ok(b.scale>a.scale);
  assert.equal(projectDragonVisual({dragon_key:d.key,level:Infinity}).level,1);
 }
});
test("wings are mirrored and reduced motion gives a fixed pose",()=>{
 const figure={wings:[{wing:{rotation:{}},sign:-1},{wing:{rotation:{}},sign:1}]};
 poseDragon(figure,1,true);
 assert.equal(figure.wings[0].wing.rotation.z,-figure.wings[1].wing.rotation.z);
 poseDragon(figure,500,false);
 assert.equal(figure.wings[1].wing.rotation.z,.18);
});

test("dragon flight articulates tail and pitch without position drift, static mode resets",()=>{
 const tail=[{mesh:{position:{},rotation:{}},index:2}];
 const figure={wings:[],tail,root:{rotation:{}}};
 poseDragon(figure,1,true);const previous=tail[0].mesh.position.x;
 assert.notEqual(previous,0);poseDragon(figure,1,true);assert.equal(tail[0].mesh.position.x,previous);
 assert.ok(Math.abs(dragonHoverOffset(2,true))<=.09);assert.equal(dragonHoverOffset(Infinity,true),0);
 poseDragon(figure,2,false);assert.equal(tail[0].mesh.position.x,0);assert.equal(figure.root.rotation.x,0);assert.equal(dragonHoverOffset(2,false),0);
});
