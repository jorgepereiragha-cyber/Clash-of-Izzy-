import {COMBAT_UNIT_RULES,calculateMarchDuration} from "./game-adapter.js";
import {withinMarchCapacity} from "./march-capacity.js";
import {marchSlots} from "./march-slots.js";
import {evaluateMonsterHunt} from "./monster-hunt-policy.js";
// All snapshot fields except units must originate from the server. Do not wire
// this to a public dispatch until shared regular-march slots and settlement exist.
export function planMonsterDispatch({env,kingdom,monster,progress=null,units,capacity,militaryLevel=0,now,id,speedBonus=0}={}){
 if(env?.ENVIRONMENT!=="beta"||env?.GAME_4X_SYSTEMS_ENABLED!=="true")return {ok:false,code:"DISABLED"};
 if(!Number.isSafeInteger(kingdom?.id)||kingdom.id<1||typeof id!=="string"||!id.match(/^[a-zA-Z0-9-]{16,64}$/))return {ok:false,code:"INVALID_ID"};
 if(!units||typeof units!=="object"||Array.isArray(units)||!Number.isSafeInteger(capacity)||capacity<1||capacity>200000)return {ok:false,code:"INVALID_UNITS"};
 const keys=Object.keys(units);
 if(!keys.length||keys.some(key=>!Object.hasOwn(COMBAT_UNIT_RULES,key)||!Number.isSafeInteger(units[key])||units[key]<1||units[key]>10000)||!withinMarchCapacity(units,capacity))return {ok:false,code:"INVALID_UNITS"};
 if(progress!==null&&(!Number.isSafeInteger(progress.revision)||progress.revision<0||progress.kingdom_id!==kingdom.id))return {ok:false,code:"INVALID_PROGRESS"};
 const eligibility=evaluateMonsterHunt({monster,kingdomRegion:Number(kingdom.map_region)||1,clearedLevel:progress?.cleared_level??0,energyRow:progress,now});
 if(!eligibility.ok)return eligibility;
 return {ok:true,id,kingdomId:kingdom.id,region:Number(kingdom.map_region)||1,monsterId:monster.id,generation:monster.generation,monsterHp:monster.hp,level:monster.level,progress:progress?{revision:progress.revision,energy:progress.energy,updatedAt:progress.updated_at,clearedLevel:progress.cleared_level}:null,unitsJson:JSON.stringify(Object.fromEntries(keys.sort().map(key=>[key,units[key]]))),unitTypes:keys.length,slots:marchSlots({castleLevel:kingdom.castle_level,militaryLevel}).max,energyCost:eligibility.energyCost,energyAfter:eligibility.energyAfter,energyUpdatedAt:eligibility.energyUpdatedAt,now,arrivesAt:now+calculateMarchDuration(120,speedBonus)};
}
// Execute these three statements only as one transactional D1 batch. An
// ineligible snapshot inserts no march, so later changes() guards mutate nothing.
// A duplicate march ID aborts the whole batch rather than spending twice.
export function monsterDispatchStatements(db,p){
 if(!p?.ok)throw Error("Invalid hunt dispatch plan");
 const snapshot=p.progress;
 const progressGuard=snapshot
  ?"EXISTS(SELECT 1 FROM monster_hunt_progress WHERE kingdom_id=? AND revision=? AND energy=? AND updated_at=? AND cleared_level=?)"
  :"NOT EXISTS(SELECT 1 FROM monster_hunt_progress WHERE kingdom_id=?)";
 const progressArgs=snapshot?[p.kingdomId,snapshot.revision,snapshot.energy,snapshot.updatedAt,snapshot.clearedLevel]:[p.kingdomId];
 const insert=db.prepare("INSERT INTO monster_hunt_marches(id,kingdom_id,monster_id,monster_generation,units_json,energy_cost,started_at,arrives_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM world_monsters m JOIN kingdoms k ON k.id=? WHERE m.id=? AND m.generation=? AND m.hp=? AND m.level=? AND m.respawn_at=0 AND m.map_region=COALESCE(NULLIF(k.map_region,0),1) AND m.map_region=?) AND "+progressGuard+" AND ((SELECT COUNT(*) FROM marches WHERE kingdom_id=? AND status='marching')+(SELECT COUNT(*) FROM monster_hunt_marches WHERE kingdom_id=? AND status='marching'))<? AND (SELECT COUNT(*) FROM json_each(?) r JOIN army_units a ON a.kingdom_id=? AND a.tier=1 AND a.unit_type=r.key WHERE a.quantity>=CAST(r.value AS INTEGER))=?")
  .bind(p.id,p.kingdomId,p.monsterId,p.generation,p.unitsJson,p.energyCost,p.now,p.arrivesAt,p.kingdomId,p.monsterId,p.generation,p.monsterHp,p.level,p.region,...progressArgs,p.kingdomId,p.kingdomId,p.slots,p.unitsJson,p.kingdomId,p.unitTypes);
 const debit=db.prepare("UPDATE army_units SET quantity=quantity-CAST((SELECT value FROM json_each(?) WHERE key=army_units.unit_type) AS INTEGER) WHERE kingdom_id=? AND tier=1 AND unit_type IN (SELECT key FROM json_each(?)) AND changes()=1")
  .bind(p.unitsJson,p.kingdomId,p.unitsJson);
 const energy=db.prepare("INSERT INTO monster_hunt_progress(kingdom_id,energy,updated_at,cleared_level,revision) SELECT ?,?,?,?,1 WHERE changes()=? ON CONFLICT(kingdom_id) DO UPDATE SET energy=excluded.energy,updated_at=excluded.updated_at,revision=monster_hunt_progress.revision+1")
  .bind(p.kingdomId,p.energyAfter,p.energyUpdatedAt,snapshot?.clearedLevel??0,p.unitTypes);
 return [insert,debit,energy];
}
