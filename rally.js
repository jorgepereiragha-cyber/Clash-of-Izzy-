import { getPetBonuses } from "./pets.js";

const UNIT_POWER=Object.freeze({
 militia:2,swordsman:5,spearman:4,archer:5,cavalry:9,knight:14,
 mage:12,crossbowman:7,catapult:22,ram:20,trebuchet:30
});
const NODE_RESOURCE=Object.freeze({mine:"iron",forest:"wood",farm:"food",quarry:"stone"});
const MAX_TOTAL_TROOPS=100000;

function reply(data,status=200){
 return Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
function parseTroops(value){
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const entries=Object.entries(value);
 if(!entries.length||entries.length>Object.keys(UNIT_POWER).length)return null;
 const troops={};let total=0;
 for(const [type,raw] of entries){
  if(!Object.hasOwn(UNIT_POWER,type)||!Number.isSafeInteger(raw)||raw<1)return null;
  total+=raw;if(total>MAX_TOTAL_TROOPS)return null;
  troops[type]=raw;
 }
 return troops;
}
function troopPower(troops){
 return Object.entries(troops).reduce((sum,[type,count])=>sum+UNIT_POWER[type]*count,0);
}
function resourceForNode(type){return NODE_RESOURCE[type]||null;}
function nodeRegeneration(node,now){
 const elapsed=Math.max(0,now-Number(node.last_regen||now));
 return Math.min(Number(node.max_resources),Number(node.current_resources)+Math.floor(elapsed*Number(node.regen_rate)/3600));
}
async function kingdomForPlayer(env,publicPlayerId){
 const row=await env.DB.prepare(
  "SELECT k.id FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?"
 ).bind(publicPlayerId).first();
 return row?Number(row.id):null;
}
function withdrawalStatement(troopsJson,kingdomId,extraSql,extraBindings){
 const types=Object.keys(JSON.parse(troopsJson));
 const placeholders=types.map(()=>"?").join(",");
 const sql=`UPDATE army_units
 SET quantity=quantity-CAST(json_extract(?, '$."'||unit_type||'"') AS INTEGER)
 WHERE kingdom_id=? AND tier=1 AND unit_type IN (${placeholders})
 AND ${extraSql}
 AND NOT EXISTS (
   SELECT 1 FROM json_each(?) requested
   LEFT JOIN army_units available
     ON available.kingdom_id=? AND available.tier=1 AND available.unit_type=requested.key
   WHERE CAST(requested.value AS INTEGER)<1
      OR COALESCE(available.quantity,0)<CAST(requested.value AS INTEGER)
 )`;
 return {sql,bindings:[troopsJson,kingdomId,...types,...extraBindings,troopsJson,kingdomId]};
}
async function loadNodes(env,kingdomId){
 const rows=await env.DB.prepare(
  "SELECT id,node_type,map_x,map_y,level,current_resources,max_resources,regen_rate,occupied_by,occupation_start,reserved_by_rally,last_regen FROM resource_nodes ORDER BY level DESC,id"
 ).all();
 const now=Math.floor(Date.now()/1000);
 return (rows.results||[]).map(row=>({
  ...row,current_resources:nodeRegeneration(row,now),
  resource_type:resourceForNode(row.node_type),is_mine:Number(row.occupied_by||0)===kingdomId
 }));
}
async function listRallies(env,kingdomId){
 const membership=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(kingdomId).first();
 if(!membership)return {rallies:[],in_alliance:false};
 const rows=await env.DB.prepare(`
  SELECT r.id,r.leader_kingdom_id,r.target_id,r.status,r.total_power,r.departure_time,r.arrival_time,
   r.rally_duration,k.kingdom_name AS leader_name,n.node_type,n.level AS node_level,
   (SELECT COUNT(*) FROM rally_reinforcements rr WHERE rr.rally_id=r.id) AS member_count,
   EXISTS(SELECT 1 FROM rally_reinforcements mine WHERE mine.rally_id=r.id AND mine.kingdom_id=?) AS joined
  FROM rallies r
  JOIN kingdoms k ON k.id=r.leader_kingdom_id
  JOIN resource_nodes n ON n.id=r.target_id
  WHERE r.alliance_id=? AND r.status IN ('gathering','marching')
  ORDER BY r.created_at DESC LIMIT 30
 `).bind(kingdomId,membership.alliance_id).all();
 return {rallies:rows.results||[],in_alliance:true};
}
async function createRally(env,kingdomId,body){
 const membership=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(kingdomId).first();
 if(!membership)return reply({error:"Você precisa estar em uma aliança para criar um rally."},403);
 const targetId=String(body.target_id||"").trim();
 if(!/^node_\d{3}$/.test(targetId))return reply({error:"Nó de recurso inválido."},400);
 const node=await env.DB.prepare("SELECT id,map_x,map_y,occupied_by,reserved_by_rally FROM resource_nodes WHERE id=?").bind(targetId).first();
 if(!node)return reply({error:"Nó de recurso não encontrado."},404);
 if(node.occupied_by!==null||node.reserved_by_rally)return reply({error:"Este nó já está ocupado ou reservado."},409);
 const troops=parseTroops(body.troops);
 if(!troops)return reply({error:"Informe quantidades inteiras e positivas de tropas válidas."},400);
 const troopJson=JSON.stringify(troops),count=Object.keys(troops).length;
 const rallyId=crypto.randomUUID(),now=Math.floor(Date.now()/1000),duration=300;
 const distance=Math.hypot(Number(node.map_x),Number(node.map_y));
 const petBonuses=await getPetBonuses(env,kingdomId);
 const travelSeconds=Math.max(60,Math.ceil((distance/10)/(1+petBonuses.marchSpeedPercent/100)));
 const arrival=now+duration+travelSeconds;
 const withdrawal=withdrawalStatement(
  troopJson,kingdomId,
  "EXISTS(SELECT 1 FROM alliance_members WHERE kingdom_id=? AND alliance_id=?) AND EXISTS(SELECT 1 FROM resource_nodes WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL)",
  [kingdomId,membership.alliance_id,targetId]
 );
 const result=await env.DB.batch([
  env.DB.prepare(withdrawal.sql).bind(...withdrawal.bindings),
  env.DB.prepare(`INSERT INTO rallies(id,leader_kingdom_id,alliance_id,target_type,target_id,status,total_power,rally_duration,departure_time,arrival_time)
   SELECT ?,?,?,'resource_node',?,'gathering',0,?,?,? WHERE changes()=?`)
   .bind(rallyId,kingdomId,membership.alliance_id,targetId,duration,now+duration,arrival,count),
  env.DB.prepare("UPDATE resource_nodes SET reserved_by_rally=? WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL AND changes()=1")
   .bind(rallyId,targetId),
  env.DB.prepare("INSERT INTO rally_reinforcements(rally_id,kingdom_id,troop_data,power) SELECT ?,?,?,? WHERE changes()=1")
   .bind(rallyId,kingdomId,troopJson,troopPower(troops)),
  env.DB.prepare("UPDATE rallies SET total_power=? WHERE id=? AND changes()=1")
   .bind(troopPower(troops),rallyId)
 ]);
 if(Number(result[1]?.meta?.changes||0)!==1){
  return reply({error:"Tropas insuficientes, nó reservado ou rally não pôde ser criado."},409);
 }
 return reply({success:true,rally_id:rallyId,departure_time:now+duration,arrival_time:arrival,power:troopPower(troops)},201);
}
async function joinRally(env,kingdomId,body){
 const rallyId=String(body.rally_id||"").trim();
 if(!/^[0-9a-f-]{36}$/i.test(rallyId))return reply({error:"Rally inválido."},400);
 const rally=await env.DB.prepare("SELECT id,alliance_id,status,departure_time FROM rallies WHERE id=?").bind(rallyId).first();
 if(!rally||rally.status!=="gathering"||Number(rally.departure_time)<=Math.floor(Date.now()/1000))
  return reply({error:"Rally não encontrado ou período de reunião encerrado."},409);
 const membership=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(kingdomId).first();
 if(!membership||Number(membership.alliance_id)!==Number(rally.alliance_id))
  return reply({error:"Você não pertence à aliança deste rally."},403);
 const troops=parseTroops(body.troops);
 if(!troops)return reply({error:"Informe quantidades inteiras e positivas de tropas válidas."},400);
 const troopJson=JSON.stringify(troops),count=Object.keys(troops).length,power=troopPower(troops);
 const withdrawal=withdrawalStatement(
  troopJson,kingdomId,
  "EXISTS(SELECT 1 FROM alliance_members WHERE kingdom_id=? AND alliance_id=?) AND EXISTS(SELECT 1 FROM rallies WHERE id=? AND status='gathering' AND departure_time>?) AND NOT EXISTS(SELECT 1 FROM rally_reinforcements WHERE rally_id=? AND kingdom_id=?)",
  [kingdomId,membership.alliance_id,rallyId,Math.floor(Date.now()/1000),rallyId,kingdomId]
 );
 const result=await env.DB.batch([
  env.DB.prepare(withdrawal.sql).bind(...withdrawal.bindings),
  env.DB.prepare("INSERT INTO rally_reinforcements(rally_id,kingdom_id,troop_data,power) SELECT ?,?,?,? WHERE changes()=?")
   .bind(rallyId,kingdomId,troopJson,power,count),
  env.DB.prepare("UPDATE rallies SET total_power=total_power+? WHERE id=? AND status='gathering' AND changes()=1")
   .bind(power,rallyId)
 ]);
 if(Number(result[1]?.meta?.changes||0)!==1)
  return reply({error:"Tropas insuficientes ou você já participa deste rally."},409);
 return reply({success:true,power_added:power});
}
async function occupyNode(env,kingdomId,body){
 const nodeId=String(body.node_id||"").trim();
 if(!/^node_\d{3}$/.test(nodeId))return reply({error:"Nó inválido."},400);
 const node=await env.DB.prepare("SELECT id,occupied_by,reserved_by_rally FROM resource_nodes WHERE id=?").bind(nodeId).first();
 if(!node)return reply({error:"Nó não encontrado."},404);
 if(node.occupied_by!==null||node.reserved_by_rally)return reply({error:"Nó já ocupado ou reservado."},409);
 const troops=parseTroops(body.troops);
 if(!troops)return reply({error:"Envie ao menos uma tropa válida para ocupar o nó."},400);
 const troopJson=JSON.stringify(troops),count=Object.keys(troops).length,now=Math.floor(Date.now()/1000);
 const withdrawal=withdrawalStatement(troopJson,kingdomId,
  "EXISTS(SELECT 1 FROM resource_nodes WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL)",
  [nodeId]);
 const result=await env.DB.batch([
  env.DB.prepare(withdrawal.sql).bind(...withdrawal.bindings),
  env.DB.prepare("UPDATE resource_nodes SET occupied_by=?,occupation_start=?,garrison_json=?,last_regen=? WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL AND changes()=?")
   .bind(kingdomId,now,troopJson,now,nodeId,count),
  env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,'resource_node_occupied',? WHERE changes()=1")
   .bind(kingdomId,JSON.stringify({nodeId})),
 ]);
 if(Number(result[1]?.meta?.changes||0)!==1)return reply({error:"Tropas insuficientes ou nó reservado por outro reino."},409);
 return reply({success:true,node_id:nodeId});
}
async function collectResources(env,kingdomId,body){
 const nodeId=String(body.node_id||"").trim();
 const node=await env.DB.prepare("SELECT * FROM resource_nodes WHERE id=?").bind(nodeId).first();
 if(!node||Number(node.occupied_by)!==kingdomId)return reply({error:"Seu reino não ocupa este nó."},403);
 const resource=resourceForNode(node.node_type);
 if(!resource)return reply({error:"Tipo de recurso inválido."},409);
 const now=Math.floor(Date.now()/1000),available=nodeRegeneration(node,now),amount=Math.floor(available*0.5);
 if(amount<1)return reply({error:"O nó ainda não acumulou recursos suficientes."},409);
 const next=available-amount;
 const result=await env.DB.batch([
  env.DB.prepare("UPDATE resource_nodes SET current_resources=?,last_regen=? WHERE id=? AND occupied_by=? AND last_regen=? AND current_resources=?")
   .bind(next,now,nodeId,kingdomId,node.last_regen,node.current_resources),
  env.DB.prepare(`UPDATE kingdoms SET ${resource}=${resource}+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()=1`)
   .bind(amount,kingdomId),
  env.DB.prepare("INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) SELECT ?,?,?,? WHERE changes()=1")
   .bind(kingdomId,resource,amount,"coleta de nó de recurso: "+nodeId)
 ]);
 if(Number(result[0]?.meta?.changes||0)!==1)return reply({error:"A coleta foi disputada por outra ação. Atualize e tente novamente."},409);
 return reply({success:true,collected:amount,resource_type:resource});
}
async function recallNode(env,kingdomId,body){
 const nodeId=String(body.node_id||"").trim();
 const node=await env.DB.prepare("SELECT garrison_json FROM resource_nodes WHERE id=? AND occupied_by=? AND reserved_by_rally IS NULL").bind(nodeId,kingdomId).first();
 if(!node)return reply({error:"Este nó não está ocupado pelo seu reino ou pertence a um rally."},404);
 let garrison={};try{garrison=JSON.parse(node.garrison_json||"{}")}catch{}
 const entries=Object.entries(garrison).filter(([type,count])=>Object.hasOwn(UNIT_POWER,type)&&Number.isSafeInteger(count)&&count>0);
 const result=await env.DB.batch([
  env.DB.prepare("UPDATE resource_nodes SET occupied_by=NULL,occupation_start=NULL,garrison_json='{}',last_regen=? WHERE id=? AND occupied_by=? AND reserved_by_rally IS NULL AND garrison_json=?")
   .bind(Math.floor(Date.now()/1000),nodeId,kingdomId,node.garrison_json),
  ...entries.map(([type,count])=>env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) SELECT ?,?,1,? WHERE changes()=1 ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity").bind(kingdomId,type,count))
 ]);
 if(Number(result[0]?.meta?.changes||0)!==1)return reply({error:"O estado do nó mudou; atualize e tente novamente."},409);
 return reply({success:true,returned:entries.reduce((sum,[,count])=>sum+count,0)});
}
export async function processDueRallies(env,batchSize=1){
 if(!env?.DB)return;
 const now=Math.floor(Date.now()/1000);
 const limit=Math.max(1,Math.min(10,Math.floor(Number(batchSize)||1)));
 await env.DB.prepare("UPDATE rallies SET status='marching' WHERE id IN (SELECT id FROM rallies WHERE status='gathering' AND departure_time<=? ORDER BY departure_time,id LIMIT ?)").bind(now,limit).run();
 const due=await env.DB.prepare("SELECT id,leader_kingdom_id,target_id FROM rallies WHERE status='marching' AND arrival_time<=? ORDER BY arrival_time,id LIMIT ?").bind(now,limit).all();
 for(const rally of due.results||[]){
  const rows=await env.DB.prepare("SELECT troop_data FROM rally_reinforcements WHERE rally_id=? ORDER BY id").bind(rally.id).all();
  const garrison={};
  for(const row of rows.results||[]){
   let troops={};try{troops=JSON.parse(row.troop_data||"{}")}catch{}
   for(const [type,count] of Object.entries(troops)){
    if(Object.hasOwn(UNIT_POWER,type))garrison[type]=(garrison[type]||0)+Number(count||0);
   }
  }
  const occupied=await env.DB.prepare("UPDATE resource_nodes SET occupied_by=?,occupation_start=?,garrison_json=?,reserved_by_rally=NULL,last_regen=? WHERE id=? AND reserved_by_rally=? AND occupied_by IS NULL")
   .bind(rally.leader_kingdom_id,now,JSON.stringify(garrison),now,rally.target_id,rally.id).run();
  await env.DB.prepare("UPDATE rallies SET status=? WHERE id=? AND status='marching'")
   .bind(Number(occupied.meta?.changes||0)===1?"completed":"cancelled",rally.id).run();
 }
}
export async function handleRally(request,env,publicPlayerId,path,body={}){
 try{
  const kingdomId=await kingdomForPlayer(env,publicPlayerId);
  if(!kingdomId)return reply({error:"Reino não encontrado."},404);
  if(request.method==="GET"&&path==="nodes")return reply({nodes:await loadNodes(env,kingdomId)});
  if(request.method==="GET"&&path==="active")return reply(await listRallies(env,kingdomId));
  if(request.method!=="POST")return reply({error:"Método não permitido."},405);
  if(path==="create")return await createRally(env,kingdomId,body);
  if(path==="join")return await joinRally(env,kingdomId,body);
  if(path==="occupy")return await occupyNode(env,kingdomId,body);
  if(path==="collect")return await collectResources(env,kingdomId,body);
  if(path==="recall")return await recallNode(env,kingdomId,body);
  return reply({error:"Rota de guerra inválida."},404);
 }catch(error){
  console.error("advanced_warfare_request_failed",String(error?.message||error));
  return reply({error:"Não foi possível processar a operação de guerra."},500);
 }
}
