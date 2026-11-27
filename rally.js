import { getPetBonuses } from "./pets.js";
import {marchCapacityForKingdom,countTroops} from "./march-capacity.js";

const UNIT_POWER=Object.freeze({
 militia:2,swordsman:5,spearman:4,archer:5,cavalry:9,knight:14,
 mage:12,crossbowman:7,catapult:22,ram:20,trebuchet:30
});
const NODE_RESOURCE=Object.freeze({mine:"iron",forest:"wood",farm:"food",quarry:"stone"});
const MAX_TOTAL_TROOPS=200000;
// A rally has its own capacity, independent of each participant's march.
// Only internal SQL expressions are passed to these builders.
const rallyCapacitySql=leader=>`MIN(${MAX_TOTAL_TROOPS},10000+10000*MAX(1,MIN(30,COALESCE((SELECT level FROM kingdom_buildings WHERE kingdom_id=${leader} AND building_type='embassy'),1))))`;
const rallyTroopsSql=rally=>`(SELECT COALESCE(SUM(CAST(t.value AS INTEGER)),0) FROM rally_reinforcements rr,json_each(rr.troop_data) t WHERE rr.rally_id=${rally})`;

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
async function validateMarchCapacity(env,kingdomId,troops){
 const capacity=await marchCapacityForKingdom(env.DB,kingdomId);
 const total=countTroops(troops);
 if(total<1||total>capacity.maximum){
   return reply({error:"Capacidade de marcha excedida. Máximo: "+capacity.maximum+
     " soldados. Evolua castelo, academia, herói e pesquisa militar.",
     marchCapacity:capacity},409);
 }
 return null;
}
function troopPower(troops){
 return Object.entries(troops).reduce((sum,[type,count])=>sum+UNIT_POWER[type]*count,0);
}
function resourceForNode(type){return NODE_RESOURCE[type]||null;}
function betaFiveMillion(env){return env.ENVIRONMENT==="beta"&&env.BETA_GATHERING_5M_ENABLED==="true";}
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
 return (rows.results||[]).map(row=>{
  const available=nodeRegeneration(row,now), capacity=Number(row.max_resources);
  const accelerated=betaFiveMillion(env)&&capacity>0;
  const scale=accelerated?5000000/capacity:1;
  return {...row,current_resources:accelerated&&available>=capacity?5000000:Math.floor(available*scale),max_resources:accelerated?5000000:capacity,
   regen_rate:Math.floor(Number(row.regen_rate)*scale),
   collection_amount:accelerated?(available>=capacity?5000000:0):Math.floor(available*0.5),
   resource_type:resourceForNode(row.node_type),is_mine:Number(row.occupied_by||0)===kingdomId};
 });
}
async function listRallies(env,kingdomId){
 const membership=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(kingdomId).first();
 if(!membership)return {rallies:[],in_alliance:false};
 const rows=await env.DB.prepare(`
  SELECT r.id,r.leader_kingdom_id,r.target_id,r.status,r.total_power,r.departure_time,r.arrival_time,
   r.rally_duration,k.kingdom_name AS leader_name,n.node_type,n.level AS node_level,
   (SELECT COUNT(*) FROM rally_reinforcements rr WHERE rr.rally_id=r.id) AS member_count,
   ${rallyTroopsSql("r.id")} AS total_troops,
   ${rallyCapacitySql("r.leader_kingdom_id")} AS troop_capacity,
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
 const marchError=await validateMarchCapacity(env,kingdomId,troops);
 if(marchError)return marchError;
 const troopJson=JSON.stringify(troops),count=Object.keys(troops).length;
 const rallyId=crypto.randomUUID(),now=Math.floor(Date.now()/1000),duration=300;
 const distance=Math.hypot(Number(node.map_x),Number(node.map_y));
 const petBonuses=await getPetBonuses(env,kingdomId);
 const travelSeconds=Math.max(60,Math.ceil((distance/10)/(1+petBonuses.marchSpeedPercent/100)));
 const arrival=now+duration+travelSeconds;
 const withdrawal=withdrawalStatement(
  troopJson,kingdomId,
  `EXISTS(SELECT 1 FROM alliance_members WHERE kingdom_id=? AND alliance_id=?) AND EXISTS(SELECT 1 FROM resource_nodes WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL) AND ?<=${rallyCapacitySql("?")}`,
  [kingdomId,membership.alliance_id,targetId,countTroops(troops),kingdomId]
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
  return reply({error:"Tropas insuficientes, capacidade do rally excedida ou nó reservado."},409);
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
 const marchError=await validateMarchCapacity(env,kingdomId,troops);
 if(marchError)return marchError;
 const troopJson=JSON.stringify(troops),count=Object.keys(troops).length,power=troopPower(troops);
 const withdrawal=withdrawalStatement(
  troopJson,kingdomId,
  `EXISTS(SELECT 1 FROM alliance_members WHERE kingdom_id=? AND alliance_id=?) AND EXISTS(SELECT 1 FROM rallies r WHERE r.id=? AND r.alliance_id=? AND r.status='gathering' AND r.departure_time>? AND ${rallyTroopsSql("r.id")}+?<=${rallyCapacitySql("r.leader_kingdom_id")}) AND NOT EXISTS(SELECT 1 FROM rally_reinforcements WHERE rally_id=? AND kingdom_id=?)`,
  [kingdomId,membership.alliance_id,rallyId,membership.alliance_id,Math.floor(Date.now()/1000),countTroops(troops),rallyId,kingdomId]
 );
 const result=await env.DB.batch([
  env.DB.prepare(withdrawal.sql).bind(...withdrawal.bindings),
  env.DB.prepare("INSERT INTO rally_reinforcements(rally_id,kingdom_id,troop_data,power) SELECT ?,?,?,? WHERE changes()=?")
   .bind(rallyId,kingdomId,troopJson,power,count),
  env.DB.prepare("UPDATE rallies SET total_power=total_power+? WHERE id=? AND status='gathering' AND changes()=1")
   .bind(power,rallyId)
 ]);
 if(Number(result[1]?.meta?.changes||0)!==1)
  return reply({error:"Tropas insuficientes, rally lotado ou participação já registrada."},409);
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
 const marchError=await validateMarchCapacity(env,kingdomId,troops);
 if(marchError)return marchError;
 const troopJson=JSON.stringify(troops),count=Object.keys(troops).length,now=Math.floor(Date.now()/1000);
 const withdrawal=withdrawalStatement(troopJson,kingdomId,
  "EXISTS(SELECT 1 FROM resource_nodes WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL)",
  [nodeId]);
 const result=await env.DB.batch([
  env.DB.prepare(withdrawal.sql).bind(...withdrawal.bindings),
  env.DB.prepare("UPDATE resource_nodes SET occupied_by=?,occupation_start=?,garrison_json=?,current_resources=MIN(max_resources,current_resources+CAST(MAX(0,?-last_regen)*regen_rate/3600 AS INTEGER)),last_regen=MAX(last_regen,?) WHERE id=? AND occupied_by IS NULL AND reserved_by_rally IS NULL AND changes()=?")
   .bind(kingdomId,now,JSON.stringify({owners:{[kingdomId]:troops}}),now,now,nodeId,count),
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
 const now=Math.floor(Date.now()/1000),available=nodeRegeneration(node,now);
 const accelerated=betaFiveMillion(env)&&Number(node.max_resources)>0;
 const amount=accelerated?(available>=Number(node.max_resources)?5000000:0):Math.floor(available*0.5);
 if(amount<1)return reply({error:"O nó ainda não acumulou recursos suficientes."},409);
 const next=accelerated?0:available-amount;
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
// New garrisons retain troop owners independently of alliance/rally deletion.
function parseOwnedGarrison(raw){
 let parsed;try{parsed=JSON.parse(raw)}catch{return null}
 if(!parsed||!parsed.owners||typeof parsed.owners!=="object"||Array.isArray(parsed.owners))return null;
 const owners=Object.entries(parsed.owners);
 if(!owners.length)return null;
 for(const [id,troops] of owners){
  if(!/^[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(Number(id))||!parseTroops(troops))return null;
 }
 return owners;
}
export const DETACHED_TROOPS_SQL =
 "(SELECT COALESCE(SUM(CAST(j.value AS INTEGER)),0) FROM rally_reinforcements rr JOIN rallies r ON r.id=rr.rally_id,json_each(rr.troop_data) j WHERE rr.kingdom_id=? AND r.status IN ('gathering','marching'))"+
 "+(SELECT COALESCE(SUM(CAST(j.value AS INTEGER)),0) FROM resource_nodes n,json_each(n.garrison_json,'$.owners') o,json_each(o.value) j WHERE n.occupied_by IS NOT NULL AND o.key=CAST(CAST(? AS INTEGER) AS TEXT))"+
 "+(SELECT COALESCE(SUM(CAST(j.value AS INTEGER)),0) FROM resource_nodes n,json_each(n.garrison_json) j WHERE n.occupied_by=? AND json_type(n.garrison_json,'$.owners') IS NULL AND j.type='integer')";
export async function detachedTroops(env,kingdomId){
 const row=await env.DB.prepare("SELECT "+DETACHED_TROOPS_SQL+" AS total").bind(kingdomId,kingdomId,kingdomId).first();
 return Number(row?.total||0);
}
async function recallNode(env,kingdomId,body){
 const nodeId=String(body.node_id||"").trim();
 const node=await env.DB.prepare("SELECT garrison_json FROM resource_nodes WHERE id=? AND occupied_by=? AND reserved_by_rally IS NULL").bind(nodeId,kingdomId).first();
 if(!node)return reply({error:"Este nó não está ocupado pelo seu reino ou pertence a um rally."},404);
 const owners=parseOwnedGarrison(node.garrison_json);
 const now=Math.floor(Date.now()/1000);
 if(!owners)return reply({error:"Guarnição antiga sem origem comprovada. A devolução exige reconciliação administrativa.",code:"GARRISON_RECONCILIATION_REQUIRED"},409);
 // One set-based credit, guarded by the exact garrison snapshot released above.
 // JSON owner IDs, not the leader's ID, determine the recipients.
 const result=await env.DB.batch([
  env.DB.prepare("UPDATE resource_nodes SET occupied_by=NULL,occupation_start=NULL,garrison_json='{}',current_resources=MIN(max_resources,current_resources+CAST(MAX(0,?-last_regen)*regen_rate/3600 AS INTEGER)),last_regen=MAX(last_regen,?) WHERE id=? AND occupied_by=? AND reserved_by_rally IS NULL AND garrison_json=?")
   .bind(now,now,nodeId,kingdomId,node.garrison_json),
  env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) SELECT CAST(o.key AS INTEGER),j.key,1,CAST(j.value AS INTEGER) FROM json_each(?,'$.owners') o,json_each(o.value) j WHERE changes()=1 ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity").bind(node.garrison_json)
 ]);
 if(Number(result[0]?.meta?.changes||0)!==1)return reply({error:"O estado do nó mudou; atualize e tente novamente."},409);
 const returned=owners.find(([id])=>Number(id)===kingdomId)?.[1]||{};
 return reply({success:true,returned:countTroops(returned),returned_allies:owners.filter(([id])=>Number(id)!==kingdomId).reduce((sum,[,troops])=>sum+countTroops(troops),0)});
}
export async function processDueRallies(env,batchSize=1){
 if(!env?.DB)return;
 const now=Math.floor(Date.now()/1000);
 const limit=Math.max(1,Math.min(10,Math.floor(Number(batchSize)||1)));
 await env.DB.prepare("UPDATE rallies SET status='marching' WHERE id IN (SELECT id FROM rallies WHERE status='gathering' AND departure_time<=? ORDER BY departure_time,id LIMIT ?)").bind(now,limit).run();
 const due=await env.DB.prepare("SELECT id,leader_kingdom_id,target_id FROM rallies WHERE status='marching' AND arrival_time<=? ORDER BY arrival_time,id LIMIT ?").bind(now,limit).all();
 for(const rally of due.results||[]){
  try{
   const rows=await env.DB.prepare("SELECT kingdom_id,troop_data FROM rally_reinforcements WHERE rally_id=? ORDER BY id").bind(rally.id).all();
   const owners={};
   for(const row of rows.results||[]){
    if(!Number.isSafeInteger(Number(row.kingdom_id))||Number(row.kingdom_id)<1)throw Error("Invalid rally owner");
    let troops;try{troops=parseTroops(JSON.parse(row.troop_data))}catch{}
    if(!troops)throw Error("Invalid rally reinforcement");
    owners[String(row.kingdom_id)]=troops;
   }
   if(!Object.hasOwn(owners,String(rally.leader_kingdom_id)))throw Error("Missing rally leader troops");
   // The same D1 transaction changes node and rally state. A stale invocation
   // cannot overwrite a successful settlement or subsequently cancel it.
   const result=await env.DB.batch([
    env.DB.prepare("UPDATE resource_nodes SET occupied_by=?,occupation_start=?,garrison_json=?,reserved_by_rally=NULL,current_resources=MIN(max_resources,current_resources+CAST(MAX(0,?-last_regen)*regen_rate/3600 AS INTEGER)),last_regen=MAX(last_regen,?) WHERE id=? AND reserved_by_rally=? AND occupied_by IS NULL AND EXISTS(SELECT 1 FROM rallies WHERE id=? AND status='marching' AND arrival_time<=?)")
     .bind(rally.leader_kingdom_id,now,JSON.stringify({owners}),now,now,rally.target_id,rally.id,rally.id,now),
    env.DB.prepare("UPDATE rallies SET status='completed' WHERE id=? AND status='marching' AND changes()=1").bind(rally.id)
   ]);
   if(Number(result[0]?.meta?.changes||0)===1)continue;
   // Only a still-owned reservation proves the older settlement never consumed
   // it. Missing reservations can be legacy partial settlements: quarantine.
   const cancelled=await env.DB.batch([
    env.DB.prepare("UPDATE rallies SET status='cancelled' WHERE id=? AND status='marching' AND EXISTS(SELECT 1 FROM resource_nodes WHERE id=? AND reserved_by_rally=? AND occupied_by IS NOT NULL)").bind(rally.id,rally.target_id,rally.id),
    env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) SELECT CAST(o.key AS INTEGER),j.key,1,CAST(j.value AS INTEGER) FROM json_each(?,'$.owners') o,json_each(o.value) j WHERE changes()=1 ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity").bind(JSON.stringify({owners})),
    env.DB.prepare("UPDATE resource_nodes SET reserved_by_rally=NULL WHERE id=? AND reserved_by_rally=? AND changes()>0").bind(rally.target_id,rally.id)
   ]);
   if(!cancelled[0]?.meta?.changes)console.warn("rally_settlement_deferred",rally.id);
  }catch(error){console.error("rally_settlement_failed",rally.id,String(error?.message||error));}
 }
}
export async function handleRally(request,env,publicPlayerId,path,body={}){
 try{
  const kingdomId=await kingdomForPlayer(env,publicPlayerId);
  if(!kingdomId)return reply({error:"Reino não encontrado."},404);
  if(request.method==="GET"&&path==="world"){
   // Beta has no cron. Settle a bounded batch before exposing nodes and rallies together.
   if(env.ENVIRONMENT==="beta")await processDueRallies(env,5);
   const [nodes,rallies]=await Promise.all([loadNodes(env,kingdomId),listRallies(env,kingdomId)]);
   return reply({nodes,...rallies});
  }
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
