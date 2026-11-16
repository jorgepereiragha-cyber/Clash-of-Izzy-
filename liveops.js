import { simulateBattle } from "./game-adapter.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

const TUTORIAL_STEPS = [
  { id: 1, title: "Bem-vindo ao Clash of Izzy!", description: "Você é o soberano de um reino. Vamos aprender os fundamentos.", action: "continue", selector: null, reward: null },
  { id: 2, title: "Seu reino", description: "Observe os edifícios e o castelo que você já possui.", action: "continue", selector: "#buildings", reward: null },
  { id: 3, title: "Recursos do reino", description: "Acompanhe comida, madeira, pedra, ferro e ouro no painel de recursos.", action: "continue", selector: "#resources", reward: null },
  { id: 4, title: "Melhore a fazenda", description: "Conclua uma melhoria da Fazenda para aumentar a produção de comida.", action: "building_upgraded", selector: "#buildings", reward: { wood: 100, food: 100 } },
  { id: 5, title: "Treine sua milícia", description: "Conclua um treinamento de pelo menos 50 milícias no Quartel.", action: "troops_trained", selector: "#buildings", reward: { gems: 50 } },
  { id: 6, title: "Abra o mapa mundial", description: "Entre no mapa para conhecer territórios e rotas.", action: "continue", selector: "#goMap", reward: null },
  { id: 7, title: "Explore o mundo", description: "Observe os territórios e escolha uma região para explorar.", action: "continue", selector: "#goMap", reward: { gems: 50 } },
  { id: 8, title: "Conheça Kael", description: "Seu reino começa com Kael, Guardião do Sol. Conheça a tela de heróis.", action: "hero_exists", selector: null, reward: { shards: 10 } },
  { id: 9, title: "Equipe seu herói", description: "Equipe pelo menos uma peça no seu herói para ativar os bônus.", action: "equipment_equipped", selector: null, reward: { gems: 30 } },
  { id: 10, title: "Una-se a uma aliança", description: "Entre em uma aliança para colaborar com outros reinos.", action: "alliance_joined", selector: null, reward: { gems: 100 } },
  { id: 11, title: "Conquiste seu primeiro território", description: "Vença uma batalha contra um território neutro no mapa.", action: "territory_pve_won", selector: "#goMap", reward: { gems: 100, gold: 500 } },
  { id: 12, title: "Tutorial completo!", description: "Você aprendeu os fundamentos. Sua aventura começa agora!", action: "finish", selector: null, reward: { gems: 500 } }
];

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value || "{}"); } catch { return fallback; }
}

async function getKingdom(env, playerId) {
  return env.DB.prepare(
    "SELECT p.id AS player_id,k.id AS kingdom_id,k.kingdom_name FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?"
  ).bind(playerId).first();
}

async function getCurrentSeason(env, nowSeconds = Math.floor(Date.now() / 1000)) {
  return env.DB.prepare(
    "SELECT * FROM battle_pass_seasons WHERE status='active' AND start_time<=? AND end_time>? ORDER BY start_time DESC LIMIT 1"
  ).bind(nowSeconds, nowSeconds).first();
}

async function ensurePassProgress(env, kingdomId, seasonId) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO battle_pass_progress(kingdom_id,season_id) VALUES(?,?)"
  ).bind(kingdomId, seasonId).run();
  return env.DB.prepare(
    "SELECT * FROM battle_pass_progress WHERE kingdom_id=? AND season_id=?"
  ).bind(kingdomId, seasonId).first();
}

function localPeriodDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  let date = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
  if (Number(value.hour) < 5) date = new Date(date.getTime() - 86400000);
  return date;
}

function periodKey(rule, now = new Date()) {
  if (!rule) return "all";
  const date = localPeriodDate(now);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  if (rule === "daily_05:00") return year + "-" + month + "-" + day;
  if (rule === "weekly_monday") {
    const thursday = new Date(date);
    const weekday = (thursday.getUTCDay() + 6) % 7;
    thursday.setUTCDate(thursday.getUTCDate() - weekday + 3);
    const isoYear = thursday.getUTCFullYear();
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const jan4weekday = (jan4.getUTCDay() + 6) % 7;
    jan4.setUTCDate(jan4.getUTCDate() - jan4weekday + 3);
    const week = 1 + Math.round((thursday.getTime() - jan4.getTime()) / 604800000);
    return isoYear + "-W" + String(week).padStart(2, "0");
  }
  return "all";
}

async function getTutorialState(env, kingdomId) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO tutorial_progress(kingdom_id,current_step,completed) VALUES(?,1,0)"
  ).bind(kingdomId).run();
  const progress = await env.DB.prepare(
    "SELECT current_step,completed,started_at,completed_at FROM tutorial_progress WHERE kingdom_id=?"
  ).bind(kingdomId).first();
  return {
    current_step: Number(progress?.current_step || 1),
    completed: Number(progress?.completed || 0) === 1,
    started_at: progress?.started_at || null,
    completed_at: progress?.completed_at || null,
    steps: TUTORIAL_STEPS
  };
}

async function tutorialPrerequisite(env, kingdomId, stepId) {
  if ([1, 2, 3, 6, 7].includes(stepId)) return true;
  if (stepId === 4) {
    return Boolean(await env.DB.prepare(
      "SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='building_upgraded' AND json_extract(payload_json,'$.building')='farm' LIMIT 1"
    ).bind(kingdomId).first());
  }
  if (stepId === 5) {
    return Boolean(await env.DB.prepare(
      "SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='troops_trained' AND json_extract(payload_json,'$.unit')='militia' AND CAST(json_extract(payload_json,'$.quantity') AS INTEGER)>=50 LIMIT 1"
    ).bind(kingdomId).first());
  }
  if (stepId === 8) {
    return Boolean(await env.DB.prepare(
      "SELECT 1 FROM heroes WHERE kingdom_id=? LIMIT 1"
    ).bind(kingdomId).first());
  }
  if (stepId === 9) {
    return Boolean(await env.DB.prepare(
      "SELECT 1 FROM hero_equipment he JOIN heroes h ON h.id=he.hero_id WHERE h.kingdom_id=? LIMIT 1"
    ).bind(kingdomId).first());
  }
  if (stepId === 10) {
    return Boolean(await env.DB.prepare(
      "SELECT 1 FROM alliance_members WHERE kingdom_id=? LIMIT 1"
    ).bind(kingdomId).first());
  }
  if (stepId === 11) {
    return Boolean(await env.DB.prepare(
      "SELECT 1 FROM battle_reports WHERE attacker_kingdom_id=? AND winner_kingdom_id=? AND battle_type='territory_pve' LIMIT 1"
    ).bind(kingdomId, kingdomId).first());
  }
  return stepId === 12;
}

export async function handleTutorialRequest(request, env, playerId) {
  const kingdom = await getKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/game/tutorial") {
    return json(await getTutorialState(env, kingdom.kingdom_id));
  }
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Solicitação inválida." }, 400);

  if (url.pathname === "/api/game/tutorial/skip") {
    await env.DB.prepare(
      "UPDATE tutorial_progress SET current_step=13,completed=1,completed_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND completed=0"
    ).bind(kingdom.kingdom_id).run();
    return json({ success: true, skipped: true, rewards: false });
  }
  if (url.pathname !== "/api/game/tutorial/advance") return json({ error: "Rota de tutorial inválida." }, 404);

  const stepId = Number(body.step_id);
  if (!Number.isSafeInteger(stepId) || stepId < 1 || stepId > TUTORIAL_STEPS.length) {
    return json({ error: "Passo inválido." }, 400);
  }
  await getTutorialState(env, kingdom.kingdom_id);
  const progress = await env.DB.prepare(
    "SELECT current_step,completed FROM tutorial_progress WHERE kingdom_id=?"
  ).bind(kingdom.kingdom_id).first();
  if (!progress) return json({ error: "Progresso do tutorial não encontrado." }, 404);
  if (Number(progress.completed) === 1) return json({ success: true, completed: true, already_completed: true });
  if (Number(progress.current_step) !== stepId) return json({ error: "Conclua os passos na ordem apresentada." }, 409);
  if (!await tutorialPrerequisite(env, kingdom.kingdom_id, stepId)) {
    return json({ error: "A ação deste passo ainda não foi concluída no jogo." }, 409);
  }

  const step = TUTORIAL_STEPS[stepId - 1];
  const reward = step.reward || {};
  const nextStep = stepId + 1;
  const completed = nextStep > TUTORIAL_STEPS.length;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO kingdom_cosmetic_wallet(kingdom_id,shards) VALUES(?,150)"
  ).bind(kingdom.kingdom_id).run();
  const statements = [
    env.DB.prepare(
      "INSERT OR IGNORE INTO tutorial_step_claims(kingdom_id,step_id,reward_json) VALUES(?,?,?)"
    ).bind(kingdom.kingdom_id, stepId, JSON.stringify(reward)),
    env.DB.prepare(
      "UPDATE players SET gems=gems+? WHERE id=? AND changes()>0"
    ).bind(Number(reward.gems || 0), kingdom.player_id),
    env.DB.prepare(
      "UPDATE kingdoms SET gold=gold+?,wood=wood+?,food=food+?,stone=stone+?,iron=iron+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0"
    ).bind(Number(reward.gold || 0), Number(reward.wood || 0), Number(reward.food || 0), Number(reward.stone || 0), Number(reward.iron || 0), kingdom.kingdom_id),
    env.DB.prepare(
      "UPDATE kingdom_cosmetic_wallet SET shards=shards+? WHERE kingdom_id=? AND changes()>0"
    ).bind(Number(reward.shards || 0), kingdom.kingdom_id),
    env.DB.prepare(
      "UPDATE tutorial_progress SET current_step=?,completed=?,completed_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE kingdom_id=? AND current_step=? AND completed=0 AND changes()>0"
    ).bind(completed ? 13 : nextStep, completed ? 1 : 0, completed ? 1 : 0, kingdom.kingdom_id, stepId)
  ];
  const result = await env.DB.batch(statements);
  if (!result[0]?.meta?.changes) return json({ error: "Este passo já foi resgatado." }, 409);
  return json({ success: true, step: stepId, next_step: completed ? null : nextStep, completed, reward });
}

async function getBattlePassStatus(env, kingdomId, season) {
  const progress = await ensurePassProgress(env, kingdomId, season.id);
  const [rewardRows, claimedRows] = await Promise.all([
    env.DB.prepare("SELECT level,track,reward_json FROM battle_pass_rewards WHERE season_id=? ORDER BY level,track").bind(season.id).all(),
    env.DB.prepare("SELECT level,track FROM battle_pass_claimed WHERE kingdom_id=? AND season_id=?").bind(kingdomId, season.id).all()
  ]);
  const claimed = new Set((claimedRows.results || []).map(row => String(row.level) + ":" + row.track));
  const rewards = {};
  for (const row of rewardRows.results || []) {
    const level = String(row.level);
    rewards[level] ||= {};
    rewards[level][row.track] = {
      reward: parseJson(row.reward_json),
      claimed: claimed.has(String(row.level) + ":" + row.track)
    };
  }
  return {
    season: {
      id: season.id, name: season.name, theme: season.theme,
      start_time: season.start_time, end_time: season.end_time,
      max_level: season.max_level, xp_per_level: season.xp_per_level,
      premium_price_brl: season.premium_price_brl
    },
    progress: {
      level: Number(progress.current_level),
      current_xp: Number(progress.current_xp),
      total_xp: Number(progress.total_xp),
      has_premium: Number(progress.has_premium) === 1,
      xp_to_next: Number(progress.current_level) >= Number(season.max_level) ? 0 : Math.max(0, Number(season.xp_per_level) - Number(progress.current_xp))
    },
    rewards
  };
}

async function getBattlePassMissions(env, kingdomId, season) {
  const rows = await env.DB.prepare(
    "SELECT * FROM battle_pass_missions WHERE season_id=? AND active=1 ORDER BY CASE type WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 ELSE 3 END,id"
  ).bind(season.id).all();
  const missions = [];
  for (const mission of rows.results || []) {
    const key = periodKey(mission.reset_rule);
    const progress = await env.DB.prepare(
      "SELECT progress,completed,xp_awarded FROM battle_pass_mission_progress WHERE kingdom_id=? AND mission_id=? AND period_key=?"
    ).bind(kingdomId, mission.id, key).first();
    missions.push({
      ...mission, period_key: key,
      progress: Number(progress?.progress || 0),
      completed: Number(progress?.completed || 0) === 1,
      claimed: Number(progress?.xp_awarded || 0) === 1
    });
  }
  return {
    dailies: missions.filter(mission => mission.type === "daily"),
    weeklies: missions.filter(mission => mission.type === "weekly"),
    seasonals: missions.filter(mission => mission.type === "seasonal")
  };
}

async function claimBattlePassReward(env, kingdom, season, body) {
  const level = Number(body.level);
  const track = String(body.track || "");
  if (!Number.isSafeInteger(level) || level < 1 || level > Number(season.max_level) || !["free", "premium"].includes(track)) {
    return json({ error: "Nível ou trilha inválidos." }, 400);
  }
  const progress = await ensurePassProgress(env, kingdom.kingdom_id, season.id);
  if (level > Number(progress.current_level)) return json({ error: "Este nível ainda não foi alcançado." }, 400);
  if (track === "premium" && Number(progress.has_premium) !== 1) return json({ error: "O Passe Premium ainda não foi aprovado." }, 403);
  const row = await env.DB.prepare(
    "SELECT reward_json FROM battle_pass_rewards WHERE season_id=? AND level=? AND track=?"
  ).bind(season.id, level, track).first();
  if (!row) return json({ error: "Recompensa não encontrada." }, 404);
  const reward = parseJson(row.reward_json);
  await env.DB.prepare("INSERT OR IGNORE INTO kingdom_cosmetic_wallet(kingdom_id,shards) VALUES(?,150)")
    .bind(kingdom.kingdom_id).run();
  const statements = [
    env.DB.prepare(
      "INSERT OR IGNORE INTO battle_pass_claimed(kingdom_id,season_id,level,track,reward_json) VALUES(?,?,?,?,?)"
    ).bind(kingdom.kingdom_id, season.id, level, track, row.reward_json),
    env.DB.prepare(
      "UPDATE players SET gems=gems+? WHERE id=? AND changes()>0"
    ).bind(Number(reward.gems || 0), kingdom.player_id),
    env.DB.prepare(
      "UPDATE kingdoms SET gold=gold+?,food=food+?,wood=wood+?,stone=stone+?,iron=iron+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0"
    ).bind(Number(reward.gold || 0), Number(reward.food || 0), Number(reward.wood || 0), Number(reward.stone || 0), Number(reward.iron || 0), kingdom.kingdom_id),
    env.DB.prepare(
      "UPDATE kingdom_cosmetic_wallet SET shards=shards+? WHERE kingdom_id=? AND changes()>0"
    ).bind(Number(reward.shards || 0), kingdom.kingdom_id)
  ];
  if (reward.item) {
    statements.push(env.DB.prepare(
      "INSERT INTO inventory_items(kingdom_id,item_key,quantity) SELECT ?,?,1 WHERE changes()>0 ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+excluded.quantity"
    ).bind(kingdom.kingdom_id, String(reward.item)));
  }
  if (reward.skin_id) {
    statements.push(env.DB.prepare(
      "INSERT OR IGNORE INTO kingdom_cosmetics(kingdom_id,item_id,kind) SELECT ?,?,'battle_pass' WHERE changes()>0"
    ).bind(kingdom.kingdom_id, String(reward.skin_id)));
  }
  const result = await env.DB.batch(statements);
  if (!result[0]?.meta?.changes) return json({ error: "Esta recompensa já foi resgatada." }, 409);
  return json({ success: true, level, track, reward });
}

async function requestBattlePassPremium(env, kingdom, season, body) {
  const progress = await ensurePassProgress(env, kingdom.kingdom_id, season.id);
  if (Number(progress.has_premium) === 1) return json({ error: "O Passe Premium já está ativo." }, 409);
  const existing = await env.DB.prepare(
    "SELECT id,status,product_name,payment_method FROM purchase_requests WHERE player_id=? AND product_kind='battle_pass' AND product_ref=? AND status='pending' ORDER BY id DESC LIMIT 1"
  ).bind(kingdom.player_id, season.id).first();
  if (existing) return json({
    success: true, reused: true, request: existing,
    payment_url: "https://link.mercadopago.com.br/pagamentosskin",
    message: "Já existe um pedido pendente. A liberação ocorre após a conferência do pagamento no painel Master."
  });
  const requestKey = crypto.randomUUID().replace(/-/g, "");
  const paymentReference = String(body.paymentReference || "").trim().slice(0, 120) || null;
  const insert = await env.DB.prepare(
    "INSERT INTO purchase_requests(player_id,kingdom_id,product_kind,product_id,product_ref,product_name,price_brl,currency,gems_amount,payment_method,payment_reference,request_key) VALUES(?,?,'battle_pass',1,?,?,?,'BRL',0,'mercadopago_link',?,?)"
  ).bind(
    kingdom.player_id, kingdom.kingdom_id, season.id,
    "Passe Premium — " + season.name, season.premium_price_brl,
    paymentReference, requestKey
  ).run();
  const request = await env.DB.prepare(
    "SELECT id,status,product_name,price_brl,payment_method,payment_reference,created_at FROM purchase_requests WHERE id=?"
  ).bind(insert.meta.last_row_id).first();
  return json({
    success: true, request,
    payment_url: "https://link.mercadopago.com.br/pagamentosskin",
    message: "Pedido enviado ao painel Master. Conclua o pagamento e aguarde a conferência manual antes da liberação."
  }, 201);
}

export async function handleBattlePassRequest(request, env, playerId) {
  const kingdom = await getKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);
  const season = await getCurrentSeason(env);
  if (!season) return json({ error: "Nenhuma temporada ativa." }, 404);
  const url = new URL(request.url);
  const action = url.pathname.split("/").pop();
  if (request.method === "GET" && action === "status") return json(await getBattlePassStatus(env, kingdom.kingdom_id, season));
  if (request.method === "GET" && action === "missions") return json(await getBattlePassMissions(env, kingdom.kingdom_id, season));
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Solicitação inválida." }, 400);
  if (action === "claim") return claimBattlePassReward(env, kingdom, season, body);
  if (action === "buy") return requestBattlePassPremium(env, kingdom, season, body);
  return json({ error: "Rota do Passe de Batalha inválida." }, 404);
}

function eventMissionValues(event) {
  const payload = parseJson(event.payload_json);
  const result = [];
  switch (event.event_type) {
    case "building_upgraded":
      result.push({ type: "building_upgraded", value: 1 });
      if (payload.building === "castle") result.push({ type: "castle_upgrade", value: 1 });
      break;
    case "troops_trained":
      result.push({ type: "troops_trained", value: Math.max(0, Math.floor(Number(payload.quantity) || 0)) });
      break;
    case "alliance_help":
      result.push({ type: "alliance_help", value: 1 });
      break;
    case "territory_captured":
      if (payload.won !== false) result.push({ type: "battle_win", value: 1 });
      break;
    case "boss_attack":
      result.push({ type: "boss_attack", value: 1 });
      break;
    case "hero_summoned":
      result.push({ type: "hero_summon", value: Math.max(1, Math.floor(Number(payload.quantity) || 1)) });
      break;
    case "alliance_joined":
      result.push({ type: "alliance_join", value: 1 });
      break;
    case "alliance_war_points":
      result.push({ type: "war_points", value: Math.max(0, Math.floor(Number(payload.points) || 0)) });
      break;
    case "alliance_war_won":
      result.push({ type: "war_win", value: 1 });
      break;
    case "purchase_approved":
      result.push({ type: "purchase_approved", value: 1 });
      break;
    case "cosmetic_skin_purchased":
      result.push({ type: "cosmetic_skin_purchased", value: 1 });
      break;
    case "resource_gather":
      result.push({ type: "resource_gather", value: Math.max(0, Math.floor(Number(payload.amount) || 0)) });
      break;
    case "research_upgraded":
      result.push({ type: "research_upgraded", value: 1 });
      break;
  }
  return result.filter(item => item.value > 0);
}

async function awardMissionEvent(env, event, season, eventType, value) {
  const missions = await env.DB.prepare(
    "SELECT id,xp_reward,goal,reset_rule FROM battle_pass_missions WHERE season_id=? AND event_type=? AND active=1"
  ).bind(season.id, eventType).all();
  for (const mission of missions.results || []) {
    const key = periodKey(mission.reset_rule, new Date(event.created_at || Date.now()));
    await env.DB.prepare(
      "INSERT OR IGNORE INTO battle_pass_progress(kingdom_id,season_id) VALUES(?,?)"
    ).bind(event.kingdom_id, season.id).run();
    const statements = [
      env.DB.prepare(
        "INSERT OR IGNORE INTO battle_pass_mission_receipts(kingdom_id,mission_id,period_key,source_event_id,value) VALUES(?,?,?,?,?)"
      ).bind(event.kingdom_id, mission.id, key, String(event.id), value),
      env.DB.prepare(
        "INSERT INTO battle_pass_mission_progress(kingdom_id,mission_id,period_key,progress,completed,xp_awarded) SELECT ?,?,?,MIN(?,?),CASE WHEN ? >= ? THEN 1 ELSE 0 END,0 WHERE changes()>0 ON CONFLICT(kingdom_id,mission_id,period_key) DO UPDATE SET progress=MIN((SELECT goal FROM battle_pass_missions WHERE id=excluded.mission_id),battle_pass_mission_progress.progress+excluded.progress),completed=CASE WHEN MIN((SELECT goal FROM battle_pass_missions WHERE id=excluded.mission_id),battle_pass_mission_progress.progress+excluded.progress)>=(SELECT goal FROM battle_pass_missions WHERE id=excluded.mission_id) THEN 1 ELSE 0 END,last_updated=strftime('%s','now')"
      ).bind(event.kingdom_id, mission.id, key, value, mission.goal, value, mission.goal),
      env.DB.prepare(
        "UPDATE battle_pass_mission_progress SET xp_awarded=1,last_updated=strftime('%s','now') WHERE kingdom_id=? AND mission_id=? AND period_key=? AND completed=1 AND xp_awarded=0 AND changes()>0"
      ).bind(event.kingdom_id, mission.id, key),
      env.DB.prepare(
        "UPDATE battle_pass_progress SET total_xp=MIN(2900,total_xp+?),current_level=MIN(30,1+CAST(MIN(2900,total_xp+?)/100 AS INTEGER)),current_xp=CASE WHEN MIN(2900,total_xp+?)>=2900 THEN 0 ELSE MIN(2900,total_xp+?)%100 END WHERE kingdom_id=? AND season_id=? AND changes()>0"
      ).bind(Number(mission.xp_reward), Number(mission.xp_reward), Number(mission.xp_reward), Number(mission.xp_reward), event.kingdom_id, season.id)
    ];
    await env.DB.batch(statements);
  }
}

async function awardSeasonCompletionBonus(env, season) {
  const candidates = await env.DB.prepare(
    "SELECT p.kingdom_id,p.season_id FROM battle_pass_progress p WHERE p.season_id=? AND (SELECT COUNT(*) FROM battle_pass_missions m WHERE m.season_id=p.season_id AND m.type='seasonal' AND m.active=1)>0 AND (SELECT COUNT(*) FROM battle_pass_missions m JOIN battle_pass_mission_progress mp ON mp.mission_id=m.id AND mp.kingdom_id=p.kingdom_id AND mp.period_key='all' AND mp.completed=1 WHERE m.season_id=p.season_id AND m.type='seasonal' AND m.active=1)=(SELECT COUNT(*) FROM battle_pass_missions m WHERE m.season_id=p.season_id AND m.type='seasonal' AND m.active=1)"
  ).bind(season.id).all();
  for (const candidate of candidates.results || []) {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO battle_pass_completion_bonuses(kingdom_id,season_id,bonus_xp) VALUES(?,?,400)"
      ).bind(candidate.kingdom_id, candidate.season_id),
      env.DB.prepare(
        "UPDATE battle_pass_progress SET total_xp=MIN(2900,total_xp+400),current_level=MIN(30,1+CAST(MIN(2900,total_xp+400)/100 AS INTEGER)),current_xp=CASE WHEN MIN(2900,total_xp+400)>=2900 THEN 0 ELSE MIN(2900,total_xp+400)%100 END WHERE kingdom_id=? AND season_id=? AND changes()>0"
      ).bind(candidate.kingdom_id, candidate.season_id)
    ]);
  }
}

export async function processBattlePassEventQueue(env) {
  if (!env.DB) return;
  const season = await getCurrentSeason(env);
  const cursor = await env.DB.prepare("SELECT last_event_id FROM battle_pass_event_cursor WHERE id=1").first();
  const lastId = Number(cursor?.last_event_id || 0);
  const rows = await env.DB.prepare(
    "SELECT id,kingdom_id,event_type,payload_json,created_at FROM kingdom_events WHERE id>? AND event_type!='__internal_action_guard' ORDER BY id LIMIT 200"
  ).bind(lastId).all();
  let latest = lastId;
  for (const event of rows.results || []) {
    latest = Number(event.id);
    if (season && Number(event.kingdom_id) > 0 && Date.parse(event.created_at || "") >= Number(season.start_time) * 1000) {
      for (const mapped of eventMissionValues(event)) await awardMissionEvent(env, event, season, mapped.type, mapped.value);
    }
  }
  if (latest > lastId) {
    await env.DB.prepare("UPDATE battle_pass_event_cursor SET last_event_id=? WHERE id=1 AND last_event_id=?")
      .bind(latest, lastId).run();
  }
  if (season) await awardSeasonCompletionBonus(env, season);
}

export async function handleAllianceWarStatus(env, playerId) {
  const kingdom = await getKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);
  const member = await env.DB.prepare(
    "SELECT alliance_id FROM alliance_members WHERE kingdom_id=?"
  ).bind(kingdom.kingdom_id).first();
  if (!member) return json({ war: null });
  const war = await env.DB.prepare(
    "SELECT * FROM alliance_wars WHERE status='active' AND (alliance_a_id=? OR alliance_b_id=?) ORDER BY id DESC LIMIT 1"
  ).bind(member.alliance_id, member.alliance_id).first();
  if (!war) return json({ war: null });
  const [a, b, objectives, participants, participant] = await Promise.all([
    env.DB.prepare("SELECT id,name,tag FROM alliances WHERE id=?").bind(war.alliance_a_id).first(),
    env.DB.prepare("SELECT id,name,tag FROM alliances WHERE id=?").bind(war.alliance_b_id).first(),
    env.DB.prepare("SELECT o.*,a.name AS owner_name FROM alliance_war_objectives o LEFT JOIN alliances a ON a.id=o.owner_alliance_id WHERE o.war_id=? ORDER BY CASE o.objective_type WHEN 'fortress' THEN 1 WHEN 'outpost' THEN 2 ELSE 3 END,o.id").bind(war.id).all(),
    env.DB.prepare("SELECT wp.kingdom_id,wp.alliance_id,wp.side,wp.points,wp.kills,wp.losses,wp.captures,k.kingdom_name FROM alliance_war_participants wp JOIN kingdoms k ON k.id=wp.kingdom_id WHERE wp.war_id=? ORDER BY wp.points DESC LIMIT 50").bind(war.id).all(),
    env.DB.prepare("SELECT 1 FROM alliance_war_participants WHERE war_id=? AND kingdom_id=?").bind(war.id, kingdom.kingdom_id).first()
  ]);
  return json({
    war: {
      ...war,
      alliance_a: a,
      alliance_b: b,
      my_side: Number(member.alliance_id) === Number(war.alliance_a_id) ? "a" : "b",
      joined: Boolean(participant),
      objectives: objectives.results || [],
      top_players: participants.results || []
    }
  });
}

async function distributeAllianceWarRewards(env, war, winnerId, reason) {
  const participants = await env.DB.prepare(
    "SELECT wp.kingdom_id,wp.alliance_id,wp.points,k.player_id FROM alliance_war_participants wp JOIN kingdoms k ON k.id=wp.kingdom_id WHERE wp.war_id=? ORDER BY wp.points DESC"
  ).bind(war.id).all();
  const rows = participants.results || [];
  for (const p of rows) {
    const draw = !winnerId;
    const won = !draw && Number(p.alliance_id) === Number(winnerId);
    const type = draw ? "draw" : won ? "victory" : "defeat";
    const reward = draw ? { gems: 750, gold: 1500 } : won ? { gems: 2000, gold: 5000 } : { gems: 500, gold: 1000 };
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO alliance_war_reward_claims(war_id,kingdom_id,reward_type,reward_json) VALUES(?,?,?,?)"
      ).bind(war.id, p.kingdom_id, type, JSON.stringify(reward)),
      env.DB.prepare(
        "UPDATE players SET gems=gems+? WHERE id=? AND changes()>0"
      ).bind(reward.gems, p.player_id),
      env.DB.prepare(
        "UPDATE kingdoms SET gold=gold+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0"
      ).bind(reward.gold, p.kingdom_id),
      env.DB.prepare(
        "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0"
      ).bind(p.kingdom_id, won ? "alliance_war_won" : "alliance_war_result", JSON.stringify({ warId: war.id, winnerId, reason, reward }))
    ]);
  }
  if (rows.length) {
    const mvp = rows[0];
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO alliance_war_reward_claims(war_id,kingdom_id,reward_type,reward_json) VALUES(?,?,'mvp',?)"
      ).bind(war.id, mvp.kingdom_id, JSON.stringify({ gems: 5000 })),
      env.DB.prepare(
        "UPDATE players SET gems=gems+5000 WHERE id=? AND changes()>0"
      ).bind(mvp.player_id)
    ]);
  }
}

async function endAllianceWar(env, war, now) {
  const winnerId = Number(war.score_a) > Number(war.score_b)
    ? war.alliance_a_id
    : Number(war.score_b) > Number(war.score_a)
      ? war.alliance_b_id
      : null;
  const reason = Number(war.score_a) >= Number(war.goal_points) || Number(war.score_b) >= Number(war.goal_points)
    ? "goal_reached" : "time_expired";
  const updated = await env.DB.prepare(
    "UPDATE alliance_wars SET status='finished',phase='ended',winner_alliance_id=?,end_reason=? WHERE id=? AND status='active' AND phase<>'ended'"
  ).bind(winnerId, reason, war.id).run();
  if (!updated.meta?.changes) return;
  await distributeAllianceWarRewards(env, war, winnerId, reason);
  await env.DB.prepare("DELETE FROM alliance_war_slots WHERE war_id=?").bind(war.id).run();
}

export async function processAllianceWars(env, now = new Date()) {
  if (!env.DB) return;
  const iso = now.toISOString();
  await env.DB.prepare(
    "UPDATE alliance_wars SET phase='active' WHERE status='active' AND phase='preparing' AND starts_at<=?"
  ).bind(iso).run();
  const wars = await env.DB.prepare(
    "SELECT * FROM alliance_wars WHERE status='active' AND phase='active' ORDER BY id LIMIT 100"
  ).all();
  const tickAt = Math.floor(now.getTime() / 300000) * 300;
  for (const war of wars.results || []) {
    const objectives = await env.DB.prepare(
      "SELECT owner_alliance_id,points_per_tick FROM alliance_war_objectives WHERE war_id=? AND owner_alliance_id IS NOT NULL"
    ).bind(war.id).all();
    let addA = 0, addB = 0;
    for (const objective of objectives.results || []) {
      if (Number(objective.owner_alliance_id) === Number(war.alliance_a_id)) addA += Number(objective.points_per_tick || 0);
      if (Number(objective.owner_alliance_id) === Number(war.alliance_b_id)) addB += Number(objective.points_per_tick || 0);
    }
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO alliance_war_score_ticks(war_id,tick_at,score_a,score_b) VALUES(?,?,?,?)"
      ).bind(war.id, tickAt, addA, addB),
      env.DB.prepare(
        "UPDATE alliance_wars SET score_a=score_a+?,score_b=score_b+? WHERE id=? AND status='active' AND phase='active' AND changes()>0"
      ).bind(addA, addB, war.id),
      env.DB.prepare(
        "UPDATE alliance_war_objectives SET garrison_power=MIN(max_garrison_power,garrison_power+500) WHERE war_id=? AND garrison_power<max_garrison_power AND changes()>0"
      ).bind(war.id)
    ]);
  }
  const finished = await env.DB.prepare(
    "SELECT * FROM alliance_wars WHERE status='active' AND phase='active' AND (score_a>=goal_points OR score_b>=goal_points OR ends_at<=?)"
  ).bind(iso).all();
  for (const war of finished.results || []) await endAllianceWar(env, war, iso);

  // Reprocess reward settlements interrupted after the war status was committed.
  const pendingSettlements = await env.DB.prepare(
    "SELECT w.* FROM alliance_wars w WHERE w.status='finished' AND w.phase='ended' AND (EXISTS(SELECT 1 FROM alliance_war_participants p WHERE p.war_id=w.id AND NOT EXISTS(SELECT 1 FROM alliance_war_reward_claims r WHERE r.war_id=p.war_id AND r.kingdom_id=p.kingdom_id AND r.reward_type IN ('victory','defeat','draw'))) OR EXISTS(SELECT 1 FROM alliance_war_participants m WHERE m.war_id=w.id AND m.kingdom_id=(SELECT p2.kingdom_id FROM alliance_war_participants p2 WHERE p2.war_id=w.id ORDER BY p2.points DESC,p2.joined_at ASC,p2.kingdom_id ASC LIMIT 1) AND NOT EXISTS(SELECT 1 FROM alliance_war_reward_claims r WHERE r.war_id=w.id AND r.kingdom_id=m.kingdom_id AND r.reward_type='mvp')) LIMIT 50"
  ).all();
  for (const war of pendingSettlements.results || []) {
    await distributeAllianceWarRewards(env, war, war.winner_alliance_id, war.end_reason || "recovered_settlement");
    await env.DB.prepare("DELETE FROM alliance_war_slots WHERE war_id=?").bind(war.id).run();
  }
}


const WAR_UNIT_POWER = Object.freeze({
  militia: 2, swordsman: 5, spearman: 4, archer: 5, cavalry: 9,
  knight: 14, mage: 12, crossbowman: 7, catapult: 22, ram: 20, trebuchet: 30
});
const WAR_PREPARE_SECONDS = 24 * 60 * 60;
const WAR_DURATION_SECONDS = 48 * 60 * 60;
const WAR_DECLARATION_GOLD = 5000;
const WAR_GOAL_POINTS = 5000;

function validRequestId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function getWarMembership(env, kingdomId) {
  return env.DB.prepare(
    "SELECT am.alliance_id,am.rank,a.name,a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=?"
  ).bind(kingdomId).first();
}

async function getWarPower(env, allianceId) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(k.power),0) AS power FROM alliance_members am JOIN kingdoms k ON k.id=am.kingdom_id WHERE am.alliance_id=?"
  ).bind(allianceId).first();
  return Number(row?.power || 0);
}

function createWarObjectives() {
  return [
    { type: "fortress", name: "Fortaleza Central", x: 0, y: 0, garrison: 25000, points: 30, bonus: 100 },
    { type: "outpost", name: "Posto Norte", x: -60, y: -60, garrison: 10000, points: 10, bonus: 40 },
    { type: "outpost", name: "Posto Sul", x: 60, y: 60, garrison: 10000, points: 10, bonus: 40 },
    { type: "banner", name: "Estandarte Leste", x: 80, y: -30, garrison: 5000, points: 5, bonus: 20 },
    { type: "banner", name: "Estandarte Oeste", x: -80, y: 30, garrison: 5000, points: 5, bonus: 20 }
  ];
}

async function loadWarCombatProfile(env, kingdomId) {
  const [kingdom, hero, dragon, military, defense] = await Promise.all([
    env.DB.prepare("SELECT castle_level FROM kingdoms WHERE id=?").bind(kingdomId).first(),
    env.DB.prepare("SELECT level FROM heroes WHERE kingdom_id=? ORDER BY level DESC,id LIMIT 1").bind(kingdomId).first(),
    env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(kingdomId).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(kingdomId).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='defense'").bind(kingdomId).first()
  ]);
  if (!kingdom) return null;
  const castleLevel = Math.max(1, Math.min(30, Number(kingdom.castle_level || 1)));
  return {
    castleLevel,
    heroLevel: Math.max(1, Number(hero?.level || 1)),
    dragonLevel: Math.max(1, Number(dragon?.level || 1)),
    researchLevel: Math.max(0, Number(military?.level || 0)),
    defenseBonusPercent: Math.max(0, Math.min(30, Number(defense?.level || 0))),
    castlePowerBonusPercent: Math.max(0, Math.min(30, castleLevel))
  };
}

function warObjectiveGarrison(power) {
  const total = Math.max(1, Math.floor(Number(power) || 1));
  return [
    { unit_type: "militia", tier: 1, quantity: Math.ceil(total * 0.20 / WAR_UNIT_POWER.militia) },
    { unit_type: "archer", tier: 1, quantity: Math.ceil(total * 0.20 / WAR_UNIT_POWER.archer) },
    { unit_type: "knight", tier: 1, quantity: Math.ceil(total * 0.30 / WAR_UNIT_POWER.knight) },
    { unit_type: "trebuchet", tier: 1, quantity: Math.ceil(total * 0.30 / WAR_UNIT_POWER.trebuchet) }
  ];
}

function sumArmyPower(rows) {
  return (rows || []).reduce((sum, row) => {
    const power = WAR_UNIT_POWER[row.unit_type] || 0;
    return sum + power * Math.max(1, Number(row.tier) || 1) * Math.max(0, Number(row.quantity) || 0);
  }, 0);
}

function distributeUnitLosses(rows, losses) {
  const remaining = { ...(losses || {}) };
  const ordered = [...rows].sort((a, b) => String(a.unit_type).localeCompare(String(b.unit_type)) || Number(a.tier) - Number(b.tier));
  return ordered.map(row => {
    const key = row.unit_type;
    const loss = Math.min(Number(row.quantity), Math.max(0, Number(remaining[key] || 0)));
    remaining[key] = Math.max(0, Number(remaining[key] || 0) - loss);
    return {
      unit_type: row.unit_type,
      tier: Number(row.tier),
      quantity: Number(row.quantity),
      loss: loss
    };
  });
}

export async function handleAllianceWarAction(request, env, playerId) {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Solicitação inválida." }, 400);
  const kingdom = await getKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);
  const action = String(body.action || "");

  if (action === "declare") {
    const member = await getWarMembership(env, kingdom.kingdom_id);
    if (!member) return json({ error: "Você não pertence a uma aliança." }, 403);
    if (!["lider", "co_lider", "oficial"].includes(member.rank)) return json({ error: "Apenas líder, colíder ou oficial pode declarar guerra." }, 403);
    const targetTag = String(body.targetTag || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    const targetId = Number(body.targetAllianceId);
    const enemy = targetId > 0
      ? await env.DB.prepare("SELECT id,name,tag FROM alliances WHERE id=?").bind(targetId).first()
      : await env.DB.prepare("SELECT id,name,tag FROM alliances WHERE tag=?").bind(targetTag).first();
    if (!enemy) return json({ error: "Aliança adversária não encontrada." }, 404);
    if (Number(enemy.id) === Number(member.alliance_id)) return json({ error: "Não é possível declarar guerra contra sua própria aliança." }, 400);

    const [ownPower, enemyPower, activeWar, ownSlot, enemySlot] = await Promise.all([
      getWarPower(env, member.alliance_id),
      getWarPower(env, enemy.id),
      env.DB.prepare("SELECT id FROM alliance_wars WHERE status='active' AND phase IN ('preparing','active') AND (alliance_a_id IN (?,?) OR alliance_b_id IN (?,?)) LIMIT 1")
        .bind(member.alliance_id, enemy.id, member.alliance_id, enemy.id).first(),
      env.DB.prepare("SELECT war_id FROM alliance_war_slots WHERE alliance_id=?").bind(member.alliance_id).first(),
      env.DB.prepare("SELECT war_id FROM alliance_war_slots WHERE alliance_id=?").bind(enemy.id).first()
    ]);
    const ratio = enemyPower / Math.max(1, ownPower);
    if (ratio < 0.5 || ratio > 1.5) return json({ error: "Alvo fora da faixa de poder permitida (50% a 150%)." }, 400);
    if (activeWar || ownSlot || enemySlot) return json({ error: "Uma das alianças já está em preparação ou em guerra." }, 409);

    const now = Math.floor(Date.now() / 1000);
    const prepareUntil = now + WAR_PREPARE_SECONDS;
    const endTime = prepareUntil + WAR_DURATION_SECONDS;
    const prepareIso = new Date(prepareUntil * 1000).toISOString();
    const endIso = new Date(endTime * 1000).toISOString();

    const debit = await env.DB.prepare(
      "UPDATE alliances SET shared_gold=shared_gold-? WHERE id=? AND shared_gold>=?"
    ).bind(WAR_DECLARATION_GOLD, member.alliance_id, WAR_DECLARATION_GOLD).run();
    if (!debit.meta?.changes) return json({ error: "O tesouro da aliança precisa de 5.000 de ouro." }, 402);

    let warId = 0;
    try {
      const inserted = await env.DB.prepare(
        "INSERT INTO alliance_wars(alliance_a_id,alliance_b_id,starts_at,ends_at,status,score_a,score_b,phase,prepare_until,goal_points,declared_by_kingdom_id) VALUES(?,?,?,?,'active',0,0,'preparing',?,?,?)"
      ).bind(member.alliance_id, enemy.id, prepareIso, endIso, prepareIso, WAR_GOAL_POINTS, kingdom.kingdom_id).run();
      warId = Number(inserted.meta?.last_row_id || 0);
      if (!warId) throw new Error("Não foi possível identificar a guerra criada.");

      const objectiveRows = createWarObjectives();
      const statements = [
        env.DB.prepare("INSERT INTO alliance_war_slots(alliance_id,war_id) VALUES(?,?)").bind(member.alliance_id, warId),
        env.DB.prepare("INSERT INTO alliance_war_slots(alliance_id,war_id) VALUES(?,?)").bind(enemy.id, warId)
      ];
      for (const objective of objectiveRows) {
        statements.push(env.DB.prepare(
          "INSERT INTO alliance_war_objectives(war_id,objective_type,name,map_x,map_y,garrison_power,max_garrison_power,points_per_tick,capture_bonus) VALUES(?,?,?,?,?,?,?,?,?)"
        ).bind(warId, objective.type, objective.name, objective.x, objective.y, objective.garrison, objective.garrison, objective.points, objective.bonus));
      }
      await env.DB.batch(statements);
    } catch (error) {
      if (warId) {
        await env.DB.prepare("UPDATE alliance_wars SET status='finished',phase='ended',end_reason='setup_failed' WHERE id=? AND status='active'").bind(warId).run();
      }
      await env.DB.prepare("UPDATE alliances SET shared_gold=shared_gold+? WHERE id=?").bind(WAR_DECLARATION_GOLD, member.alliance_id).run();
      console.error("alliance_war_setup_failed", String(error?.message || error));
      return json({ error: "Não foi possível preparar a guerra. O ouro foi devolvido ao tesouro." }, 503);
    }

    return json({
      success: true,
      war_id: warId,
      status: "preparing",
      prepare_until: prepareUntil,
      start_time: prepareUntil,
      end_time: endTime,
      objectives: 5,
      gold_cost: WAR_DECLARATION_GOLD
    }, 201);
  }

  const member = await getWarMembership(env, kingdom.kingdom_id);
  if (!member) return json({ error: "Você não pertence a uma aliança." }, 403);
  const war = await env.DB.prepare(
    "SELECT * FROM alliance_wars WHERE status='active' AND phase IN ('preparing','active') AND (alliance_a_id=? OR alliance_b_id=?) ORDER BY id DESC LIMIT 1"
  ).bind(member.alliance_id, member.alliance_id).first();
  if (!war) return json({ error: "Sua aliança não possui uma guerra ativa." }, 404);
  const side = Number(war.alliance_a_id) === Number(member.alliance_id) ? "a" : "b";

  if (action === "join") {
    if (war.phase !== "preparing" || Date.parse(war.prepare_until || war.starts_at) <= Date.now()) {
      return json({ error: "O período de inscrição terminou." }, 409);
    }
    const result = await env.DB.prepare(
      "INSERT OR IGNORE INTO alliance_war_participants(war_id,kingdom_id,alliance_id,side) VALUES(?,?,?,?)"
    ).bind(war.id, kingdom.kingdom_id, member.alliance_id, side).run();
    return json({ success: true, joined: Boolean(result.meta?.changes), reused: !result.meta?.changes, war_id: war.id, side });
  }

  if (action !== "capture") return json({ error: "Ação de guerra inválida." }, 404);
  if (war.phase !== "active" || Date.parse(war.ends_at) <= Date.now()) return json({ error: "A guerra ainda não começou ou já terminou." }, 409);

  const requestId = String(body.request_id || "");
  if (!validRequestId(requestId)) return json({ error: "Identificador de batalha inválido. Atualize a tela e tente novamente." }, 400);
  const participant = await env.DB.prepare(
    "SELECT 1 FROM alliance_war_participants WHERE war_id=? AND kingdom_id=?"
  ).bind(war.id, kingdom.kingdom_id).first();
  if (!participant) return json({ error: "Inscreva-se durante a preparação antes de lutar." }, 403);

  const objectiveId = Number(body.objective_id);
  if (!Number.isSafeInteger(objectiveId) || objectiveId < 1) return json({ error: "Objetivo inválido." }, 400);
  const objective = await env.DB.prepare(
    "SELECT * FROM alliance_war_objectives WHERE id=? AND war_id=?"
  ).bind(objectiveId, war.id).first();
  if (!objective) return json({ error: "Objetivo não encontrado nesta guerra." }, 404);
  if (Number(objective.owner_alliance_id) === Number(member.alliance_id)) return json({ error: "Sua aliança já controla este objetivo." }, 409);

  const opposingAlliance = side === "a" ? Number(war.alliance_b_id) : Number(war.alliance_a_id);
  const defenderAllianceId = objective.owner_alliance_id == null ? opposingAlliance : Number(objective.owner_alliance_id);
  if (defenderAllianceId !== opposingAlliance) return json({ error: "O objetivo não está sob controle de uma aliança adversária." }, 409);
  const defender = await env.DB.prepare(
    "SELECT leader_kingdom_id FROM alliances WHERE id=?"
  ).bind(defenderAllianceId).first();
  if (!defender) return json({ error: "A guarnição adversária não está disponível." }, 409);

  const armyResult = await env.DB.prepare(
    "SELECT unit_type,tier,quantity FROM army_units WHERE kingdom_id=? AND quantity>0 ORDER BY unit_type,tier"
  ).bind(kingdom.kingdom_id).all();
  const army = armyResult.results || [];
  const totalTroops = army.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  if (!army.length || totalTroops < 1) return json({ error: "Seu exército está vazio." }, 409);
  if (totalTroops > 50000) return json({ error: "O limite por batalha é de 50.000 tropas. Ajuste seu exército." }, 400);

  const attackerPower = sumArmyPower(army);
  if (attackerPower < Number(objective.garrison_power) * 1.2) {
    return json({ error: "Poder insuficiente: este objetivo exige pelo menos 120% do poder de sua guarnição." }, 400);
  }

  const [attackerProfile, defenderProfile] = await Promise.all([
    loadWarCombatProfile(env, kingdom.kingdom_id),
    loadWarCombatProfile(env, Number(defender.leader_kingdom_id))
  ]);
  if (!attackerProfile || !defenderProfile) return json({ error: "Perfil de combate indisponível." }, 409);

  const defendingArmy = warObjectiveGarrison(objective.garrison_power);
  const criticalSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  const defenderCriticalSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  const roll = 0.85 + crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295 * 0.30;
  const simulation = simulateBattle({
    army,
    defendingArmy,
    ...attackerProfile,
    defenderCastlePowerBonusPercent: defenderProfile.castlePowerBonusPercent,
    defenderHeroLevel: defenderProfile.heroLevel,
    defenderDragonLevel: defenderProfile.dragonLevel,
    defenderResearchLevel: defenderProfile.researchLevel,
    defenderDefenseBonusPercent: defenderProfile.defenseBonusPercent,
    criticalSeed,
    defenderCriticalSeed,
    roll
  });

  const attackerLossRows = distributeUnitLosses(army, simulation.losses);
  const expectedRows = attackerLossRows.length;
  const lossesJson = JSON.stringify(attackerLossRows);
  const attackerLossCount = attackerLossRows.reduce((sum, row) => sum + row.loss, 0);
  const defenderLosses = simulation.defenderLosses || {};
  const destroyedPower = Object.entries(defenderLosses).reduce((sum, [unit, quantity]) => {
    return sum + Number(quantity || 0) * (WAR_UNIT_POWER[unit] || 0);
  }, 0);
  const killPoints = Math.min(200, Math.floor(destroyedPower / 1000));
  const defenseBonus = simulation.won ? 0 : 15;
  const captureBonus = simulation.won && !objective.last_capture_at ? Number(objective.capture_bonus || 0) : 0;
  const now = new Date().toISOString();
  const defenderLossCount = Object.values(defenderLosses).reduce((sum, value) => sum + Number(value || 0), 0);
  const attackerWon = Boolean(simulation.won);

  const armyUpdate = env.DB.prepare(
    "UPDATE army_units SET quantity=quantity-COALESCE((SELECT CAST(json_extract(j.value,'$.loss') AS INTEGER) FROM json_each(?) j WHERE json_extract(j.value,'$.unit_type')=army_units.unit_type AND CAST(json_extract(j.value,'$.tier') AS INTEGER)=army_units.tier),0) WHERE kingdom_id=? AND EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.unit_type')=army_units.unit_type AND CAST(json_extract(j.value,'$.tier') AS INTEGER)=army_units.tier) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE COALESCE((SELECT u.quantity FROM army_units u WHERE u.kingdom_id=? AND u.unit_type=json_extract(j.value,'$.unit_type') AND u.tier=CAST(json_extract(j.value,'$.tier') AS INTEGER)),-1)<CAST(json_extract(j.value,'$.quantity') AS INTEGER)) AND NOT EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=?)"
  ).bind(lossesJson, kingdom.kingdom_id, lossesJson, lossesJson, kingdom.kingdom_id, war.id, kingdom.kingdom_id, requestId);

  const battleInsert = env.DB.prepare(
    "INSERT INTO alliance_war_battles(war_id,attacker_kingdom_id,defender_kingdom_id,winner_kingdom_id,power_destroyed,points,objective_id,request_key) SELECT ?,?,?,?,?,?,?,? WHERE changes()=? ON CONFLICT(war_id,attacker_kingdom_id,request_key) DO NOTHING"
  ).bind(
    war.id, kingdom.kingdom_id, Number(defender.leader_kingdom_id), attackerWon ? kingdom.kingdom_id : Number(defender.leader_kingdom_id),
    Math.floor(destroyedPower), killPoints, objective.id, requestId, expectedRows
  );

  const objectiveCapture = env.DB.prepare(
    "UPDATE alliance_war_objectives SET owner_alliance_id=?,garrison_power=MAX(1,CAST(max_garrison_power/2 AS INTEGER)),last_capture_at=?,last_capture_request_key=? WHERE id=? AND war_id=? AND owner_alliance_id IS ? AND ?=1 AND EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=? AND winner_kingdom_id=?)"
  ).bind(member.alliance_id, now, requestId, objective.id, war.id, objective.owner_alliance_id, attackerWon ? 1 : 0,
    war.id, kingdom.kingdom_id, requestId, kingdom.kingdom_id);

  const objectiveDamage = env.DB.prepare(
    "UPDATE alliance_war_objectives SET garrison_power=MAX(1,garrison_power-?) WHERE id=? AND war_id=? AND owner_alliance_id IS ? AND ?=0 AND EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=? AND winner_kingdom_id=?)"
  ).bind(Math.floor(destroyedPower), objective.id, war.id, objective.owner_alliance_id, attackerWon ? 1 : 0,
    war.id, kingdom.kingdom_id, requestId, Number(defender.leader_kingdom_id));

  const captureExpr = "CASE WHEN EXISTS(SELECT 1 FROM alliance_war_objectives WHERE id=? AND last_capture_request_key=? AND owner_alliance_id=?) THEN ? ELSE 0 END";
  const warScore = env.DB.prepare(
    "UPDATE alliance_wars SET score_a=score_a+CASE WHEN ?='a' THEN ?+" + captureExpr + " ELSE 0 END+CASE WHEN ?='b' THEN ? ELSE 0 END,score_b=score_b+CASE WHEN ?='b' THEN ?+" + captureExpr + " ELSE 0 END+CASE WHEN ?='a' THEN ? ELSE 0 END WHERE id=? AND status='active' AND EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=?)"
  ).bind(
    side, killPoints, objective.id, requestId, member.alliance_id, captureBonus, side === "a" ? "b" : "a", defenseBonus,
    side, killPoints, objective.id, requestId, member.alliance_id, captureBonus, side === "a" ? "b" : "a", defenseBonus,
    war.id, war.id, kingdom.kingdom_id, requestId
  );

  const participantUpdate = env.DB.prepare(
    "UPDATE alliance_war_participants SET points=points+?+" + captureExpr + ",kills=kills+?,losses=losses+?,captures=captures+CASE WHEN EXISTS(SELECT 1 FROM alliance_war_objectives WHERE id=? AND last_capture_request_key=? AND owner_alliance_id=?) THEN 1 ELSE 0 END WHERE war_id=? AND kingdom_id=? AND EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=?)"
  ).bind(
    killPoints, objective.id, requestId, member.alliance_id, captureBonus, defenderLossCount, attackerLossCount,
    objective.id, requestId, member.alliance_id, war.id, kingdom.kingdom_id, war.id, kingdom.kingdom_id, requestId
  );

  const battlePointsEvent = env.DB.prepare(
    "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?, 'alliance_war_points', json_object('points',?+CASE WHEN EXISTS(SELECT 1 FROM alliance_war_objectives WHERE id=? AND last_capture_request_key=? AND owner_alliance_id=?) THEN ? ELSE 0 END,'warId',?,'requestId',?) WHERE EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=?)"
  ).bind(kingdom.kingdom_id, killPoints, objective.id, requestId, member.alliance_id, captureBonus, war.id, requestId, war.id, kingdom.kingdom_id, requestId);

  const defenseEvent = env.DB.prepare(
    "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?, 'alliance_war_points', json_object('points',15,'warId',?,'requestId',?) WHERE ?=15 AND EXISTS(SELECT 1 FROM alliance_war_battles WHERE war_id=? AND attacker_kingdom_id=? AND request_key=? AND winner_kingdom_id=?)"
  ).bind(Number(defender.leader_kingdom_id), war.id, requestId, defenseBonus, war.id, kingdom.kingdom_id, requestId, Number(defender.leader_kingdom_id));

  const battlePointsUpdate = env.DB.prepare(
    "UPDATE alliance_war_battles SET points=points+? WHERE war_id=? AND attacker_kingdom_id=? AND request_key=? AND EXISTS(SELECT 1 FROM alliance_war_objectives WHERE id=? AND last_capture_request_key=? AND owner_alliance_id=?)"
  ).bind(captureBonus, war.id, kingdom.kingdom_id, requestId, objective.id, requestId, member.alliance_id);

  const result = await env.DB.batch([
    armyUpdate,
    battleInsert,
    objectiveCapture,
    objectiveDamage,
    warScore,
    participantUpdate,
    battlePointsEvent,
    defenseEvent,
    battlePointsUpdate
  ]);
  if (!result[1]?.meta?.changes) return json({ error: "Seu exército mudou ou esta requisição já foi processada. Atualize o reino e tente novamente." }, 409);

  const [freshWar, freshObjective] = await Promise.all([
    env.DB.prepare("SELECT score_a,score_b,status,phase FROM alliance_wars WHERE id=?").bind(war.id).first(),
    env.DB.prepare("SELECT owner_alliance_id,garrison_power,last_capture_at FROM alliance_war_objectives WHERE id=?").bind(objective.id).first()
  ]);
  return json({
    success: true,
    won: attackerWon,
    captured: Number(freshObjective?.owner_alliance_id) === Number(member.alliance_id),
    kill_points: killPoints,
    capture_bonus: Number(freshObjective?.last_capture_request_key) === requestId ? captureBonus : 0,
    defense_bonus: defenseBonus,
    attacker_losses: attackerLossCount,
    defender_losses: defenderLossCount,
    scores: { a: Number(freshWar?.score_a || 0), b: Number(freshWar?.score_b || 0) },
    objective: freshObjective
  });
}
