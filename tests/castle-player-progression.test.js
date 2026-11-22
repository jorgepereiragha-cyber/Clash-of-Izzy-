import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CASTLE_TIERS,getCastleTier,getCastleProgression} from "../castle-progression.js";
import {PLAYER_PHASES,MAX_PLAYER_XP,calculateXPRequired,getPlayerProgression,experienceForCompletedQueue} from "../player-progression.js";

test("castle tiers are contiguous and bounded 1–30",()=>{
 assert.deepEqual(CASTLE_TIERS.map(t=>[t.from,t.to]),[[1,5],[6,10],[11,20],[21,30]]);
 assert.deepEqual([1,5,6,10,11,20,21,30].map(getCastleTier),[1,1,2,2,3,3,4,4]);
 assert.equal(getCastleProgression(31).level,30);
 assert.equal(getCastleProgression(30).nextTierAt,null);
 assert.equal(getCastleTier(NaN),1);
});
test("80 levels and eight deterministic phases; no XP overflow",()=>{
 assert.equal(PLAYER_PHASES.length,8);
 assert.equal(calculateXPRequired(1),1000);
 assert.equal(calculateXPRequired(2),1200);
 assert.equal(calculateXPRequired(80),0);
 let total=0;
 for(let level=1;level<=80;level++){
  const result=getPlayerProgression(total);
  assert.equal(result.level,level);
  assert.equal(result.phase,"P"+(Math.floor((level-1)/10)+1));
  assert.equal(result.experience,0);
  total+=calculateXPRequired(level);
 }
 assert.equal(getPlayerProgression(MAX_PLAYER_XP+10).level,80);
 assert.equal(getPlayerProgression(-100).level,1);
 assert.equal(getPlayerProgression("invalid").level,1);
});
test("XP is limited to valid server-side queues",()=>{
 assert.equal(experienceForCompletedQueue({queue_type:"construction",to_level:6}),600);
 assert.equal(experienceForCompletedQueue({queue_type:"research",to_level:2}),160);
 assert.equal(experienceForCompletedQueue({queue_type:"training",quantity:100}),500);
 for(const q of [{queue_type:"training",quantity:10000},{queue_type:"training",quantity:2.5},
 {queue_type:"construction",to_level:31},{queue_type:"pvp",quantity:100},null])
  assert.equal(experienceForCompletedQueue(q),0);
});
test("Worker uses authenticated state, completion token and additive D1 schema",async()=>{
 const w=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 const m=await readFile(new URL("../migrations/0040_kingdom_player_progression.sql",import.meta.url),"utf8");
 const v=await readFile(new URL("../scripts/kingdom-3d.js",import.meta.url),"utf8");
 assert.match(w,/getPlayerProgression\(stateResults\[15\]/);
 assert.match(w,/experienceForCompletedQueue\(queue\)/);
 assert.match(w,/INSERT INTO kingdom_player_progression\(kingdom_id,total_xp,updated_at\) SELECT \?,\?,CURRENT_TIMESTAMP WHERE "\+guard/);
 assert.doesNotMatch(w,/\/progression\/add-xp/);
 assert.match(m,/kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms\(id\)/);
 assert.doesNotMatch(m,/DROP TABLE|ALTER TABLE players|ALTER TABLE kingdoms/i);
 assert.match(v,/getCastleTier\(level\)/);
 assert.match(v,/castleTier===4/);
 assert.match(v,/b\.building_type==="castle"\?null:glbTemplates/);
});
