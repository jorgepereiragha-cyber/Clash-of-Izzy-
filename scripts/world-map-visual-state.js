import { readMarchComposition } from "./march-visual-path.js";
// Render-only state keys: server ownership, coordinates, skins and timings remain authoritative.
const rows = value => Array.isArray(value) ? value : [];
const number = value => Number(value) || 0;
export function worldCastleTier(value) {
 const level=Number(value);
 return !Number.isFinite(level)?1:level>=30?4:level>=20?3:level>=10?2:1;
}
export function worldVisualKeys(state) {
 const territories=rows(state?.territories), throne=territories.some(r=>r.territory_kind==="throne");
 const home=JSON.stringify([throne,number(state?.castleSkinId),worldCastleTier(state?.castleLevel)]);
 const coordinates=territories.map(r=>[number(r.id),number(r.x),number(r.z)]);
 const landmarks=territories.map(r=>[number(r.id),number(r.x),number(r.z),number(r.owner_kingdom_id),r.territory_kind,r.terrain,r.resource_type,number(r.castle_skin_id),r.territory_kind==="castle"?worldCastleTier(r.castle_level??r.level):0]);
 const routes=JSON.stringify([throne,coordinates]);
 const features=JSON.stringify([number(state?.kingdomId),state?.throneShielded===true,landmarks]);
 const marches=JSON.stringify(rows(state?.marches).filter(r=>r.status==="marching"&&Number.isFinite(Date.parse(r.arrives_at||""))).slice(0,8).map(r=>[number(r.id),r.march_type,r.started_at,r.arrives_at,number(r.target_territory_id),readMarchComposition(r.units_json)]));
 return {home,routes,features,marches};
}
