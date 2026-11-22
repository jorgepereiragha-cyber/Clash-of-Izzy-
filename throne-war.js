// Guerra do Trono: o Worker decide todas as fases, batalhas, reinforços e coroações.
// Nunca confiar na raridade/força enviada pelo cliente. D1 é autoritativo.
// Não concede gemas, VIP ou recompensas comerciais.
import {
 thronePhase,canCrownThrone,thronePowerForArmy,THRONE_NPC_POWER,
 THRONE_GARRISON_CAP,THRONE_ACTION_COOLDOWN_SECONDS
} from "./throne-war-rules.js";

export class ThroneWarError extends Error{
 constructor(message,status=409){super(message);this.status=status;}
}
async function context(env,playerId){
 const kingdom=await env.DB.prepare(
   "SELECT k.id AS kingdom_id,k.map_region,r.unlocked_at FROM players p "+
   "JOIN kingdoms k ON k.player_id=p.id JOIN realm_openings r ON r.realm_id=k.map_region "+
   "WHERE p.player_id=?"
 ).bind(playerId).first();
 if(!kingdom)throw new ThroneWarError("Reino não encontrado ou mapa bloqueado.",404);
 return {realm:Number(kingdom.map_region),kingdomId:Number(kingdom.kingdom_id),
   openedAt:kingdom.unlocked_at};
}
async function latestCrown(env,realm){
 return env.DB.prepare(
  "SELECT c.round_id,c.alliance_id,c.king_kingdom_id,c.crowned_at,c.appointed_at,"+
  "a.tag AS alliance_tag,k.kingdom_name AS king_name "+
  "FROM throne_crowns c JOIN alliances a ON a.id=c.alliance_id "+
  "JOIN kingdoms k ON k.id=c.king_kingdom_id "+
  "WHERE c.realm_id=? ORDER BY c.round_id DESC LIMIT 1"
 ).bind(realm).first();
}
async function awardCrown(env,realm,phase,now){
 if(!phase.roundId)return;
 // A ocupação precisa alcançar 150 minutos ANTES do fim da Disputa.
 // O vencedor é coroado somente uma vez (chave primária por mapa/rodada).
 await env.DB.prepare(
  "INSERT OR IGNORE INTO throne_crowns(realm_id,round_id,alliance_id,king_kingdom_id) "+
  "SELECT realm_id,round_id,holding_alliance_id,holding_kingdom_id "+
  "FROM throne_sieges WHERE realm_id=? AND round_id=? "+
  "AND datetime(held_since,'+150 minutes')<=datetime(?) "+
  "AND datetime(held_since,'+150 minutes')<=datetime(?)"
 ).bind(realm,phase.roundId,new Date(now).toISOString(),phase.contestUntil).run();
}
export async function throneStatus(env,playerId,now=Date.now()){
 const ctx=await context(env,playerId);
 const phase=thronePhase(ctx.openedAt,now);
 await awardCrown(env,ctx.realm,phase,now);
 const [siege,crown]=await Promise.all([
   phase.roundId?env.DB.prepare(
     "SELECT holding_alliance_id,holding_kingdom_id,held_since,garrison_power "+
     "FROM throne_sieges WHERE realm_id=? AND round_id=?"
   ).bind(ctx.realm,phase.roundId).first():Promise.resolve(null),
   latestCrown(env,ctx.realm)
 ]);
 const crownedCurrent=Boolean(crown&&Number(crown.round_id)===phase.roundId);
 const member=await env.DB.prepare(
  "SELECT a.id AS alliance_id,a.tag AS tag,a.leader_kingdom_id "+
  "FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id "+
  "WHERE m.kingdom_id=?"
 ).bind(ctx.kingdomId).first();
 return {realm:ctx.realm,kingdomId:ctx.kingdomId,serverTime:new Date(now).toISOString(),
  ...phase,shieldDays:35,requiredHoldMinutes:150,throne:{x:0,z:0},
  canAttack:phase.canAttack&&!crownedCurrent&&Boolean(member),
  holder:siege?{
   allianceId:Number(siege.holding_alliance_id),
   kingdomId:Number(siege.holding_kingdom_id),garrisonPower:Number(siege.garrison_power),
   heldSince:siege.held_since,remainingHoldSeconds:Math.max(0,
     Math.ceil((Date.parse(siege.held_since.replace(" ","T")+"Z")+9000000-now)/1000))
  }:null,
  crown:crown?{
   roundId:Number(crown.round_id),allianceId:Number(crown.alliance_id),
   allianceTag:crown.alliance_tag,kingdomId:Number(crown.king_kingdom_id),
   kingName:crown.king_name,crownedAt:crown.crowned_at
  }:null,
  alliance:member?{id:Number(member.alliance_id),tag:member.tag,
   canNominate:Number(member.leader_kingdom_id)===ctx.kingdomId}:null};
}

const ACTION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function nominateKing(env,ctx,body){
 const nominee=Number(body.kingdomId);
 if(!Number.isSafeInteger(nominee)||nominee<1)
   throw new ThroneWarError("Candidato inválido.",400);
 const member=await env.DB.prepare(
  "SELECT a.id AS alliance_id FROM alliances a JOIN alliance_members m ON m.alliance_id=a.id "+
  "WHERE m.kingdom_id=? AND a.leader_kingdom_id=?"
 ).bind(ctx.kingdomId,ctx.kingdomId).first();
 if(!member)throw new ThroneWarError("Somente o líder vencedor pode nomear o Rei.",403);
 const crown=await latestCrown(env,ctx.realm);
 if(!crown||Number(crown.alliance_id)!==Number(member.alliance_id))
   throw new ThroneWarError("Sua aliança não controla a coroa deste mapa.",403);
 const updated=await env.DB.prepare(
  "UPDATE throne_crowns SET king_kingdom_id=?,appointed_at=CURRENT_TIMESTAMP "+
  "WHERE realm_id=? AND round_id=? AND alliance_id=? "+
  "AND EXISTS(SELECT 1 FROM alliance_members m JOIN kingdoms k ON k.id=m.kingdom_id "+
  "WHERE m.alliance_id=? AND m.kingdom_id=? AND k.map_region=?)"
 ).bind(nominee,ctx.realm,crown.round_id,member.alliance_id,
   member.alliance_id,nominee,ctx.realm).run();
 if(!updated.meta?.changes)throw new ThroneWarError("O candidato precisa ser da aliança e do mesmo mapa.",409);
 return {success:true,message:"Rei nomeado pela aliança vencedora."};
}

export async function throneAction(env,playerId,body,units,now=Date.now()){
 const ctx=await context(env,playerId);
 if(body?.intent==="appoint")return nominateKing(env,ctx,body);
 const intent=String(body?.intent||"");
 if(!["attack","reinforce"].includes(intent))
   throw new ThroneWarError("Ação do Trono inválida.",400);
 const phase=thronePhase(ctx.openedAt,now);
 if(!phase.canAttack)
   throw new ThroneWarError(phase.phase==="shield"
     ?"O Trono está sob escudo inicial de 35 dias."
     :"A Guerra do Trono está fora da fase de disputa.",409);
 await awardCrown(env,ctx.realm,phase,now);
 const crown=await env.DB.prepare(
  "SELECT 1 FROM throne_crowns WHERE realm_id=? AND round_id=?"
 ).bind(ctx.realm,phase.roundId).first();
 if(crown)throw new ThroneWarError("A aliança vencedora já conquistou este Trono.",409);
 const alliance=await env.DB.prepare(
  "SELECT a.id FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id "+
  "WHERE m.kingdom_id=?"
 ).bind(ctx.kingdomId).first();
 if(!alliance)throw new ThroneWarError("É necessário participar de uma aliança.",403);
 const requestId=String(body?.requestId||"").toLowerCase();
 if(!ACTION_ID.test(requestId))throw new ThroneWarError("Identificador de batalha inválido.",400);
 const existing=await env.DB.prepare(
  "SELECT kingdom_id FROM throne_siege_actions WHERE action_id=?"
 ).bind(requestId).first();
 if(existing){
  if(Number(existing.kingdom_id)!==ctx.kingdomId)throw new ThroneWarError("Identificador de batalha já utilizado.",409);
  return {success:true,duplicate:true,message:"Batalha já processada.",state:await throneStatus(env,playerId,now)};
 }
 const unit=String(body?.unitType||"");
 const {power,casualties}=thronePowerForArmy(unit,body?.quantity,units);
 const quantity=Number(body.quantity);
 const siege=await env.DB.prepare(
  "SELECT holding_alliance_id,garrison_power FROM throne_sieges WHERE realm_id=? AND round_id=?"
 ).bind(ctx.realm,phase.roundId).first();
 if(!siege&&intent==="reinforce")
   throw new ThroneWarError("O Trono ainda não tem guarnição aliada.",409);
 if(!siege&&power<THRONE_NPC_POWER)
   throw new ThroneWarError("O ataque precisa superar a guarda inicial do Trono.",409);
 if(siege&&Number(siege.holding_alliance_id)===Number(alliance.id)&&intent!=="reinforce")
   throw new ThroneWarError("Sua aliança já ocupa o Trono. Envie reforços.",409);
 if(siege&&Number(siege.holding_alliance_id)!==Number(alliance.id)&&intent!=="attack")
   throw new ThroneWarError("Apenas a aliança ocupante pode reforçar o Trono.",403);
 const createdAt=new Date(now).toISOString();
 // D1.batch executa os três comandos na mesma transação SQLite.
 // changes() liga cada escrita ao sucesso da anterior; duplicatas/sem tropas
 // não descontam unidades nem alteram o ocupante.
 const insert=env.DB.prepare(
  "INSERT OR IGNORE INTO throne_siege_actions(action_id,realm_id,round_id,kingdom_id,"+
  "alliance_id,action_kind,unit_type,unit_quantity,casualties,power,created_at) "+
  "SELECT ?,?,?,?,?,?,?,?,?,?,? FROM army_units u "+
  "WHERE u.kingdom_id=? AND u.unit_type=? AND u.tier=1 AND u.quantity>=? "+
  "AND EXISTS(SELECT 1 FROM alliance_members m WHERE m.alliance_id=? AND m.kingdom_id=?) "+
  "AND NOT EXISTS(SELECT 1 FROM throne_crowns c WHERE c.realm_id=? AND c.round_id=?) "+
  "AND NOT EXISTS(SELECT 1 FROM throne_siege_actions a WHERE a.realm_id=? AND a.round_id=? "+
  "AND a.kingdom_id=? AND datetime(a.created_at)>=datetime(?,'-300 seconds'))"
 ).bind(requestId,ctx.realm,phase.roundId,ctx.kingdomId,alliance.id,intent,unit,quantity,
   casualties,power,createdAt,ctx.kingdomId,unit,casualties,alliance.id,ctx.kingdomId,
   ctx.realm,phase.roundId,ctx.realm,phase.roundId,ctx.kingdomId,createdAt);
 const debit=env.DB.prepare(
  "UPDATE army_units SET quantity=quantity-? WHERE kingdom_id=? AND unit_type=? "+
  "AND tier=1 AND quantity>=? AND changes()=1"
 ).bind(casualties,ctx.kingdomId,unit,casualties);
 // Resolve o poder do defensor de forma atômica no CONFLICT, sem confiar
 // na leitura anterior e sem dar pontos de ataque infinitos.
 const upsert=env.DB.prepare(
  "INSERT INTO throne_sieges(realm_id,round_id,holding_alliance_id,holding_kingdom_id,"+
  "held_since,garrison_power,updated_at) "+
  "SELECT ?,?,?,?,?,?,? WHERE changes()=1 "+
  "ON CONFLICT(realm_id,round_id) DO UPDATE SET "+
  "holding_alliance_id=CASE WHEN excluded.holding_alliance_id=throne_sieges.holding_alliance_id "+
  "THEN throne_sieges.holding_alliance_id WHEN excluded.garrison_power>throne_sieges.garrison_power "+
  "THEN excluded.holding_alliance_id ELSE throne_sieges.holding_alliance_id END,"+
  "holding_kingdom_id=CASE WHEN excluded.holding_alliance_id<>throne_sieges.holding_alliance_id "+
  "AND excluded.garrison_power>throne_sieges.garrison_power THEN excluded.holding_kingdom_id "+
  "ELSE throne_sieges.holding_kingdom_id END,"+
  "held_since=CASE WHEN excluded.holding_alliance_id<>throne_sieges.holding_alliance_id "+
  "AND excluded.garrison_power>throne_sieges.garrison_power THEN excluded.held_since "+
  "ELSE throne_sieges.held_since END,"+
  "garrison_power=CASE WHEN excluded.holding_alliance_id=throne_sieges.holding_alliance_id "+
  "THEN MIN(1000000,throne_sieges.garrison_power+excluded.garrison_power) "+
  "WHEN excluded.garrison_power>throne_sieges.garrison_power "+
  "THEN MAX(1,excluded.garrison_power-throne_sieges.garrison_power) "+
  "ELSE MAX(1,throne_sieges.garrison_power-excluded.garrison_power) END,"+
  "updated_at=excluded.updated_at"
 ).bind(ctx.realm,phase.roundId,alliance.id,ctx.kingdomId,createdAt,
   Math.min(THRONE_GARRISON_CAP,power),createdAt);
 const batch=await env.DB.batch([insert,debit,upsert]);
 if(!batch?.[0]?.meta?.changes||!batch?.[1]?.meta?.changes||!batch?.[2]?.meta?.changes){
   // Requisições simultâneas com o mesmo ID/cooldown são rejeitadas.
   throw new ThroneWarError("Batalha recusada: verifique tropas, espera de 5 minutos ou atualização do Trono.",409);
 }
 const current=await throneStatus(env,playerId,now);
 const holds=Number(current.holder?.allianceId)===Number(alliance.id);
 return {success:true,kind:intent,result:holds?"alliance_holds_throne":"throne_defended",
   casualties,remainingCooldownSeconds:THRONE_ACTION_COOLDOWN_SECONDS,state:current};
}
