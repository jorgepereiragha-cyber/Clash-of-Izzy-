// Recompensas por dia UTC. Saldo e streak calculados somente no D1.
export const DAILY_REWARDS = Object.freeze([
  { day:1, gems:50, wood:0, stone:0, iron:0, heroFragments:0 },
  { day:2, gems:0, wood:500, stone:0, iron:0, heroFragments:0 },
  { day:3, gems:100, wood:0, stone:0, iron:0, heroFragments:0 },
  { day:4, gems:0, wood:0, stone:500, iron:0, heroFragments:0 },
  { day:5, gems:150, wood:0, stone:0, iron:0, heroFragments:0 },
  { day:6, gems:0, wood:0, stone:0, iron:300, heroFragments:0 },
  { day:7, gems:500, wood:0, stone:0, iron:0, heroFragments:1 }
]);
export function nextRewardDay(lastDate, lastDay, todayUtc){
  if(typeof lastDate!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate))return 1;
  if(!Number.isInteger(lastDay)||lastDay<1||lastDay>7)return 1;
  const date=new Date(todayUtc+"T00:00:00.000Z");
  if(!Number.isFinite(date.getTime()))return 1;
  date.setUTCDate(date.getUTCDate()-1);
  return lastDate===date.toISOString().slice(0,10) ? lastDay%7+1 : 1;
}
const getLatestSql="SELECT claim_date,cycle_day FROM daily_reward_claims WHERE player_id=(SELECT id FROM players WHERE player_id=?) ORDER BY claim_date DESC LIMIT 1";
async function state(db,playerId) {
  const [today,last]=await db.batch([
    db.prepare("SELECT date('now') AS today").bind(),
    db.prepare(getLatestSql).bind(playerId)
  ]);
  const date=String(today.results?.[0]?.today||"");
  const previous=last.results?.[0]||null;
  const claimed=previous?.claim_date===date;
  const day=claimed ? Number(previous.cycle_day) : nextRewardDay(previous?.claim_date,Number(previous?.cycle_day),date);
  return {date,claimed,day,reward:DAILY_REWARDS[day-1],rewards:DAILY_REWARDS};
}
export async function handleDailyReward(request,env,playerId,json){
  if(request.method==="GET")return json(await state(env.DB,playerId));
  if(request.method!=="POST")return json({error:"Método não permitido."},405);
  // INSERT e créditos participam da mesma transação D1. changes() impede dupla concessão.
  const statements=[
    env.DB.prepare(`INSERT OR IGNORE INTO daily_reward_claims(player_id,claim_date,cycle_day)
      SELECT p.id,date('now'),CASE WHEN prev.claim_date=date('now','-1 day') THEN (prev.cycle_day%7)+1 ELSE 1 END
      FROM players p LEFT JOIN daily_reward_claims prev ON prev.player_id=p.id
      AND prev.claim_date=(SELECT MAX(claim_date) FROM daily_reward_claims WHERE player_id=p.id)
      WHERE p.player_id=?`).bind(playerId),
    env.DB.prepare(`UPDATE players SET gems=gems+CASE
      (SELECT cycle_day FROM daily_reward_claims WHERE player_id=players.id AND claim_date=date('now'))
      WHEN 1 THEN 50 WHEN 3 THEN 100 WHEN 5 THEN 150 WHEN 7 THEN 500 ELSE 0 END
      WHERE player_id=? AND changes()=1`).bind(playerId),
    env.DB.prepare(`UPDATE kingdoms SET
      wood=wood+CASE WHEN (SELECT cycle_day FROM daily_reward_claims WHERE player_id=kingdoms.player_id AND claim_date=date('now'))=2 THEN 500 ELSE 0 END,
      stone=stone+CASE WHEN (SELECT cycle_day FROM daily_reward_claims WHERE player_id=kingdoms.player_id AND claim_date=date('now'))=4 THEN 500 ELSE 0 END,
      iron=iron+CASE WHEN (SELECT cycle_day FROM daily_reward_claims WHERE player_id=kingdoms.player_id AND claim_date=date('now'))=6 THEN 300 ELSE 0 END,
      updated_at=CURRENT_TIMESTAMP
      WHERE player_id=(SELECT id FROM players WHERE player_id=?) AND changes()=1`).bind(playerId),
    env.DB.prepare(`INSERT INTO inventory_items(kingdom_id,item_key,quantity)
      SELECT k.id,'hero_fragment_common',1 FROM kingdoms k JOIN players p ON p.id=k.player_id
      JOIN daily_reward_claims d ON d.player_id=p.id AND d.claim_date=date('now')
      WHERE p.player_id=? AND d.cycle_day=7 AND changes()=1
      ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+1`).bind(playerId)
  ];
  const results=await env.DB.batch(statements);
  if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1||results[2]?.meta?.changes!==1){
    return json({error:"Recompensa de hoje já resgatada ou reino indisponível.",...await state(env.DB,playerId)},409);
  }
  const current=await state(env.DB,playerId);
  return json({success:true,...current,message:"Recompensa diária adicionada ao seu reino."},201);
}
