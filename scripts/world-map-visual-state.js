// Render-only state keys: server ownership, coordinates, skins and timings remain authoritative.
const rows = value => Array.isArray(value) ? value : [];
const number = value => Number(value) || 0;
export function worldVisualKeys(state) {
 const territories=rows(state?.territories), throne=territories.some(r=>r.territory_kind==="throne");
 const home=JSON.stringify([throne,number(state?.castleSkinId)]);
 const coordinates=territories.map(r=>[number(r.id),number(r.x),number(r.z)]);
 const landmarks=territories.map(r=>[number(r.id),number(r.x),number(r.z),number(r.owner_kingdom_id),r.territory_kind,r.terrain,r.resource_type,number(r.castle_skin_id)]);
 const routes=JSON.stringify([throne,coordinates]);
 const features=JSON.stringify([number(state?.kingdomId),state?.throneShielded===true,landmarks]);
 const marches=JSON.stringify(rows(state?.marches).filter(r=>r.status==="marching"&&Number.isFinite(Date.parse(r.arrives_at||""))).slice(0,8).map(r=>[number(r.id),r.march_type,r.started_at,r.arrives_at,number(r.target_territory_id)]));
 return {home,routes,features,marches};
}
