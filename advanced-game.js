const randomUUID = () => crypto.randomUUID();

const UNIT_TYPES = new Set([
  "militia","swordsman","spearman","archer","cavalry","knight",
  "crossbowman","mage","catapult","ram","trebuchet"
]);
const RESOURCE_KEYS = new Set(["food","wood","stone","iron","gold"]);
const SPEEDUP_SECONDS = new Set([60,300,900,1800,3600,14400,28800,86400]);
const QUALITY_LEVELS = new Set(["low","medium","high","ultra"]);
const json = (data,status=200) => Response.json(data,{
  status,
  headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
const int = (value,min=0,max=1000000) => {
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;
};
const parseJson = value => {
  try { return JSON.parse(String(value||"{}")); } catch { return {}; }
};

async function contextFor(env,publicPlayerId){
  return await env.DB.prepare(
    "SELECT p.id AS player_id,p.name AS player_name,p.gems,k.id AS kingdom_id,k.kingdom_name,k.power,k.castle_level " +
    "FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?"
  ).bind(publicPlayerId).first();
}

async function getTech(env,kingdomId){
  const rows=await env.DB.prepare(
    "SELECT c.id,c.name,c.description,c.category,c.max_level,c.base_cost_gold,c.base_research_time," +
    "c.prerequisite_tech,c.effect_json,COALESCE(t.level,0) AS level," +
    "COALESCE(t.research_end_time,0) AS research_end_time " +
    "FROM tech_catalog c LEFT JOIN kingdom_tech t ON t.tech_id=c.id AND t.kingdom_id=? " +
    "ORDER BY c.category,c.id"
  ).bind(kingdomId).all();
  return (rows.results||[]).map(row=>({
    ...row,effect:parseJson(row.effect_json),
    level:Number(row.level||0),research_end_time:Number(row.research_end_time||0)
  }));
}

async function startTechResearch(env,kingdomId,body){
  const techId=String(body.tech_id||"");
  if(!/^[a-z_]{3,40}$/.test(techId))return json({error:"Tecnologia inválida."},400);
  const tech=await env.DB.prepare(
    "SELECT id,base_cost_gold,base_research_time,max_level,prerequisite_tech " +
    "FROM tech_catalog WHERE id=? AND active=1"
  ).bind(techId).first();
  if(!tech)return json({error:"Tecnologia não encontrada."},404);
  const now=Math.floor(Date.now()/1000);
  const current=await env.DB.prepare(
    "SELECT level,research_end_time FROM kingdom_tech WHERE kingdom_id=? AND tech_id=?"
  ).bind(kingdomId,techId).first();
  const level=Number(current?.level||0);
  if(level>=Number(tech.max_level))return json({error:"Tecnologia no nível máximo."},409);
  if(Number(current?.research_end_time||0)>0)return json({error:"Esta tecnologia já está em pesquisa ou aguarda conclusão do Cron."},409);
  if(tech.prerequisite_tech){
    const prerequisite=await env.DB.prepare(
      "SELECT level FROM kingdom_tech WHERE kingdom_id=? AND tech_id=?"
    ).bind(kingdomId,tech.prerequisite_tech).first();
    if(Number(prerequisite?.level||0)<3)return json({error:"Pesquise o pré-requisito até o nível 3."},409);
  }
  const active=await env.DB.prepare(
    "SELECT tech_id FROM kingdom_tech WHERE kingdom_id=? AND research_end_time>?"
  ).bind(kingdomId,now).first();
  if(active)return json({error:"A fila de tecnologia já está ocupada."},409);
  const cost=Number(tech.base_cost_gold)*(level+1);
  const duration=Number(tech.base_research_time)*(level+1);
  const completesAt=now+duration;
  const result=await env.DB.batch([
    env.DB.prepare(
      "UPDATE kingdoms SET gold=gold-?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=? AND gold>=? AND NOT EXISTS(" +
      "SELECT 1 FROM kingdom_tech WHERE kingdom_id=? AND research_end_time>?)"
    ).bind(cost,kingdomId,cost,kingdomId,now),
    env.DB.prepare(
      "INSERT INTO kingdom_tech(kingdom_id,tech_id,level,research_end_time) " +
      "SELECT ?,?,0,? WHERE changes()=1 " +
      "ON CONFLICT(kingdom_id,tech_id) DO UPDATE SET " +
      "research_end_time=excluded.research_end_time,updated_at=unixepoch() " +
      "WHERE kingdom_tech.research_end_time=0"
    ).bind(kingdomId,techId,completesAt)
  ]);
  if(Number(result[0]?.meta?.changes||0)!==1||Number(result[1]?.meta?.changes||0)!==1){
    return json({error:"Ouro insuficiente ou outra pesquisa foi iniciada. Atualize o painel."},409);
  }
  return json({success:true,tech_id:techId,level:level+1,cost,completes_at:completesAt},202);
}

export async function processDueKingdomTech(env,nowSeconds=Math.floor(Date.now()/1000)){
  if(!env?.DB)return {completed:0};
  const due=await env.DB.prepare(
    "SELECT kingdom_id,tech_id,level FROM kingdom_tech WHERE research_end_time>0 AND research_end_time<=? LIMIT 200"
  ).bind(nowSeconds).all();
  let completed=0;
  for(const row of due.results||[]){
    const token=randomUUID();
    const result=await env.DB.batch([
      env.DB.prepare(
        "UPDATE kingdom_tech SET level=level+1,research_end_time=0,updated_at=? " +
        "WHERE kingdom_id=? AND tech_id=? AND level=? AND research_end_time>0 AND research_end_time<=?"
      ).bind(nowSeconds,row.kingdom_id,row.tech_id,row.level,nowSeconds),
      env.DB.prepare(
        "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) " +
        "SELECT ?, 'tech_research_completed', ? WHERE changes()=1"
      ).bind(row.kingdom_id,JSON.stringify({tech_id:row.tech_id,level:Number(row.level)+1,token}))
    ]);
    completed+=Number(result[0]?.meta?.changes||0);
  }
  return {completed};
}

async function getVIP(env,playerId){
  await env.DB.prepare("INSERT OR IGNORE INTO player_vip(player_id,vip_level,vip_exp) VALUES(?,0,0)").bind(playerId).run();
  const row=await env.DB.prepare(
    "SELECT v.vip_level,v.vip_exp,v.vip_expires,b.build_speed_bonus,b.train_speed_bonus," +
    "b.research_speed_bonus,b.resource_bonus,b.march_speed_bonus,b.daily_gift_json " +
    "FROM player_vip v LEFT JOIN vip_benefits b ON b.vip_level=v.vip_level WHERE v.player_id=?"
  ).bind(playerId).first();
  return {
    vip_level:Number(row?.vip_level||0),vip_exp:Number(row?.vip_exp||0),
    vip_expires:row?.vip_expires??null,
    benefits:{
      build_speed:Number(row?.build_speed_bonus||0),
      train_speed:Number(row?.train_speed_bonus||0),
      research_speed:Number(row?.research_speed_bonus||0),
      resource_bonus:Number(row?.resource_bonus||0),
      march_speed:Number(row?.march_speed_bonus||0),
      daily_gift:parseJson(row?.daily_gift_json)
    },
    note:"A evolução VIP depende de pacote confirmado pelo sistema de pagamento; o cliente não define preço nem nível."
  };
}

async function getSpeedups(env,playerId){
  const rows=await env.DB.prepare(
    "SELECT speedup_type,duration_seconds,quantity FROM player_speedups " +
    "WHERE player_id=? AND quantity>0 ORDER BY speedup_type,duration_seconds"
  ).bind(playerId).all();
  return rows.results||[];
}

async function useSpeedup(env,playerId,kingdomId,body){
  const type=String(body.speedup_type||"");
  const seconds=int(body.duration_seconds,1,86400);
  const targetId=int(body.target_id,1,Number.MAX_SAFE_INTEGER);
  if(!["build","train","research","march"].includes(type)||!seconds||!SPEEDUP_SECONDS.has(seconds)||!targetId){
    return json({error:"Acelerador ou alvo inválido."},400);
  }
  const now=Date.now();
  const nowIso=new Date(now).toISOString();
  let target=null,nextValue=null,sql=null,bindings=null;
  if(type==="march"){
    target=await env.DB.prepare(
      "SELECT arrives_at AS completes_at FROM marches WHERE id=? AND kingdom_id=? AND status='marching'"
    ).bind(targetId,kingdomId).first();
    if(!target)return json({error:"Marcha ativa não encontrada."},404);
    const end=Date.parse(target.completes_at||"");
    if(!Number.isFinite(end)||end<=now)return json({error:"Esta marcha já está concluída."},409);
    nextValue=new Date(Math.max(now,end-seconds*1000)).toISOString();
    sql="UPDATE marches SET arrives_at=? WHERE id=? AND kingdom_id=? AND status='marching' AND arrives_at=? AND changes()=1";
    bindings=[nextValue,targetId,kingdomId,target.completes_at];
  }else{
    const queueType=type==="build"?"construction":type==="train"?"training":"research";
    target=await env.DB.prepare(
      "SELECT completes_at FROM kingdom_queues WHERE id=? AND kingdom_id=? AND queue_type=? AND status='running'"
    ).bind(targetId,kingdomId,queueType).first();
    if(!target)return json({error:"Fila ativa não encontrada."},404);
    const end=Date.parse(target.completes_at||"");
    if(!Number.isFinite(end)||end<=now)return json({error:"Esta fila já está concluída."},409);
    nextValue=new Date(Math.max(now,end-seconds*1000)).toISOString();
    sql="UPDATE kingdom_queues SET completes_at=? WHERE id=? AND kingdom_id=? AND queue_type=? AND status='running' AND completes_at=? AND changes()=1";
    bindings=[nextValue,targetId,kingdomId,queueType,target.completes_at];
  }
  const inventory=env.DB.prepare(
    "UPDATE player_speedups SET quantity=quantity-1 WHERE player_id=? AND speedup_type=? " +
    "AND duration_seconds=? AND quantity>0 AND EXISTS(" +
    "SELECT 1 FROM "+(type==="march"?"marches":"kingdom_queues")+" WHERE id=? AND " +
    (type==="march"?"kingdom_id=? AND status='marching' AND arrives_at=?":"kingdom_id=? AND status='running' AND completes_at=?")+
    ")"
  ).bind(playerId,type,seconds,targetId,kingdomId,target.completes_at);
  const update=env.DB.prepare(sql).bind(...bindings);
  const result=await env.DB.batch([inventory,update]);
  if(Number(result[0]?.meta?.changes||0)!==1||Number(result[1]?.meta?.changes||0)!==1){
    return json({error:"Acelerador indisponível ou alvo alterado. Nada foi consumido."},409);
  }
  return json({success:true,seconds_removed:seconds,new_completion:nextValue});
}

function utcPeriod(){
  return new Date().toISOString().slice(0,10);
}
async function taskProgress(env,kingdomId,playerId,taskType){
  const since=utcPeriod()+" 00:00:00";
  if(taskType==="battle"){
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM battle_reports WHERE winner_kingdom_id=? AND created_at>=?"
    ).bind(kingdomId,since).first();
    return Number(row?.n||0);
  }
  if(taskType==="build"){
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM kingdom_queues WHERE kingdom_id=? AND queue_type='construction' " +
      "AND status='completed' AND completed_at>=?"
    ).bind(kingdomId,since).first();
    return Number(row?.n||0);
  }
  if(taskType==="gather"){
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM resource_ledger WHERE kingdom_id=? AND reason LIKE 'coleta de nó de recurso:%' AND created_at>=?"
    ).bind(kingdomId,since).first();
    return Number(row?.n||0);
  }
  if(taskType==="research"){
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM kingdom_events WHERE kingdom_id=? AND event_type='tech_research_completed' AND created_at>=?"
    ).bind(kingdomId,since).first();
    const queue=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM kingdom_queues WHERE kingdom_id=? AND queue_type='research' AND status='completed' AND completed_at>=?"
    ).bind(kingdomId,since).first();
    return Number(row?.n||0)+Number(queue?.n||0);
  }
  if(taskType==="train"){
    const row=await env.DB.prepare(
      "SELECT COALESCE(SUM(quantity),0) AS n FROM army_units WHERE kingdom_id=?"
    ).bind(kingdomId).first();
    return Number(row?.n||0);
  }
  if(taskType==="login"){
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM analytics_events WHERE player_id=? AND event='kingdom.opened' AND created_at>=?"
    ).bind(playerId,since).first();
    return Number(row?.n||0);
  }
  return 0;
}

function safeReward(raw){
  const source=typeof raw==="string"?parseJson(raw):raw||{};
  const result={};
  for(const key of ["gems","food","wood","stone","iron","gold"]){
    const amount=int(source[key],0,100000);
    if(amount!==null&&amount>0)result[key]=amount;
  }
  const speedup=source.speedup;
  if(speedup&&typeof speedup==="object"){
    const type=String(speedup.type||"");
    const seconds=int(speedup.seconds,1,86400);
    const quantity=int(speedup.quantity,1,100);
    if(["build","train","research","march"].includes(type)&&seconds&&SPEEDUP_SECONDS.has(seconds)&&quantity){
      result.speedup={type,seconds,quantity};
    }
  }
  return result;
}

async function grantReward(env,ctx,reward,claimStatement){
  const token=randomUUID();
  const guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_reward_guard' AND payload_json=?)";
  const statements=[
    claimStatement,
    env.DB.prepare(
      "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()=1"
    ).bind(ctx.kingdom_id,"__internal_reward_guard",token)
  ];
  if(reward.gems){
    statements.push(env.DB.prepare(
      "UPDATE players SET gems=gems+? WHERE id=? AND "+guard
    ).bind(reward.gems,ctx.player_id,ctx.kingdom_id,token));
  }
  for(const resource of ["food","wood","stone","iron","gold"]){
    if(!reward[resource])continue;
    statements.push(env.DB.prepare(
      "UPDATE kingdoms SET "+resource+"="+resource+"+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND "+guard
    ).bind(reward[resource],ctx.kingdom_id,ctx.kingdom_id,token));
  }
  if(reward.speedup){
    statements.push(env.DB.prepare(
      "INSERT INTO player_speedups(player_id,speedup_type,duration_seconds,quantity) " +
      "SELECT ?,?,?,? WHERE "+guard+
      " ON CONFLICT(player_id,speedup_type,duration_seconds) DO UPDATE SET quantity=quantity+excluded.quantity"
    ).bind(ctx.player_id,reward.speedup.type,reward.speedup.seconds,reward.speedup.quantity,ctx.kingdom_id,token));
  }
  statements.push(env.DB.prepare(
    "DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_reward_guard' AND payload_json=?"
  ).bind(ctx.kingdom_id,token));
  const result=await env.DB.batch(statements);
  return Number(result[0]?.meta?.changes||0)===1;
}

async function getTasks(env,ctx){
  const period=utcPeriod();
  const tasks=await env.DB.prepare(
    "SELECT id,title,description,task_type,target_count,reward_json FROM daily_tasks WHERE active=1 AND is_daily=1 ORDER BY id"
  ).all();
  const output=[];
  for(const task of tasks.results||[]){
    const progress=await taskProgress(env,ctx.kingdom_id,ctx.player_id,task.task_type);
    const completed=progress>=Number(task.target_count);
    await env.DB.prepare(
      "INSERT INTO player_task_progress(kingdom_id,task_id,period_key,progress,completed) VALUES(?,?,?,?,?) " +
      "ON CONFLICT(kingdom_id,task_id,period_key) DO UPDATE SET progress=excluded.progress," +
      "completed=MAX(player_task_progress.completed,excluded.completed),updated_at=unixepoch()"
    ).bind(ctx.kingdom_id,task.id,period,progress,completed?1:0).run();
    const prior=await env.DB.prepare(
      "SELECT claimed FROM player_task_progress WHERE kingdom_id=? AND task_id=? AND period_key=?"
    ).bind(ctx.kingdom_id,task.id,period).first();
    output.push({
      id:task.id,title:task.title,description:task.description,
      task_type:task.task_type,target_count:Number(task.target_count),
      progress,completed,claimed:Number(prior?.claimed||0)===1,
      reward:safeReward(task.reward_json)
    });
  }
  return {period,tasks:output};
}

async function claimTask(env,ctx,body){
  const taskId=String(body.task_id||"");
  const period=utcPeriod();
  const task=await env.DB.prepare(
    "SELECT id,task_type,target_count,reward_json FROM daily_tasks WHERE id=? AND active=1 AND is_daily=1"
  ).bind(taskId).first();
  if(!task)return json({error:"Tarefa não encontrada."},404);
  const progress=await taskProgress(env,ctx.kingdom_id,ctx.player_id,task.task_type);
  if(progress<Number(task.target_count))return json({error:"A tarefa ainda não foi concluída."},409);
  const reward=safeReward(task.reward_json);
  const claim=env.DB.prepare(
    "INSERT INTO player_task_progress(kingdom_id,task_id,period_key,progress,completed,claimed) " +
    "VALUES(?,?,?,?,1,1) ON CONFLICT(kingdom_id,task_id,period_key) DO UPDATE SET " +
    "progress=excluded.progress,completed=1,claimed=1,updated_at=unixepoch() " +
    "WHERE player_task_progress.claimed=0 AND excluded.completed=1"
  ).bind(ctx.kingdom_id,task.id,period,progress);
  const ok=await grantReward(env,ctx,reward,claim);
  if(!ok)return json({error:"Esta recompensa já foi resgatada."},409);
  return json({success:true,reward});
}

async function getMail(env,ctx){
  await env.DB.prepare(
    "UPDATE player_mail SET is_read=1 WHERE recipient_id=? AND is_read=0"
  ).bind(ctx.player_id).run();
  const rows=await env.DB.prepare(
    "SELECT id,sender_name,subject,body,attachment_json,is_read,is_claimed,created_at,expires_at " +
    "FROM player_mail WHERE recipient_id=? AND (expires_at IS NULL OR expires_at>unixepoch()) " +
    "ORDER BY created_at DESC,id DESC LIMIT 50"
  ).bind(ctx.player_id).all();
  return (rows.results||[]).map(row=>({
    id:row.id,sender_name:row.sender_name,subject:row.subject,body:row.body,
    attachment:row.attachment_json?safeReward(row.attachment_json):null,
    is_read:Number(row.is_read)===1,is_claimed:Number(row.is_claimed)===1,
    created_at:row.created_at
  }));
}
async function claimMail(env,ctx,body){
  const mailId=int(body.mail_id,1,Number.MAX_SAFE_INTEGER);
  if(!mailId)return json({error:"Mensagem inválida."},400);
  const row=await env.DB.prepare(
    "SELECT id,attachment_json,is_claimed FROM player_mail WHERE id=? AND recipient_id=? " +
    "AND (expires_at IS NULL OR expires_at>unixepoch())"
  ).bind(mailId,ctx.player_id).first();
  if(!row||!row.attachment_json)return json({error:"Esta mensagem não possui anexos disponíveis."},404);
  if(Number(row.is_claimed)===1)return json({error:"Os anexos já foram resgatados."},409);
  const reward=safeReward(row.attachment_json);
  if(!Object.keys(reward).length)return json({error:"O anexo não contém uma recompensa válida."},409);
  const claim=env.DB.prepare(
    "UPDATE player_mail SET is_claimed=1,is_read=1 WHERE id=? AND recipient_id=? AND is_claimed=0"
  ).bind(mailId,ctx.player_id);
  const ok=await grantReward(env,ctx,reward,claim);
  if(!ok)return json({error:"Os anexos já foram resgatados."},409);
  return json({success:true,reward});
}

async function achievementProgress(env,ctx,type){
  if(type==="battles_won"){
    const r=await env.DB.prepare("SELECT COUNT(*) AS n FROM battle_reports WHERE winner_kingdom_id=?").bind(ctx.kingdom_id).first();
    return Number(r?.n||0);
  }
  if(type==="building_levels"){
    const r=await env.DB.prepare("SELECT COALESCE(SUM(level),0) AS n FROM kingdom_buildings WHERE kingdom_id=?").bind(ctx.kingdom_id).first();
    return Number(r?.n||0);
  }
  if(type==="alliance_joined"){
    const r=await env.DB.prepare("SELECT COUNT(*) AS n FROM alliance_members WHERE kingdom_id=?").bind(ctx.kingdom_id).first();
    return Number(r?.n||0);
  }
  if(type==="resources_received"){
    const r=await env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM resource_ledger WHERE kingdom_id=? AND amount>0").bind(ctx.kingdom_id).first();
    return Number(r?.n||0);
  }
  return 0;
}
async function getAchievements(env,ctx){
  const rows=await env.DB.prepare(
    "SELECT a.id,a.title,a.description,a.category,a.tier,a.requirement_type,a.requirement_value," +
    "a.reward_json,COALESCE(p.progress,0) AS saved_progress,COALESCE(p.claimed,0) AS claimed " +
    "FROM achievements a LEFT JOIN player_achievements p ON p.achievement_id=a.id AND p.kingdom_id=? " +
    "ORDER BY a.category,a.tier,a.id"
  ).bind(ctx.kingdom_id).all();
  const result=[];
  for(const row of rows.results||[]){
    const progress=await achievementProgress(env,ctx,row.requirement_type);
    const completed=progress>=Number(row.requirement_value);
    await env.DB.prepare(
      "INSERT INTO player_achievements(kingdom_id,achievement_id,progress,completed,completed_at) " +
      "VALUES(?,?,?,?,CASE WHEN ?=1 THEN unixepoch() ELSE NULL END) " +
      "ON CONFLICT(kingdom_id,achievement_id) DO UPDATE SET progress=excluded.progress," +
      "completed=MAX(player_achievements.completed,excluded.completed)," +
      "completed_at=COALESCE(player_achievements.completed_at,excluded.completed_at)"
    ).bind(ctx.kingdom_id,row.id,progress,completed?1:0,completed?1:0).run();
    const claimed=Number(row.claimed||0)===1;
    result.push({
      id:row.id,title:row.title,description:row.description,category:row.category,
      tier:Number(row.tier),progress,requirement_value:Number(row.requirement_value),
      completed,claimed,reward:safeReward(row.reward_json)
    });
  }
  return result;
}
async function claimAchievement(env,ctx,body){
  const id=String(body.achievement_id||"");
  const row=await env.DB.prepare(
    "SELECT id,requirement_type,requirement_value,reward_json FROM achievements WHERE id=?"
  ).bind(id).first();
  if(!row)return json({error:"Conquista não encontrada."},404);
  const progress=await achievementProgress(env,ctx,row.requirement_type);
  if(progress<Number(row.requirement_value))return json({error:"Conquista ainda não concluída."},409);
  const claim=env.DB.prepare(
    "INSERT INTO player_achievements(kingdom_id,achievement_id,progress,completed,claimed,completed_at) " +
    "VALUES(?,?,?,1,1,unixepoch()) ON CONFLICT(kingdom_id,achievement_id) DO UPDATE SET " +
    "progress=excluded.progress,completed=1,claimed=1,completed_at=COALESCE(player_achievements.completed_at,unixepoch()) " +
    "WHERE player_achievements.claimed=0"
  ).bind(ctx.kingdom_id,id,progress);
  const ok=await grantReward(env,ctx,safeReward(row.reward_json),claim);
  if(!ok)return json({error:"Esta recompensa já foi resgatada."},409);
  return json({success:true,reward:safeReward(row.reward_json)});
}

async function getFormations(env,kingdomId){
  const rows=await env.DB.prepare(
    "SELECT f.slot_number,f.formation_name,f.troop_data,f.hero_id,f.is_active,h.hero_name " +
    "FROM troop_formations f LEFT JOIN heroes h ON h.id=f.hero_id AND h.kingdom_id=f.kingdom_id " +
    "WHERE f.kingdom_id=? ORDER BY f.slot_number"
  ).bind(kingdomId).all();
  return (rows.results||[]).map(row=>({...row,troops:parseJson(row.troop_data)}));
}
async function saveFormation(env,kingdomId,body){
  const slot=int(body.slot_number,1,5);
  const name=String(body.formation_name||"Formação "+slot).trim().slice(0,32);
  const input=body.troop_data;
  if(!slot||!name||!input||typeof input!=="object"||Array.isArray(input))return json({error:"Formação inválida."},400);
  const entries=Object.entries(input);
  if(!entries.length||entries.length>UNIT_TYPES.size)return json({error:"Selecione pelo menos uma tropa."},400);
  const owned=await env.DB.prepare(
    "SELECT unit_type,SUM(quantity) AS quantity FROM army_units WHERE kingdom_id=? AND tier=1 GROUP BY unit_type"
  ).bind(kingdomId).all();
  const available=new Map((owned.results||[]).map(row=>[row.unit_type,Number(row.quantity||0)]));
  const troops={};
  for(const [type,raw] of entries){
    const quantity=int(raw,0,100000);
    if(!UNIT_TYPES.has(type)||quantity===null||quantity>Number(available.get(type)||0))return json({error:"A formação contém tropas inválidas ou em quantidade superior ao exército."},400);
    if(quantity>0)troops[type]=quantity;
  }
  if(!Object.keys(troops).length)return json({error:"A formação deve conter tropas."},400);
  const heroId=body.hero_id===undefined||body.hero_id===null||body.hero_id===""?null:int(body.hero_id,1,Number.MAX_SAFE_INTEGER);
  if(body.hero_id!==undefined&&body.hero_id!==null&&body.hero_id!==""&&!heroId)return json({error:"Herói inválido."},400);
  if(heroId){
    const hero=await env.DB.prepare("SELECT id FROM heroes WHERE id=? AND kingdom_id=?").bind(heroId,kingdomId).first();
    if(!hero)return json({error:"O herói não pertence ao seu reino."},403);
  }
  const activate=body.is_active===true;
  const statements=[];
  if(activate)statements.push(env.DB.prepare("UPDATE troop_formations SET is_active=0 WHERE kingdom_id=?").bind(kingdomId));
  statements.push(env.DB.prepare(
    "INSERT INTO troop_formations(kingdom_id,slot_number,formation_name,troop_data,hero_id,is_active,updated_at) " +
    "VALUES(?,?,?,?,?,?,unixepoch()) ON CONFLICT(kingdom_id,slot_number) DO UPDATE SET " +
    "formation_name=excluded.formation_name,troop_data=excluded.troop_data,hero_id=excluded.hero_id," +
    "is_active=excluded.is_active,updated_at=unixepoch()"
  ).bind(kingdomId,slot,name,JSON.stringify(troops),heroId,activate?1:0));
  await env.DB.batch(statements);
  return json({success:true,slot_number:slot,formation_name:name,is_active:activate});
}

async function getMounts(env,kingdomId){
  await env.DB.prepare(
    "INSERT OR IGNORE INTO player_mounts(kingdom_id,mount_id,level,is_equipped) " +
    "SELECT ?, 'horse_basic',1,1 WHERE NOT EXISTS(SELECT 1 FROM player_mounts WHERE kingdom_id=?)"
  ).bind(kingdomId,kingdomId).run();
  const rows=await env.DB.prepare(
    "SELECT m.id,m.name,m.description,m.rarity,m.speed_bonus,m.attack_bonus,m.defense_bonus,m.icon," +
    "p.level,p.is_equipped,p.obtained_at FROM player_mounts p JOIN mount_catalog m ON m.id=p.mount_id " +
    "WHERE p.kingdom_id=? ORDER BY p.is_equipped DESC,m.rarity DESC,m.name"
  ).bind(kingdomId).all();
  return rows.results||[];
}
async function equipMount(env,kingdomId,body){
  const id=String(body.mount_id||"");
  const owned=await env.DB.prepare(
    "SELECT mount_id FROM player_mounts WHERE kingdom_id=? AND mount_id=?"
  ).bind(kingdomId,id).first();
  if(!owned)return json({error:"Esta montaria não pertence ao seu reino."},404);
  await env.DB.batch([
    env.DB.prepare("UPDATE player_mounts SET is_equipped=0 WHERE kingdom_id=?").bind(kingdomId),
    env.DB.prepare("UPDATE player_mounts SET is_equipped=1 WHERE kingdom_id=? AND mount_id=?").bind(kingdomId,id)
  ]);
  return json({success:true,mount_id:id});
}

async function getVisualSettings(env,playerId){
  await env.DB.prepare(
    "INSERT OR IGNORE INTO player_visual_settings(player_id) VALUES(?)"
  ).bind(playerId).run();
  const row=await env.DB.prepare(
    "SELECT particles_enabled,screen_shake_enabled,damage_numbers_enabled," +
    "day_night_cycle_enabled,bloom_enabled,quality_level FROM player_visual_settings WHERE player_id=?"
  ).bind(playerId).first();
  return row||{};
}
async function saveVisualSettings(env,playerId,body){
  const current=await getVisualSettings(env,playerId);
  const bool=(key)=>body[key]===undefined?Number(current[key]):body[key]===true||body[key]===1?1:body[key]===false||body[key]===0?0:null;
  const values={
    particles_enabled:bool("particles_enabled"),
    screen_shake_enabled:bool("screen_shake_enabled"),
    damage_numbers_enabled:bool("damage_numbers_enabled"),
    day_night_cycle_enabled:bool("day_night_cycle_enabled"),
    bloom_enabled:bool("bloom_enabled"),
    quality_level:body.quality_level===undefined?current.quality_level:String(body.quality_level)
  };
  if(Object.values(values).some(value=>value===null)||!QUALITY_LEVELS.has(values.quality_level)){
    return json({error:"Configuração visual inválida."},400);
  }
  await env.DB.prepare(
    "UPDATE player_visual_settings SET particles_enabled=?,screen_shake_enabled=?," +
    "damage_numbers_enabled=?,day_night_cycle_enabled=?,bloom_enabled=?,quality_level=?,updated_at=unixepoch() " +
    "WHERE player_id=?"
  ).bind(values.particles_enabled,values.screen_shake_enabled,values.damage_numbers_enabled,
    values.day_night_cycle_enabled,values.bloom_enabled,values.quality_level,playerId).run();
  return json({success:true,settings:values});
}


async function getQueues(env,kingdomId){
  const [queues,marches]=await Promise.all([
    env.DB.prepare(
      "SELECT id,queue_type,target_key,quantity,started_at,completes_at FROM kingdom_queues " +
      "WHERE kingdom_id=? AND status='running' ORDER BY completes_at,id"
    ).bind(kingdomId).all(),
    env.DB.prepare(
      "SELECT id,march_type,target_territory_id,arrives_at AS completes_at FROM marches " +
      "WHERE kingdom_id=? AND status='marching' ORDER BY arrives_at,id"
    ).bind(kingdomId).all()
  ]);
  return {queues:queues.results||[],marches:marches.results||[]};
}

async function getRanking(env){
  const rows=await env.DB.prepare(
    "SELECT k.kingdom_name,k.castle_level,k.power," +
    "RANK() OVER(ORDER BY k.power DESC,k.id ASC) AS power_rank," +
    "COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id " +
    "WHERE am.kingdom_id=k.id LIMIT 1),'') AS alliance_tag " +
    "FROM kingdoms k ORDER BY k.power DESC,k.id ASC LIMIT 100"
  ).all();
  return rows.results||[];
}
async function getCosmeticCatalog(env,kingdomId){
  const [skins,portraits,owned]=await Promise.all([
    env.DB.prepare("SELECT id,name,description,rarity,model_url,icon FROM city_skin_catalog ORDER BY rarity,name").all(),
    env.DB.prepare("SELECT id,name,description,rarity,icon_url FROM portrait_catalog ORDER BY rarity,name").all(),
    env.DB.prepare("SELECT item_id,kind FROM kingdom_cosmetics WHERE kingdom_id=?").bind(kingdomId).all()
  ]);
  const ownedSet=new Set((owned.results||[]).map(row=>row.kind+":"+row.item_id));
  return {
    city_skins:(skins.results||[]).map(row=>({...row,owned:ownedSet.has("city_skin:"+row.id)})),
    portraits:(portraits.results||[]).map(row=>({...row,owned:ownedSet.has("portrait:"+row.id)}))
  };
}

export async function handleAdvancedGame(request,env,publicPlayerId,path,body={}){
  try{
    const ctx=await contextFor(env,publicPlayerId);
    if(!ctx)return json({error:"Reino não encontrado."},404);
    const method=request.method;
    if(method==="GET"){
      if(path==="tech")return json({technologies:await getTech(env,ctx.kingdom_id)});
      if(path==="vip")return json(await getVIP(env,ctx.player_id));
      if(path==="speedups")return json({speedups:await getSpeedups(env,ctx.player_id)});
      if(path==="tasks")return json(await getTasks(env,ctx));
      if(path==="mail")return json({mail:await getMail(env,ctx)});
      if(path==="achievements")return json({achievements:await getAchievements(env,ctx)});
      if(path==="ranking")return json({ranking:await getRanking(env)});
      if(path==="queues")return json(await getQueues(env,ctx.kingdom_id));
      if(path==="formations")return json({formations:await getFormations(env,ctx.kingdom_id)});
      if(path==="mounts")return json({mounts:await getMounts(env,ctx.kingdom_id)});
      if(path==="visuals")return json({settings:await getVisualSettings(env,ctx.player_id)});
      if(path==="cosmetics")return json(await getCosmeticCatalog(env,ctx.kingdom_id));
      return json({error:"Recurso avançado não encontrado."},404);
    }
    if(method!=="POST"&&method!=="PUT")return json({error:"Método não permitido."},405);
    if(path==="tech/research")return await startTechResearch(env,ctx.kingdom_id,body);
    if(path==="speedups/use")return await useSpeedup(env,ctx.player_id,ctx.kingdom_id,body);
    if(path==="tasks/claim")return await claimTask(env,ctx,body);
    if(path==="mail/claim")return await claimMail(env,ctx,body);
    if(path==="achievements/claim")return await claimAchievement(env,ctx,body);
    if(path==="formations/save")return await saveFormation(env,ctx.kingdom_id,body);
    if(path==="mounts/equip")return await equipMount(env,ctx.kingdom_id,body);
    if(path==="visuals"&&method==="PUT")return await saveVisualSettings(env,ctx.player_id,body);
    return json({error:"Ação avançada não encontrada."},404);
  }catch(error){
    console.error("advanced_game_request_failed",String(error?.message||error));
    return json({error:"Não foi possível processar o recurso avançado."},500);
  }
}
