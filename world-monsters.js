// Beta map preview with lazy respawn. No attack or reward is exposed.
export const worldMonstersEnabled=env=>env?.ENVIRONMENT==="beta"&&env?.GAME_4X_SYSTEMS_ENABLED==="true";
// Lazy, server-authoritative respawn; no rewards or troop mutations.
// Concurrent reads can only restore each generation once because hp=0 is
// rechecked in the same SQL statement. A missing timer never respawns a spawn.
export async function respawnDueMonsters(env,region,now=Math.floor(Date.now()/1000)){
 if(!worldMonstersEnabled(env)||!Number.isSafeInteger(region)||region<1||region>3||!Number.isSafeInteger(now)||now<1)return 0;
 const result=await env.DB.prepare("UPDATE world_monsters SET hp=max_hp,respawn_at=0,generation=generation+1 WHERE map_region=? AND hp=0 AND respawn_at>0 AND respawn_at<=?").bind(region,now).run();
 return Number(result.meta?.changes)||0;
}
export async function worldMonsterPreview(env,playerId){
 if(!worldMonstersEnabled(env))return {enabled:false,combatEnabled:false,monsters:[]};
 const kingdom=await env.DB.prepare("SELECT k.map_region FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?").bind(playerId).first();
 if(!kingdom)return null;
 const region=Number(kingdom.map_region)||1;
 if(!Number.isSafeInteger(region)||region<1||region>3)return null;
 await respawnDueMonsters(env,region);
 const result=await env.DB.prepare("SELECT id,monster_key,name,level,x,z,max_hp,hp,respawn_at,generation FROM world_monsters WHERE map_region=? ORDER BY level,id LIMIT 50").bind(region).all();
 return {enabled:true,combatEnabled:false,region,monsters:result.results||[]};
}
