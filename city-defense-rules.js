// Defesas persistidas no D1; a autoridade de custo, grid e limite pertence ao Worker.
import { CITY_FOOTPRINTS,CITY_GRID_MIN,CITY_GRID_MAX } from "./city-layout-rules.js";

export const DEFENSE_CATALOG=Object.freeze({
  tower:Object.freeze({name:"Torre de vigia",width:2,height:2,minCastleLevel:5,wood:150,stone:240,iron:60,power:85}),
  trap:Object.freeze({name:"Armadilha",width:1,height:1,minCastleLevel:3,wood:70,stone:20,iron:30,power:25}),
  gate:Object.freeze({name:"Portão fortificado",width:3,height:1,minCastleLevel:7,wood:180,stone:300,iron:100,power:110})
});
const collides=(x,z,w,h,ox,oz,ow,oh)=>x<ox+ow&&x+w>ox&&z<oz+oh&&z+h>oz;
export function defenseLimit(type,castleLevel){
  const n=Math.max(1,Math.min(30,Math.floor(Number(castleLevel)||1)));
  if(type==="tower")return Math.min(6,1+Math.floor(n/5));
  if(type==="trap")return Math.min(16,3+Math.floor(n/2));
  if(type==="gate")return Math.min(2,1+Math.floor(n/20));
  return 0;
}
export function validateDefensePlacement(buildings=[],defenses=[],type,x,z,excludeId=null){
  const spec=DEFENSE_CATALOG[type];
  if(!spec||!Number.isSafeInteger(x)||!Number.isSafeInteger(z)||
    x<CITY_GRID_MIN||z<CITY_GRID_MIN||x+spec.width>CITY_GRID_MAX||z+spec.height>CITY_GRID_MAX)return false;
  for(const b of buildings){
    const fp=CITY_FOOTPRINTS[b.building_type];
    if(!fp)return false;
    if(collides(x,z,spec.width,spec.height,Number(b.position_x),Number(b.position_z),fp.width,fp.height))return false;
  }
  for(const d of defenses){
    if(Number(d.id)===Number(excludeId))continue;
    if(collides(x,z,spec.width,spec.height,Number(d.grid_x),Number(d.grid_z),Number(d.width),Number(d.height)))return false;
  }
  return true;
}
const buildingSizeCase=dim=>"CASE b.building_type "+Object.entries(CITY_FOOTPRINTS)
  .map(([type,size])=>"WHEN '"+type+"' THEN "+size[dim]).join(" ")+" ELSE 5 END";
const occupiedBuilding="NOT EXISTS(SELECT 1 FROM kingdom_buildings b WHERE b.kingdom_id=? AND b.position_x<? AND b.position_x+("+buildingSizeCase("width")+")>? AND b.position_z<? AND b.position_z+("+buildingSizeCase("height")+")>?)";
const occupiedDefense=(excludingId=false)=>"NOT EXISTS(SELECT 1 FROM city_defenses d WHERE d.kingdom_id=? "+
  (excludingId?"AND d.id<>? ":"")+"AND d.grid_x<? AND d.grid_x+d.width>? AND d.grid_z<? AND d.grid_z+d.height>?)";
function locationBounds(x,z,spec){
  return Number.isSafeInteger(x)&&Number.isSafeInteger(z)&&
    x>=CITY_GRID_MIN&&z>=CITY_GRID_MIN&&x+spec.width<=CITY_GRID_MAX&&z+spec.height<=CITY_GRID_MAX;
}
export async function placeCityDefense(env,kingdomId,body){
  const type=String(body?.defense||"");
  const spec=DEFENSE_CATALOG[type];
  const x=body?.gridX,z=body?.gridZ;
  if(!spec||!locationBounds(x,z,spec))return {ok:false,status:400,error:"Defesa ou posição inválida."};
  const kingdom=await env.DB.prepare("SELECT castle_level FROM kingdoms WHERE id=?").bind(kingdomId).first();
  const countLimit=defenseLimit(type,kingdom?.castle_level);
  if(!kingdom||Number(kingdom.castle_level)<spec.minCastleLevel)return {ok:false,status:409,error:"Nível do castelo insuficiente para esta defesa."};
  const sql="UPDATE kingdoms SET wood=wood-?,stone=stone-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP "+
    "WHERE id=? AND wood>=? AND stone>=? AND iron>=? AND castle_level>=? "+
    "AND (SELECT COUNT(*) FROM city_defenses WHERE kingdom_id=? AND defense_type=?)<? AND "+
    occupiedBuilding+" AND "+occupiedDefense();
  const debit=env.DB.prepare(sql).bind(
    spec.wood,spec.stone,spec.iron,kingdomId,
    spec.wood,spec.stone,spec.iron,spec.minCastleLevel,
    kingdomId,type,countLimit,
    kingdomId,x+spec.width,x,z+spec.height,z,
    kingdomId,x+spec.width,x,z+spec.height,z
  );
  const place=env.DB.prepare("INSERT INTO city_defenses(kingdom_id,defense_type,grid_x,grid_z,width,height) "+
    "SELECT ?,?,?,?,?,? WHERE changes()=1")
    .bind(kingdomId,type,x,z,spec.width,spec.height);
  const ledger=env.DB.prepare(
    "INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) "+
    "SELECT ?,'wood',?,'defesa posicionada' WHERE changes()=1 UNION ALL "+
    "SELECT ?,'stone',?,'defesa posicionada' WHERE changes()=1 UNION ALL "+
    "SELECT ?,'iron',?,'defesa posicionada' WHERE changes()=1"
  ).bind(kingdomId,-spec.wood,kingdomId,-spec.stone,kingdomId,-spec.iron);
  const result=await env.DB.batch([debit,place,ledger]);
  if(Number(result[0]?.meta?.changes)!==1||Number(result[1]?.meta?.changes)!==1)
    return {ok:false,status:409,error:"Posição ocupada, limite atingido ou recursos insuficientes."};
  return {ok:true,type,gridX:x,gridZ:z,spent:{wood:spec.wood,stone:spec.stone,iron:spec.iron}};
}
export async function movePlacedDefense(env,kingdomId,body){
  const id=body?.defenseId,x=body?.gridX,z=body?.gridZ;
  if(!Number.isSafeInteger(id)||id<1)return {ok:false,status:400,error:"Identificador de defesa inválido."};
  const defense=await env.DB.prepare("SELECT defense_type,grid_x,grid_z FROM city_defenses WHERE id=? AND kingdom_id=?").bind(id,kingdomId).first();
  if(!defense)return {ok:false,status:404,error:"Defesa não encontrada."};
  const spec=DEFENSE_CATALOG[defense.defense_type];
  if(!spec||!locationBounds(x,z,spec))return {ok:false,status:400,error:"Posição inválida."};
  const sql="UPDATE city_defenses SET grid_x=?,grid_z=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kingdom_id=? AND grid_x=? AND grid_z=? "+
    "AND "+occupiedBuilding+" AND "+occupiedDefense(true);
  const moved=await env.DB.prepare(sql).bind(x,z,id,kingdomId,defense.grid_x,defense.grid_z,
    kingdomId,x+spec.width,x,z+spec.height,z,
    kingdomId,id,x+spec.width,x,z+spec.height,z).run();
  if(Number(moved?.meta?.changes)!==1)return {ok:false,status:409,error:"Defesa alterada ou posição ocupada."};
  return {ok:true,id,gridX:x,gridZ:z};
}
export function defensePowerFromRows(rows=[]){
  return rows.reduce((total,row)=>total+(DEFENSE_CATALOG[row.defense_type]?.power||0)*Math.max(1,Number(row.level)||1),0);
}
