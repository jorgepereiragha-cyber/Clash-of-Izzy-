// Cidade avançada: posicionamento e economia independentes, sem duplicar kingdom_buildings.
// D1 é autoritativo; mutações de saldos e estruturas são transações em batch().
import { moveCityBuilding } from "./city-layout-rules.js";
const JSON_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
export function castleVisualTier(level){
 const n=Number(level)||1;
 return n<=3?1:n<=6?2:n<=9?3:4;
}
export function unlockedCitySize(level){return level>=20?50:level>=10?30:20;}
export function rotatedFootprint(width,height,rotation){
 if(![0,90,180,270].includes(rotation))return null;
 return rotation%180===0?{width,height}:{width:height,height:width};
}
export function rectanglesOverlap(a,b){
 return a.grid_x<b.grid_x+b.width&&a.grid_x+a.width>b.grid_x&&
        a.grid_y<b.grid_y+b.height&&a.grid_y+a.height>b.grid_y;
}
export function validateCityPosition(buildings,gridX,gridY,width,height,limit,exceptId=null){
 const origin=Math.floor((50-limit)/2);
 if(!Number.isSafeInteger(gridX)||!Number.isSafeInteger(gridY)||gridX<origin||gridY<origin||
    !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
    gridX+width>origin+limit||gridY+height>origin+limit)return {valid:false,reason:"Fora da área desbloqueada."};
 const candidate={grid_x:gridX,grid_y:gridY,width,height};
 if(buildings.some(other=>Number(other.id)!==Number(exceptId)&&rectanglesOverlap(candidate,other))){
  return {valid:false,reason:"Posição ocupada."};
 }
 return {valid:true};
}
export function proximityBuffs(buildings,now=Date.now()){
 const ready=buildings.filter(b=>epoch(b.finishes_at)<=now);
 const of=type=>ready.filter(b=>b.building_type===type);
 const distance=(a,b)=>{
  const dx=Math.max(0,a.grid_x-b.grid_x-b.width,b.grid_x-a.grid_x-a.width);
  const dy=Math.max(0,a.grid_y-b.grid_y-b.height,b.grid_y-a.grid_y-a.height);
  return Math.hypot(dx,dy);
 };
 let attack=0,storage=0,production=0;
 for(const smith of of("blacksmith"))for(const barracks of of("barracks"))
  if(distance(smith,barracks)<=5)attack+=0.10;
 for(const warehouse of of("warehouse"))for(const farm of ready.filter(b=>
  ["farm","lumber_mill","quarry","iron_mine"].includes(b.building_type)))
  if(distance(warehouse,farm)<=3)storage+=0.05;
 for(const market of of("market"))for(const warehouse of of("warehouse"))
  if(distance(market,warehouse)<=4)production+=0.10;
 return {attack_bonus:Math.min(0.20,attack),defense_bonus:0,
  production_bonus:Math.min(0.20,production),storage_bonus:Math.min(0.15,storage)};
}
const PRODUCTION_ORDER=["farm","iron_mine","mill","bakery","smelter","forge"];
const MATERIAL_KEYS=["wheat","flour","iron_ore","weapons","food_credit","iron_credit"];
const FORGE_INPUT="iron";
function epoch(value){
 const text=String(value||"");
 const parsed=Date.parse(text.includes("T")?text:text.replace(" ","T")+"Z");
 return Number.isFinite(parsed)?parsed:Date.now();
}
async function getKingdom(env,playerId){
 return env.DB.prepare("SELECT k.* FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?")
  .bind(playerId).first();
}
async function bootstrapCity(env,kingdomId){
 const db=env.DB;
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO city_population(kingdom_id) VALUES(?)").bind(kingdomId),
  db.prepare("INSERT OR IGNORE INTO city_economy_clock(kingdom_id,last_tick_at) VALUES(?,?)").bind(kingdomId,new Date().toISOString()),
  ...MATERIAL_KEYS.map(key=>db.prepare("INSERT OR IGNORE INTO city_stock(kingdom_id,resource) VALUES(?,?)").bind(kingdomId,key)),
  db.prepare("INSERT OR IGNORE INTO city_core_workers(kingdom_id,building_type) SELECT kingdom_id,building_type FROM kingdom_buildings WHERE kingdom_id=? AND building_type IN ('farm','iron_mine')").bind(kingdomId)
 ]);
}
async function cityRows(env,kingdomId){
 const db=env.DB;
 const [core,extras]=await Promise.all([
  db.prepare(
   "SELECT b.id AS legacy_id,b.kingdom_id,b.building_type,b.level,b.position_x,b.position_z,"+
   " COALESCE(w.workers_assigned,0) AS workers_assigned,t.name,t.category,t.width,t.height,"+
   " t.workers_required,t.input_resource,t.output_resource,t.input_rate,t.output_rate,"+
   " t.defense_power,t.damage,t.attack_range,t.attack_speed FROM kingdom_buildings b"+
   " JOIN city_building_types t ON t.type=b.building_type"+
   " LEFT JOIN city_core_workers w ON w.kingdom_id=b.kingdom_id AND w.building_type=b.building_type"+
   " WHERE b.kingdom_id=? ORDER BY b.id"
  ).bind(kingdomId).all(),
  db.prepare(
   "SELECT s.*,t.name,t.category,t.workers_required,t.input_resource,t.output_resource,"+
   " t.input_rate,t.output_rate,t.defense_power,t.damage,t.attack_range,t.attack_speed,"+
   " 1 AS level FROM city_structures s JOIN city_building_types t ON t.type=s.building_type"+
   " WHERE s.kingdom_id=? ORDER BY s.id"
  ).bind(kingdomId).all()
 ]);
 // As coordenadas originais provêm exclusivamente de kingdom_buildings:
 // nunca são copiadas nem migradas para uma tabela paralela.
 const virtual=(core.results||[]).map(b=>({
  ...b,id:-Number(b.legacy_id),grid_x:Number(b.position_x)+25,grid_y:Number(b.position_z)+25,
  core_building_type:b.building_type,rotation:0,finishes_at:"1970-01-01T00:00:00.000Z"
 }));
 return [...virtual,...(extras.results||[])];
}
function populationFromRows(rows,happiness){
 const capacity=10+rows.filter(b=>b.building_type==="house"&&epoch(b.finishes_at)<=Date.now()).length*5;
 const assigned=rows.reduce((sum,b)=>sum+Number(b.workers_assigned||0),0);
 return {total:capacity,available:Math.max(0,capacity-assigned),assigned,happiness:Number(happiness)};
}
export function projectedCityProduction(rows,stock,kingdom,lastTick,now,happiness=100,productionBonus=0){
 const next={...stock};
 const old={...stock};
 let foodCredit=Number(stock.food_credit)||0,ironCredit=Number(stock.iron_credit)||0,ironSpent=0;
 const availableIron=Number(kingdom.iron)||0;
 const elapsedMax=7*24*3600*1000;
 const efficiencyHappiness=0.5+Math.max(0,Math.min(100,happiness))/200;
 for(const type of PRODUCTION_ORDER){
  for(const b of rows.filter(item=>item.building_type===type)){
   const req=Number(b.workers_required)||0;
   if(req<=0||Number(b.workers_assigned)<req)continue;
   const from=Math.max(lastTick,epoch(b.finishes_at),now-elapsedMax);
   const hours=Math.max(0,now-from)/3600000;
   if(hours===0)continue;
   const efficiency=Math.min(1,Number(b.workers_assigned)/req);
   const tier=1+(Math.max(1,Number(b.level)||1)-1)*0.1;
   const multiplier=efficiency*tier*efficiencyHappiness*(1+productionBonus);
   const gross=Math.floor(Number(b.output_rate)*1000*hours*multiplier);
   if(gross<=0)continue;
   let produced=gross;
   if(b.input_resource){
    const required=Math.floor(Number(b.input_rate)*1000*hours*multiplier);
    if(required<=0)continue;
    if(b.input_resource===FORGE_INPUT){
     const available=Math.max(0,availableIron+Math.floor(ironCredit/1000)-ironSpent);
     const consumed=Math.min(available,Math.ceil(required/1000));
     produced=Math.floor(gross*Math.min(1,(consumed*1000)/required));
     ironSpent+=consumed;
    }else{
     const available=Math.max(0,next[b.input_resource]||0);
     const consumed=Math.min(available,required);
     produced=Math.floor(gross*consumed/required);
     next[b.input_resource]=available-consumed;
    }
   }
   if(b.output_resource==="food")foodCredit+=produced;
   else if(b.output_resource==="iron")ironCredit+=produced;
   else if(Object.hasOwn(next,b.output_resource))next[b.output_resource]+=produced;
  }
 }
 // Mantém frações de comida/ferro no estoque técnico (não duplo crédito).
 const credits={food:foodCredit,iron:ironCredit};
 const foodGain=Math.floor(credits.food/1000);
 const ironGain=Math.floor(credits.iron/1000);
 next.food_credit=foodCredit%1000;
 next.iron_credit=ironCredit%1000;
 return {deltas:Object.fromEntries(MATERIAL_KEYS.map(k=>[k,next[k]-old[k]])),
  foodGain,ironGain,ironSpent};
}
async function processCityProduction(env,kingdom){
 const clock=await env.DB.prepare("SELECT last_tick_at FROM city_economy_clock WHERE kingdom_id=?").bind(kingdom.id).first();
 if(!clock)return;
 const last=epoch(clock.last_tick_at),now=Date.now();
 if(now-last<60000)return;
 const [rows,stocks,pop]=await Promise.all([
  cityRows(env,kingdom.id),
  env.DB.prepare("SELECT resource,quantity_milli FROM city_stock WHERE kingdom_id=?").bind(kingdom.id).all(),
  env.DB.prepare("SELECT happiness FROM city_population WHERE kingdom_id=?").bind(kingdom.id).first()
 ]);
 const stock=Object.fromEntries(MATERIAL_KEYS.map(key=>[key,0]));
 for(const row of stocks.results||[])stock[row.resource]=Number(row.quantity_milli)||0;
 const buffs=proximityBuffs(rows,now);
 const calculated=projectedCityProduction(rows,stock,kingdom,last,now,Number(pop?.happiness)||100,buffs.production_bonus);
 const token=crypto.randomUUID();
 const db=env.DB,nowIso=new Date(now).toISOString();
 const guard="EXISTS(SELECT 1 FROM city_economy_clock WHERE kingdom_id=? AND claim_token=?)";
 const stmts=[
  db.prepare("UPDATE city_economy_clock SET last_tick_at=?,claim_token=? WHERE kingdom_id=? AND last_tick_at=?")
   .bind(nowIso,token,kingdom.id,clock.last_tick_at)
 ];
 for(const [resource,delta] of Object.entries(calculated.deltas)){
  if(!delta)continue;
  // A constraint CHECK impede débito negativo após alguma mutação concorrente.
  // Um erro causa rollback de todo o batch, inclusive o novo clock.
  stmts.push(db.prepare("UPDATE city_stock SET quantity_milli=quantity_milli+? WHERE kingdom_id=? AND resource=? AND "+guard)
   .bind(delta,kingdom.id,resource,kingdom.id,token));
 }
 if(calculated.foodGain||calculated.ironGain||calculated.ironSpent){
  const ironDelta=calculated.ironGain-calculated.ironSpent;
  stmts.push(db.prepare("UPDATE kingdoms SET food=MIN(food_capacity,food+?),iron=MIN(iron_capacity,iron+?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND iron+?>=0 AND "+guard)
   .bind(calculated.foodGain,ironDelta,kingdom.id,ironDelta,kingdom.id,token));
  // Se a mutação falhar por escassez, reverter em vez de creditar armas sem custo.
  // O saldo é guardado por CHECK; a condição de nulidade abaixo força rollback.
  stmts.push(db.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,'city_production_tick',? WHERE "+guard+" AND (SELECT iron FROM kingdoms WHERE id=?)>=0")
   .bind(kingdom.id,JSON.stringify({food:calculated.foodGain,iron:ironDelta}),kingdom.id,token,kingdom.id));
 }
 try{await db.batch(stmts);}catch(error){console.warn("city_production_retry",String(error?.message||error));}
}
function configLimit(type){
 return ({house:30,mill:8,bakery:8,smelter:8,forge:8,blacksmith:5,
  arrow_tower:20,cannon_tower:10,trap_spikes:30,trap_boulder:20,oil_pot:20,
  gate:4,wall_segment:50})[type]||1;
}
async function placementCheck(env,kingdom,body,exceptId=null){
 const type=String(body.buildingType||"");
 const config=await env.DB.prepare("SELECT * FROM city_building_types WHERE type=?").bind(type).first();
 if(!config)return {valid:false,reason:"Tipo de construção inválido."};
 const rotation=Number(body.rotation??0),dimensions=rotatedFootprint(config.width,config.height,rotation);
 if(!dimensions)return {valid:false,reason:"Rotação inválida."};
 const gridX=body.gridX,gridY=body.gridY;
 const rows=await cityRows(env,kingdom.id);
 const validation=validateCityPosition(rows,gridX,gridY,dimensions.width,dimensions.height,unlockedCitySize(kingdom.castle_level),exceptId);
 return {...validation,config,rotation,dimensions,rows};
}
async function fullState(env,kingdom){
 await processCityProduction(env,kingdom);
 const [rows,types,stocks,pop,fresh]=await Promise.all([
  cityRows(env,kingdom.id),
  env.DB.prepare("SELECT * FROM city_building_types ORDER BY category,name").all(),
  env.DB.prepare("SELECT resource,quantity_milli FROM city_stock WHERE kingdom_id=?").bind(kingdom.id).all(),
  env.DB.prepare("SELECT happiness FROM city_population WHERE kingdom_id=?").bind(kingdom.id).first(),
  env.DB.prepare("SELECT food,wood,stone,iron FROM kingdoms WHERE id=?").bind(kingdom.id).first()
 ]);
 return {gridSize:50,unlockedSize:unlockedCitySize(kingdom.castle_level),
  unlockedOrigin:Math.floor((50-unlockedCitySize(kingdom.castle_level))/2),
  castleTier:castleVisualTier(kingdom.castle_level),
  buildings:rows,types:types.results||[],population:populationFromRows(rows,pop?.happiness??100),
  stock:Object.fromEntries((stocks.results||[]).map(r=>[r.resource,Number(r.quantity_milli)/1000])),
  buffs:proximityBuffs(rows),resourceBalances:{wood:fresh.wood,stone:fresh.stone,iron:fresh.iron,food:fresh.food}};
}
export async function cityDefensePower(env,kingdomId){
 const result=await env.DB.prepare(
  "SELECT COALESCE(SUM(t.defense_power),0) AS total FROM city_structures s "+
  "JOIN city_building_types t ON t.type=s.building_type WHERE s.kingdom_id=? "+
  "AND s.core_building_type IS NULL AND s.finishes_at<=? AND t.category='defense'"
 ).bind(kingdomId,new Date().toISOString()).first();
 return Math.min(5000,Number(result?.total)||0);
}
export async function cityAttackBonus(env,kingdomId){
 const rows=await cityRows(env,kingdomId);
 return proximityBuffs(rows).attack_bonus;
}
export async function cityStorageBonus(env,kingdomId){
 const rows=await cityRows(env,kingdomId);
 return proximityBuffs(rows).storage_bonus;
}
export async function processCityCycle(env,limit=12){
 if(!env.DB)return;
 const rows=await env.DB.prepare(
  "SELECT e.kingdom_id FROM city_economy_clock e "+
  "WHERE unixepoch(e.last_tick_at)<unixepoch('now','-5 minutes') "+
  "ORDER BY e.last_tick_at LIMIT ?"
 ).bind(limit).all();
 for(const row of rows.results||[]){
  try{const kingdom=await env.DB.prepare("SELECT * FROM kingdoms WHERE id=?").bind(row.kingdom_id).first();
    if(kingdom)await processCityProduction(env,kingdom);
  }catch(error){console.warn("city_cycle_failed",row.kingdom_id,String(error?.message||error));}
 }
}
export async function handleCityRoute(request,env,playerId,body={}){
 const path=new URL(request.url).pathname;
 const kingdom=await getKingdom(env,playerId);
 if(!kingdom)return response({error:"Reino não encontrado."},404);
 await bootstrapCity(env,kingdom.id);
 if(path==="/api/game/city"&&request.method==="GET")return response(await fullState(env,kingdom));
 if(path==="/api/game/city/validate"&&request.method==="POST"){
  const check=await placementCheck(env,kingdom,body);
  return response({valid:check.valid,reason:check.reason||null});
 }
 if(path==="/api/game/city/place"&&request.method==="POST"){
  const requestKey=String(body.requestKey||"");
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey))return response({error:"Identificador de construção inválido."},400);
  const original=await env.DB.prepare("SELECT id,building_type,grid_x,grid_y,rotation FROM city_structures WHERE kingdom_id=? AND request_key=?").bind(kingdom.id,requestKey).first();
  if(original){
   const same=original.building_type===body.buildingType&&original.grid_x===body.gridX&&
    original.grid_y===body.gridY&&original.rotation===Number(body.rotation??0);
   return same?response({ok:true,structureId:original.id,reused:true}):
    response({error:"Identificador já utilizado em outra construção."},409);
  }
  const check=await placementCheck(env,kingdom,body);
  if(!check.valid)return response({error:check.reason},409);
  const {config,dimensions,rotation,rows}=check;
  if(!Number(config.placeable))return response({error:"Edifícios originais podem ser movidos, não duplicados."},409);
  const count=rows.filter(r=>r.building_type===config.type).length;
  if(count>=configLimit(config.type))return response({error:"Limite deste edifício alcançado."},409);
  const finish=new Date(Date.now()+Number(config.build_seconds)*1000).toISOString(),db=env.DB;
  try{
   const result=await db.batch([
    db.prepare("UPDATE kingdoms SET wood=wood-?,stone=stone-?,iron=iron-?,food=food-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND wood>=? AND stone>=? AND iron>=? AND food>=? AND (SELECT COUNT(*) FROM city_structures WHERE kingdom_id=? AND building_type=?)<? AND NOT EXISTS(SELECT 1 FROM city_structures WHERE kingdom_id=? AND request_key=?)")
     .bind(config.cost_wood,config.cost_stone,config.cost_iron,config.cost_food,kingdom.id,config.cost_wood,config.cost_stone,config.cost_iron,config.cost_food,kingdom.id,config.type,configLimit(config.type),kingdom.id,requestKey),
    db.prepare("INSERT INTO city_structures(kingdom_id,building_type,grid_x,grid_y,width,height,rotation,finishes_at,cost_wood,cost_stone,cost_iron,cost_food,request_key) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1")
     .bind(kingdom.id,config.type,body.gridX,body.gridY,dimensions.width,dimensions.height,rotation,finish,config.cost_wood,config.cost_stone,config.cost_iron,config.cost_food,requestKey)
   ]);
   if(!result[0]?.meta?.changes)return response({error:"Recursos insuficientes ou construção duplicada."},409);
   const saved=await db.prepare("SELECT id FROM city_structures WHERE kingdom_id=? AND request_key=?").bind(kingdom.id,requestKey).first();
   return response({ok:true,structureId:saved?.id,finishesAt:finish},201);
  }catch(error){
   if(String(error?.message||error).includes("city_cell_occupied"))return response({error:"Posição ocupada."},409);
   if(String(error?.message||error).includes("UNIQUE"))return response({error:"Construção já solicitada."},409);
   throw error;
  }
 }
 if(path==="/api/game/city/move"&&request.method==="POST"){
  const id=body.structureId;
  if(!Number.isSafeInteger(id)||id===0)return response({error:"Edifício inválido."},400);
  const rows=await cityRows(env,kingdom.id);
  const prior=rows.find(b=>Number(b.id)===id);
  if(!prior)return response({error:"Edifício não encontrado."},404);
  const check=await placementCheck(env,kingdom,{...body,buildingType:prior.building_type},id);
  if(!check.valid)return response({error:check.reason},409);
  if(prior.core_building_type){
   if(check.rotation!==0)return response({error:"Edifício original não pode ser rotacionado."},409);
   const moved=await moveCityBuilding(env,kingdom.id,{
    building:prior.building_type,gridX:body.gridX-25,gridZ:body.gridY-25,
    fromX:Number(prior.position_x),fromZ:Number(prior.position_z)
   });
   return response(moved,moved.ok?200:moved.status);
  }
  try{
   await env.DB.prepare("UPDATE city_structures SET grid_x=?,grid_y=?,width=?,height=?,rotation=? WHERE id=? AND kingdom_id=?")
    .bind(body.gridX,body.gridY,check.dimensions.width,check.dimensions.height,check.rotation,id,kingdom.id).run();
   return response({ok:true});
  }catch(error){if(String(error?.message||error).includes("city_cell_occupied"))return response({error:"Posição ocupada."},409);throw error;}
 }
 if(path==="/api/game/city/remove"&&request.method==="POST"){
  const id=body.structureId;
  if(!Number.isSafeInteger(id)||id===0)return response({error:"Edifício inválido."},400);
  if(id<0)return response({error:"Edifícios originais não podem ser removidos."},409);
  const prior=await env.DB.prepare("SELECT * FROM city_structures WHERE id=? AND kingdom_id=?").bind(id,kingdom.id).first();
  if(!prior)return response({error:"Edifício não encontrado."},404);
  if(prior.core_building_type)return response({error:"Não é permitido destruir edifícios originais."},409);
  const refund={wood:Math.floor(prior.cost_wood/2),stone:Math.floor(prior.cost_stone/2),
   iron:Math.floor(prior.cost_iron/2),food:Math.floor(prior.cost_food/2)};
  const db=env.DB;
  const result=await db.batch([
   db.prepare("DELETE FROM city_structures WHERE id=? AND kingdom_id=? AND core_building_type IS NULL").bind(id,kingdom.id),
   db.prepare("UPDATE kingdoms SET wood=wood+?,stone=stone+?,iron=iron+?,food=food+? WHERE id=? AND changes()=1")
    .bind(refund.wood,refund.stone,refund.iron,refund.food,kingdom.id)
  ]);
  if(!result[0]?.meta?.changes)return response({error:"Edifício já removido."},409);
  return response({ok:true,refund});
 }
 if(path==="/api/game/city/workers"&&request.method==="POST"){
  const id=body.structureId,workers=body.workers;
  if(!Number.isSafeInteger(id)||id===0||!Number.isSafeInteger(workers)||workers<0||workers>10)
   return response({error:"Quantidade de trabalhadores inválida."},400);
  const rows=await cityRows(env,kingdom.id);
  const target=rows.find(b=>Number(b.id)===id);
  if(!target)return response({error:"Edifício não encontrado."},404);
  if(workers>Number(target.workers_required))return response({error:"Edifício sem vagas suficientes."},409);
  const db=env.DB,now=new Date().toISOString();
  let updated;
  if(target.core_building_type){
   updated=await db.prepare(
    "UPDATE city_core_workers SET workers_assigned=? WHERE kingdom_id=? AND building_type=? AND "+
    " ?+(SELECT COALESCE(SUM(workers_assigned),0) FROM city_core_workers WHERE kingdom_id=? AND building_type<>?) "+
    " +(SELECT COALESCE(SUM(workers_assigned),0) FROM city_structures WHERE kingdom_id=?)"+
    " <=(10+5*(SELECT COUNT(*) FROM city_structures WHERE kingdom_id=? AND building_type='house' AND finishes_at<=?))"
   ).bind(workers,kingdom.id,target.building_type,workers,kingdom.id,target.building_type,kingdom.id,kingdom.id,now).run();
  }else{
   updated=await db.prepare(
    "UPDATE city_structures SET workers_assigned=? WHERE id=? AND kingdom_id=? AND "+
    " ?+(SELECT COALESCE(SUM(workers_assigned),0) FROM city_structures WHERE kingdom_id=? AND id<>?)"+
    " +(SELECT COALESCE(SUM(workers_assigned),0) FROM city_core_workers WHERE kingdom_id=?)"+
    " <=(10+5*(SELECT COUNT(*) FROM city_structures WHERE kingdom_id=? AND building_type='house' AND finishes_at<=?))"
   ).bind(workers,id,kingdom.id,workers,kingdom.id,id,kingdom.id,kingdom.id,now).run();
  }
  if(!updated.meta?.changes)return response({error:"População insuficiente."},409);
  return response({ok:true,workers});
 }
 return response({error:"Rota da cidade não encontrada."},404);
}
