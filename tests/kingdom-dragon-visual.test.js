import test from "node:test";
import assert from "node:assert/strict";
import {DRAGON_CATALOG} from "../dragon-catalog.js";
import {DRAGON_PALETTES,projectDragonVisual,makeImportedDragonFigure,poseDragon,disposeImportedDragonFigure} from "../scripts/kingdom-dragon-visual.js";
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

test("imported dragon uses the flight mixer and honors reduced motion",()=>{
 const times=[]; const figure={imported:true,mixer:{setTime(t){times.push(t);}}};
 poseDragon(figure,2.5,true);poseDragon(figure,100,false);
 assert.deepEqual(times,[2.5,0]);
});

test("disposing imported dragon releases clone resources but leaves shared geometry and textures alone",()=>{
 const calls=[]; const root={};
 const figure={root,mixer:{stopAllAction(){calls.push("stop");},uncacheRoot(r){assert.equal(r,root);calls.push("uncache");}},skeletons:[{dispose(){calls.push("skeleton");}}],materials:[{dispose(){calls.push("material");},map:{dispose(){assert.fail("shared texture disposed");}}}]};
 disposeImportedDragonFigure(figure);assert.deepEqual(calls,["stop","uncache","skeleton","material"]);
});

test("all equipped dragons receive distinct proportions without changing the shared template", () => {
 const template = { geometry: {} };
 class Color { lerp() { return this; } }
 class AnimationMixer { clipAction() { return { play() {} }; } }
 const scales = new Set();
 for (const {key} of DRAGON_CATALOG) {
  const root = {
   scale: { set(...values) { scales.add(values.join(",")); } },
   rotation: {}, userData: {}, traverse() {}
  };
  const figure = makeImportedDragonFigure(
   { Color, AnimationMixer },
   source => { assert.equal(source, template); return root; },
   { template, animations: [{name:"flight"}], animation:"flight" },
   projectDragonVisual({dragon_key:key, level:1})
  );
  assert.equal(figure.root.userData.coIDragonKey, key);
 }
 assert.equal(scales.size, DRAGON_CATALOG.length);
 assert.deepEqual(template, {geometry:{}});
});
