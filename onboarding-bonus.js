// Tutorial: comprovação de atividade real no banco; a conclusão visual não concede gemas.
const eligibilitySql=`SELECT p.id,
 EXISTS(SELECT 1 FROM player_nicknames n WHERE n.player_id=p.id) AS name_done,
 EXISTS(SELECT 1 FROM kingdom_queues q WHERE q.kingdom_id=k.id AND q.queue_type='construction' AND q.target_key='farm') AS farm_done,
 EXISTS(SELECT 1 FROM kingdom_queues q WHERE q.kingdom_id=k.id AND q.queue_type='training') AS training_done,
 EXISTS(SELECT 1 FROM onboarding_bonus_claims c WHERE c.player_id=p.id) AS claimed
 FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?`;
export async function handleOnboarding(request,env,playerId,json){
  if(!["GET","POST"].includes(request.method))return json({error:"Método não permitido."},405);
  const progress=await env.DB.prepare(eligibilitySql).bind(playerId).first();
  if(!progress)return json({error:"Reino não encontrado."},404);
  const name=Boolean(progress.name_done), farm=Boolean(progress.farm_done), training=Boolean(progress.training_done);
  const eligible=name&&farm&&training, claimed=Boolean(progress.claimed);
  if(request.method==="GET")return json({name,farm,training,eligible,claimed,rewardGems:500});
  if(claimed)return json({error:"Bônus de tutorial já resgatado.",name,farm,training,eligible,claimed},409);
  if(!eligible)return json({error:"Conclua as três ações do tutorial antes de resgatar.",name,farm,training,eligible,claimed},409);
  const result=await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO onboarding_bonus_claims(player_id)
      SELECT p.id FROM players p JOIN kingdoms k ON k.player_id=p.id
      WHERE p.player_id=?
        AND EXISTS(SELECT 1 FROM player_nicknames WHERE player_id=p.id)
        AND EXISTS(SELECT 1 FROM kingdom_queues WHERE kingdom_id=k.id AND queue_type='construction' AND target_key='farm')
        AND EXISTS(SELECT 1 FROM kingdom_queues WHERE kingdom_id=k.id AND queue_type='training')`).bind(playerId),
    env.DB.prepare("UPDATE players SET gems=gems+500 WHERE player_id=? AND changes()=1").bind(playerId)
  ]);
  if(result[0]?.meta?.changes!==1||result[1]?.meta?.changes!==1)
    return json({error:"Bônus já resgatado ou indisponível."},409);
  return json({success:true,claimed:true,rewardGems:500,message:"Tutorial concluído. 500 gemas creditadas no servidor."},201);
}
