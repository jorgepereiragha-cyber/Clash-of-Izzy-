// Read-only beta map preview. No attack or reward is exposed by this module.
export const worldMonstersEnabled=env=>env?.ENVIRONMENT==="beta"&&env?.GAME_4X_SYSTEMS_ENABLED==="true";
export async function worldMonsterPreview(env,playerId){
 if(!worldMonstersEnabled(env))return {enabled:false,combatEnabled:false,monsters:[]};
 const kingdom=await env.DB.prepare("SELECT k.map_region FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?").bind(playerId).first();
 if(!kingdom)return null;
 const region=Number(kingdom.map_region)||1;
 if(!Number.isSafeInteger(region)||region<1||region>3)return null;
 const result=await env.DB.prepare("SELECT id,monster_key,name,level,x,z,max_hp,hp,respawn_at FROM world_monsters WHERE map_region=? ORDER BY level,id LIMIT 50").bind(region).all();
 return {enabled:true,combatEnabled:false,region,monsters:result.results||[]};
}
