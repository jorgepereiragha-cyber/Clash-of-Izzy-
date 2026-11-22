// Progressão paralela ao VIP: 80 níveis em oito faixas P1-P8, sem empilhar bônus de combate.
export const PLAYER_MAX_LEVEL=80;
export const PLAYER_MAX_PHASE=8;
export function requiredXpForLevel(level){
  if(!Number.isSafeInteger(level)||level<1||level>PLAYER_MAX_LEVEL)throw new RangeError("Nível de progressão inválido.");
  return 30*(level-1)*(level-1);
}
export function progressionFromXp(value=0){
  const xp=Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):0));
  let level=1;
  while(level<PLAYER_MAX_LEVEL&&xp>=requiredXpForLevel(level+1))level++;
  return Object.freeze({
    level,phase:"P"+(Math.floor((level-1)/10)+1),
    phaseNumber:Math.floor((level-1)/10)+1,
    xp,xpAtLevel:requiredXpForLevel(level),
    xpAtNextLevel:level===PLAYER_MAX_LEVEL?null:requiredXpForLevel(level+1),
    maxLevel:PLAYER_MAX_LEVEL,
    // VIP existente em kingdoms.prestige é independente; não duplicamos seus multiplicadores.
    bonuses:Object.freeze({attackPercent:0,defensePercent:0,productionPercent:0})
  });
}
export function queueProgressionXp(queue){
  if(queue.queue_type==="construction")return Math.min(10000,100*Math.max(1,Number(queue.to_level)||1));
  if(queue.queue_type==="research")return Math.min(10000,75*Math.max(1,Number(queue.to_level)||1));
  if(queue.queue_type==="training")return Math.min(10000,5*Math.max(1,Number(queue.quantity)||1));
  return 0;
}
export async function getKingdomProgression(env,kingdomId){
  await env.DB.prepare("INSERT OR IGNORE INTO kingdom_progression(kingdom_id) VALUES(?)").bind(kingdomId).run();
  const row=await env.DB.prepare("SELECT xp FROM kingdom_progression WHERE kingdom_id=?").bind(kingdomId).first();
  return progressionFromXp(row?.xp||0);
}
/**
 * Anexar essas instruções AO MESMO D1.batch que confirma a fila. `guard` é o
 * token aleatório e id da fila; INSERT OR IGNORE torna a concessão idempotente.
 */
export function progressionQueueStatements(env,queue,guard){
  const xp=queueProgressionXp(queue);
  if(!xp)return [];
  const source="queue:"+queue.id;
  return [
    env.DB.prepare("INSERT OR IGNORE INTO kingdom_progression(kingdom_id) VALUES(?)").bind(queue.kingdom_id),
    env.DB.prepare("INSERT OR IGNORE INTO progression_xp_ledger(kingdom_id,source_key,xp,reason) SELECT ?,?,?,? WHERE "+guard)
      .bind(queue.kingdom_id,source,xp,queue.queue_type,queue.id,queue.completionToken),
    env.DB.prepare("UPDATE kingdom_progression SET xp=MIN(100000000,xp+?),updated_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND changes()=1")
      .bind(xp,queue.kingdom_id)
  ];
}
