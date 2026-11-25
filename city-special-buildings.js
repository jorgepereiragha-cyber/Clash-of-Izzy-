import { CITY_FOOTPRINTS,CITY_GRID_MIN,CITY_GRID_MAX } from "./city-layout-rules.js";
export const SPECIAL_CITY_CATALOG=Object.freeze({
 dragon_nest:Object.freeze({name:"Ninho de Dragões",width:3,height:3}),
 summon_altar:Object.freeze({name:"Altar de Convocação",width:3,height:3})
});
const size=dim=>"CASE b.building_type "+Object.entries(CITY_FOOTPRINTS).map(([type,fp])=>"WHEN '"+type+"' THEN "+fp[dim]).join(" ")+" ELSE 5 END";
const clear="NOT EXISTS(SELECT 1 FROM kingdom_buildings b WHERE b.kingdom_id=? AND b.position_x<? AND b.position_x+("+size("width")+")>? AND b.position_z<? AND b.position_z+("+size("height")+")>?) AND NOT EXISTS(SELECT 1 FROM city_defenses d WHERE d.kingdom_id=? AND d.grid_x<? AND d.grid_x+d.width>? AND d.grid_z<? AND d.grid_z+d.height>?) AND NOT EXISTS(SELECT 1 FROM city_special_buildings s WHERE s.kingdom_id=? AND s.building_type<>? AND s.grid_x<? AND s.grid_x+s.width>? AND s.grid_z<? AND s.grid_z+s.height>?)";
export async function positionSpecialCityBuilding(env,kingdomId,body){
 const type=body?.building,x=body?.gridX,z=body?.gridZ;
 if(typeof type!=="string"||!Object.hasOwn(SPECIAL_CITY_CATALOG,type)||!Number.isSafeInteger(x)||!Number.isSafeInteger(z)||x<CITY_GRID_MIN||z<CITY_GRID_MIN||x+3>CITY_GRID_MAX||z+3>CITY_GRID_MAX)
  return {ok:false,status:400,error:"Estrutura ou posição inválida."};
 const bounds=[x+3,x,z+3,z],args=[kingdomId,...bounds,kingdomId,...bounds,kingdomId,type,...bounds];
 let statement;
 if(body.fromX===null&&body.fromZ===null){
  statement=env.DB.prepare("INSERT INTO city_special_buildings(kingdom_id,building_type,grid_x,grid_z) SELECT ?,?,?,? WHERE "+clear+" ON CONFLICT(kingdom_id,building_type) DO NOTHING").bind(kingdomId,type,x,z,...args);
 }else{
  if(!Number.isSafeInteger(body.fromX)||!Number.isSafeInteger(body.fromZ))return {ok:false,status:400,error:"Posição anterior inválida."};
  statement=env.DB.prepare("UPDATE city_special_buildings SET grid_x=?,grid_z=? WHERE kingdom_id=? AND building_type=? AND grid_x=? AND grid_z=? AND "+clear).bind(x,z,kingdomId,type,body.fromX,body.fromZ,...args);
 }
 const result=await statement.run();
 return result?.meta?.changes===1?{ok:true,building:type,gridX:x,gridZ:z}:{ok:false,status:409,error:"Local ocupado ou posição desatualizada."};
}
