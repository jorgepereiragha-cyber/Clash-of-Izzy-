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
      ).bind(war.id, mvp.kingdom_id, JSON.stringify({ gems: 5000, title: "mvp_of_war" })),
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
        "UPDATE alliance_war_objectives SET garrison_power=MIN(max_garrison_power,garrison_power+500) WHERE war_id=? AND garrison_power<max_garrison_power"
      ).bind(war.id)
    ]);
  }
  const finished = await env.DB.prepare(
    "SELECT * FROM alliance_wars WHERE status='active' AND phase='active' AND (score_a>=goal_points OR score_b>=goal_points OR ends_at<=?)"
  ).bind(iso).all();
  for (const war of finished.results || []) await endAllianceWar(env, war, iso);
}
