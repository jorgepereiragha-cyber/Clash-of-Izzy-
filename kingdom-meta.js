// Clash of Izzy v3 meta systems.
// All progression is bound to the authenticated kingdom, never to client-supplied owner IDs.
const reply = (data, status = 200) => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

const RESOURCE_KEYS = new Set(["food", "wood", "stone", "iron", "gold"]);
const SPEEDUP_TYPES = new Set(["construction", "training", "research", "march"]);
const SPEEDUP_DURATIONS = new Set([60, 300, 900, 3600, 14400, 86400]);
const TROOP_TYPES = new Set([
  "militia", "swordsman", "spearman", "archer", "crossbowman",
  "cavalry", "knight", "mage", "catapult", "ram", "trebuchet",
]);

function safeJson(raw, fallback = {}) {
  try {
    const value = JSON.parse(String(raw || "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function safeInteger(value, min, max) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function utcWeek(date = new Date()) {
  const year = date.getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - firstDay.getTime()) / 86400000);
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const week = Math.floor((dayOfYear + mondayOffset) / 7) + (firstDay.getUTCDay() === 1 ? 1 : 0);
  return year + "-W" + String(week).padStart(2, "0");
}

async function findKingdom(env, publicPlayerId) {
  return env.DB.prepare(
    "SELECT k.id,k.player_id,k.kingdom_name,k.castle_level,k.power " +
    "FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?"
  ).bind(publicPlayerId).first();
}

function parseReward(raw) {
  const reward = safeJson(raw, null);
  if (!reward) return null;
  const result = { gems: 0, resources: {}, speedups: [] };
  const gems = reward.gems === undefined ? 0 : safeInteger(reward.gems, 0, 100000000);
  if (gems === null) return null;
  result.gems = gems;

  if (reward.resources !== undefined) {
    if (!reward.resources || typeof reward.resources !== "object" || Array.isArray(reward.resources)) return null;
    for (const [key, value] of Object.entries(reward.resources)) {
      const amount = safeInteger(value, 0, 100000000);
      if (!RESOURCE_KEYS.has(key) || amount === null) return null;
      if (amount) result.resources[key] = amount;
    }
  }

  if (reward.speedups !== undefined) {
    if (!Array.isArray(reward.speedups) || reward.speedups.length > 6) return null;
    for (const item of reward.speedups) {
      const queueType = String(item?.queue_type || "");
      const duration = safeInteger(item?.duration_seconds, 1, 86400);
      const quantity = safeInteger(item?.quantity, 1, 100);
      if (!SPEEDUP_TYPES.has(queueType) || duration === null ||
          !SPEEDUP_DURATIONS.has(duration) || quantity === null) return null;
      result.speedups.push({ queue_type: queueType, duration_seconds: duration, quantity });
    }
  }
  return result;
}

// Each statement is chained to changes() from the preceding statement. The first
// statement in every claim batch is a compare-and-set claim, so duplicate requests
// cannot credit a second reward.
function rewardStatements(env, kingdom, reward) {
  const statements = [];
  if (reward.gems > 0) {
    statements.push(env.DB.prepare(
      "UPDATE players SET gems=gems+? WHERE id=? AND changes()>0"
    ).bind(reward.gems, kingdom.player_id));
    statements.push(env.DB.prepare(
      "INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) " +
      "SELECT ?,'gems',?,'recompensa de progressão v3' WHERE changes()>0"
    ).bind(kingdom.id, reward.gems));
  }
  for (const [resource, amount] of Object.entries(reward.resources)) {
    statements.push(env.DB.prepare(
      "UPDATE kingdoms SET " + resource + "=" + resource + "+?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=? AND changes()>0"
    ).bind(amount, kingdom.id));
    statements.push(env.DB.prepare(
      "INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) " +
      "SELECT ?,?,?,? WHERE changes()>0"
    ).bind(kingdom.id, resource, amount, "recompensa de progressão v3"));
  }
  for (const item of reward.speedups) {
    statements.push(env.DB.prepare(
      "INSERT INTO kingdom_speedups(kingdom_id,queue_type,duration_seconds,quantity) " +
      "SELECT ?,?,?,? WHERE changes()>0 " +
      "ON CONFLICT(kingdom_id,queue_type,duration_seconds) DO UPDATE SET " +
      "quantity=kingdom_speedups.quantity+excluded.quantity"
    ).bind(kingdom.id, item.queue_type, item.duration_seconds, item.quantity));
  }
  return statements;
}

async function getVisualSettings(env, kingdom) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO kingdom_visual_settings(kingdom_id) VALUES(?)"
  ).bind(kingdom.id).run();
  const settings = await env.DB.prepare(
    "SELECT particles_enabled,screen_shake_enabled,damage_numbers_enabled," +
    "day_night_cycle_enabled,quality_level,updated_at " +
    "FROM kingdom_visual_settings WHERE kingdom_id=?"
  ).bind(kingdom.id).first();
  return reply({ settings });
}

async function updateVisualSettings(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply({ error: "Configurações visuais inválidas." }, 400);
  }
  const current = await env.DB.prepare(
    "SELECT particles_enabled,screen_shake_enabled,damage_numbers_enabled," +
    "day_night_cycle_enabled,quality_level FROM kingdom_visual_settings WHERE kingdom_id=?"
  ).bind(kingdom.id).first();
  const settings = {
    particles_enabled: current?.particles_enabled ?? 1,
    screen_shake_enabled: current?.screen_shake_enabled ?? 1,
    damage_numbers_enabled: current?.damage_numbers_enabled ?? 1,
    day_night_cycle_enabled: current?.day_night_cycle_enabled ?? 1,
    quality_level: current?.quality_level ?? "balanced",
  };
  for (const key of ["particles_enabled","screen_shake_enabled","damage_numbers_enabled","day_night_cycle_enabled"]) {
    if (Object.hasOwn(body, key)) {
      if (![true,false,0,1].includes(body[key])) return reply({ error: "Valor visual inválido: " + key }, 400);
      settings[key] = body[key] === true || body[key] === 1 ? 1 : 0;
    }
  }
  if (Object.hasOwn(body, "quality_level")) {
    const quality = String(body.quality_level);
    if (!["low","balanced","high"].includes(quality)) {
      return reply({ error: "Qualidade deve ser low, balanced ou high." }, 400);
    }
    settings.quality_level = quality;
  }
  await env.DB.prepare(
    "INSERT INTO kingdom_visual_settings(" +
      "kingdom_id,particles_enabled,screen_shake_enabled,damage_numbers_enabled," +
      "day_night_cycle_enabled,quality_level,updated_at" +
    ") VALUES(?,?,?,?,?,?,unixepoch()) " +
    "ON CONFLICT(kingdom_id) DO UPDATE SET " +
      "particles_enabled=excluded.particles_enabled," +
      "screen_shake_enabled=excluded.screen_shake_enabled," +
      "damage_numbers_enabled=excluded.damage_numbers_enabled," +
      "day_night_cycle_enabled=excluded.day_night_cycle_enabled," +
      "quality_level=excluded.quality_level,updated_at=unixepoch()"
  ).bind(
    kingdom.id, settings.particles_enabled, settings.screen_shake_enabled,
    settings.damage_numbers_enabled, settings.day_night_cycle_enabled, settings.quality_level
  ).run();
  return reply({ success: true, settings });
}

async function getVipStatus(env, kingdom) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO kingdom_vip(kingdom_id) VALUES(?)"
  ).bind(kingdom.id).run();
  const row = await env.DB.prepare(
    "SELECT kv.vip_level,kv.vip_exp,kv.vip_expires,vb.build_speed_bonus," +
      "vb.train_speed_bonus,vb.research_speed_bonus,vb.resource_bonus," +
      "vb.march_speed_bonus,vb.daily_gift_json " +
    "FROM kingdom_vip kv LEFT JOIN vip_benefits vb ON vb.vip_level=kv.vip_level " +
    "WHERE kv.kingdom_id=?"
  ).bind(kingdom.id).first();
  return reply({
    vip_level: Number(row?.vip_level || 0),
    vip_exp: Number(row?.vip_exp || 0),
    vip_expires: row?.vip_expires ?? null,
    benefits: {
      build_speed: Number(row?.build_speed_bonus || 0),
      train_speed: Number(row?.train_speed_bonus || 0),
      research_speed: Number(row?.research_speed_bonus || 0),
      resource: Number(row?.resource_bonus || 0),
      march_speed: Number(row?.march_speed_bonus || 0),
      daily_gift: safeJson(row?.daily_gift_json),
    },
    upgrade_available: false,
    message: "O nível VIP é controlado pelo servidor. Nenhum custo enviado pelo cliente é aceito.",
  });
}

async function getSpeedups(env, kingdom) {
  const rows = await env.DB.prepare(
    "SELECT queue_type,duration_seconds,quantity FROM kingdom_speedups " +
    "WHERE kingdom_id=? AND quantity>0 ORDER BY queue_type,duration_seconds"
  ).bind(kingdom.id).all();
  return reply({ speedups: rows.results || [] });
}

async function useSpeedup(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return reply({ error: "Solicitação de acelerador inválida." }, 400);
  const queueType = String(body.queue_type || "");
  const duration = safeInteger(body.duration_seconds, 1, 86400);
  const queueId = safeInteger(body.target_queue_id, 1, Number.MAX_SAFE_INTEGER);
  if (!SPEEDUP_TYPES.has(queueType) || duration === null || !SPEEDUP_DURATIONS.has(duration) || queueId === null) {
    return reply({ error: "Informe uma fila e um acelerador válidos." }, 400);
  }

  const now = Date.now();
  const isMarch = queueType === "march";
  const queueTable = isMarch ? "marches" : "kingdom_queues";
  const deadlineColumn = isMarch ? "arrives_at" : "completes_at";
  const queue = await env.DB.prepare(
    "SELECT id,started_at," + deadlineColumn + " AS completes_at FROM " + queueTable + " " +
    "WHERE id=? AND kingdom_id=? AND " + (isMarch ? "status='marching'" : "queue_type=? AND status='running'") +
    " AND " + deadlineColumn + ">?"
  ).bind(...(isMarch ? [queueId, kingdom.id, new Date(now).toISOString()] :
    [queueId, kingdom.id, queueType, new Date(now).toISOString()])).first();
  if (!queue) return reply({ error: isMarch ? "Marcha em andamento não encontrada." : "Fila ativa não encontrada ou já concluída." }, 404);

  const previousEnd = Date.parse(queue.completes_at);
  const started = Date.parse(queue.started_at);
  if (!Number.isFinite(previousEnd) || !Number.isFinite(started) || previousEnd <= now) {
    return reply({ error: "Horário da fila inválido." }, 409);
  }
  const nextEnd = new Date(Math.max(now + 1000, previousEnd - duration * 1000)).toISOString();
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE " + queueTable + " SET " + deadlineColumn + "=? " +
      "WHERE id=? AND kingdom_id=? AND " + (isMarch ? "status='marching'" : "queue_type=? AND status='running'") +
      " AND started_at=? AND " + deadlineColumn + "=? " +
      "AND EXISTS(SELECT 1 FROM kingdom_speedups WHERE kingdom_id=? AND queue_type=? " +
        "AND duration_seconds=? AND quantity>0)"
    ).bind(...(isMarch ?
      [nextEnd, queueId, kingdom.id, queue.started_at, queue.completes_at, kingdom.id, queueType, duration] :
      [nextEnd, queueId, kingdom.id, queueType, queue.started_at, queue.completes_at, kingdom.id, queueType, duration])),
    env.DB.prepare(
      "UPDATE kingdom_speedups SET quantity=quantity-1 " +
      "WHERE kingdom_id=? AND queue_type=? AND duration_seconds=? AND quantity>0 AND changes()=1"
    ).bind(kingdom.id, queueType, duration),
    env.DB.prepare(
      "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) " +
      "SELECT ?,'speedup_used',? WHERE changes()=1"
    ).bind(kingdom.id, JSON.stringify({ queue_id: queueId, queue_type: queueType, duration_seconds: duration })),
  ]);
  if (Number(result[0]?.meta?.changes || 0) !== 1 || Number(result[1]?.meta?.changes || 0) !== 1) {
    return reply({ error: "Acelerador indisponível ou fila alterada. Atualize e tente novamente." }, 409);
  }
  return reply({
    success: true,
    completes_at: nextEnd,
    seconds_reduced: Math.floor((previousEnd - Date.parse(nextEnd)) / 1000),
    target_type: isMarch ? "march" : "queue",
  });
}

async function getTasks(env, kingdom) {
  const period = utcDay();
  const rows = await env.DB.prepare(
    "SELECT dt.id,dt.title,dt.description,dt.period_type,dt.target_count,dt.reward_json," +
      "CASE dt.period_type WHEN 'weekly' THEN ? ELSE ? END AS period_key," +
      "COALESCE(pt.progress,0) AS progress,COALESCE(pt.completed,0) AS completed," +
      "COALESCE(pt.claimed,0) AS claimed " +
    "FROM daily_tasks dt LEFT JOIN kingdom_task_progress pt " +
      "ON pt.task_id=dt.id AND pt.kingdom_id=? AND pt.period_key=CASE dt.period_type WHEN 'weekly' THEN ? ELSE ? END " +
    "WHERE dt.active=1 ORDER BY dt.period_type,dt.id"
  ).bind(utcWeek(), period, kingdom.id, utcWeek(), period).all();
  return reply({ periods: { daily: period, weekly: utcWeek() }, tasks: (rows.results || []).map(row => ({
    ...row,
    target_count: Number(row.target_count),
    progress: Number(row.progress),
    completed: Number(row.completed),
    claimed: Number(row.claimed),
    reward: parseReward(row.reward_json),
  })) });
}

async function claimTask(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  const taskId = String(body?.task_id || "").trim();
  if (!/^[a-z0-9_-]{2,64}$/.test(taskId)) return reply({ error: "Tarefa inválida." }, 400);
  const task = await env.DB.prepare(
    "SELECT dt.reward_json,dt.target_count,dt.period_type FROM daily_tasks dt WHERE dt.id=? AND dt.active=1"
  ).bind(taskId).first();
  if (!task) return reply({ error: "Tarefa não encontrada." }, 404);
  const periodKey = task.period_type === "weekly" ? utcWeek() : utcDay();
  const reward = parseReward(task.reward_json);
  if (!reward) return reply({ error: "Recompensa de tarefa mal configurada." }, 503);
  const statements = [
    env.DB.prepare(
      "UPDATE kingdom_task_progress SET claimed=1,updated_at=unixepoch() " +
      "WHERE kingdom_id=? AND task_id=? AND period_key=? AND completed=1 AND claimed=0 " +
      "AND progress>=?"
    ).bind(kingdom.id, taskId, periodKey, task.target_count),
    ...rewardStatements(env, kingdom, reward),
  ];
  const result = await env.DB.batch(statements);
  if (!Number(result[0]?.meta?.changes || 0)) {
    return reply({ error: "Tarefa ainda não foi concluída ou a recompensa já foi resgatada." }, 409);
  }
  return reply({ success: true, reward });
}

async function getMail(env, kingdom) {
  const rows = await env.DB.prepare(
    "SELECT id,sender_name,subject,body,attachment_json,is_read,is_claimed,created_at,expires_at " +
    "FROM kingdom_mail WHERE kingdom_id=? AND (expires_at IS NULL OR expires_at>unixepoch()) " +
    "ORDER BY created_at DESC,id DESC LIMIT 50"
  ).bind(kingdom.id).all();
  return reply({ mail: (rows.results || []).map(row => ({
    ...row,
    attachment: row.attachment_json ? parseReward(row.attachment_json) : null,
    attachment_json: undefined,
  })) });
}

async function markMailRead(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  const mailId = safeInteger(body?.mail_id, 1, Number.MAX_SAFE_INTEGER);
  if (mailId === null) return reply({ error: "Mensagem inválida." }, 400);
  const result = await env.DB.prepare(
    "UPDATE kingdom_mail SET is_read=1 WHERE id=? AND kingdom_id=? " +
    "AND (expires_at IS NULL OR expires_at>unixepoch())"
  ).bind(mailId, kingdom.id).run();
  if (!Number(result.meta?.changes || 0)) return reply({ error: "Mensagem não encontrada." }, 404);
  return reply({ success: true });
}

async function claimMail(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  const mailId = safeInteger(body?.mail_id, 1, Number.MAX_SAFE_INTEGER);
  if (mailId === null) return reply({ error: "Mensagem inválida." }, 400);
  const mail = await env.DB.prepare(
    "SELECT attachment_json FROM kingdom_mail WHERE id=? AND kingdom_id=? " +
    "AND is_claimed=0 AND attachment_json IS NOT NULL " +
    "AND (expires_at IS NULL OR expires_at>unixepoch())"
  ).bind(mailId, kingdom.id).first();
  if (!mail) return reply({ error: "Anexo não disponível ou já resgatado." }, 409);
  const reward = parseReward(mail.attachment_json);
  if (!reward) return reply({ error: "Anexo possui uma recompensa inválida." }, 503);
  const statements = [
    env.DB.prepare(
      "UPDATE kingdom_mail SET is_claimed=1,is_read=1 WHERE id=? AND kingdom_id=? " +
      "AND is_claimed=0 AND attachment_json IS NOT NULL " +
      "AND (expires_at IS NULL OR expires_at>unixepoch())"
    ).bind(mailId, kingdom.id),
    ...rewardStatements(env, kingdom, reward),
  ];
  const result = await env.DB.batch(statements);
  if (!Number(result[0]?.meta?.changes || 0)) return reply({ error: "Anexo já foi resgatado." }, 409);
  return reply({ success: true, reward });
}

async function getAchievements(env, kingdom) {
  const rows = await env.DB.prepare(
    "SELECT a.id,a.title,a.description,a.category,a.tier,a.requirement_value,a.reward_json," +
      "COALESCE(p.progress,0) AS progress,COALESCE(p.completed,0) AS completed," +
      "COALESCE(p.claimed,0) AS claimed,p.completed_at " +
    "FROM achievement_catalog a LEFT JOIN kingdom_achievement_progress p " +
      "ON p.achievement_id=a.id AND p.kingdom_id=? " +
    "WHERE a.active=1 ORDER BY a.category,a.tier,a.requirement_value"
  ).bind(kingdom.id).all();
  return reply({ achievements: (rows.results || []).map(row => ({
    ...row,
    requirement_value: Number(row.requirement_value),
    progress: Number(row.progress),
    completed: Number(row.completed),
    claimed: Number(row.claimed),
    reward: parseReward(row.reward_json),
  })) });
}

async function claimAchievement(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  const achievementId = String(body?.achievement_id || "").trim();
  if (!/^[a-z0-9_-]{2,64}$/.test(achievementId)) return reply({ error: "Conquista inválida." }, 400);
  const achievement = await env.DB.prepare(
    "SELECT a.reward_json,a.requirement_value FROM achievement_catalog a " +
    "WHERE a.id=? AND a.active=1"
  ).bind(achievementId).first();
  if (!achievement) return reply({ error: "Conquista não encontrada." }, 404);
  const reward = parseReward(achievement.reward_json);
  if (!reward) return reply({ error: "Recompensa de conquista mal configurada." }, 503);
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE kingdom_achievement_progress SET claimed=1,updated_at=unixepoch() " +
      "WHERE kingdom_id=? AND achievement_id=? AND completed=1 AND claimed=0 AND progress>=?"
    ).bind(kingdom.id, achievementId, achievement.requirement_value),
    ...rewardStatements(env, kingdom, reward),
  ]);
  if (!Number(result[0]?.meta?.changes || 0)) {
    return reply({ error: "Conquista não concluída ou recompensa já resgatada." }, 409);
  }
  return reply({ success: true, reward });
}

async function getRanking(env) {
  const rows = await env.DB.prepare(
    "SELECT k.id AS kingdom_id,k.kingdom_name,k.castle_level,k.power," +
      "COALESCE(n.nickname,NULLIF(p.name,'Jogador'),k.kingdom_name) AS commander," +
      "RANK() OVER(ORDER BY k.power DESC,k.id ASC) AS power_rank," +
      "RANK() OVER(ORDER BY k.castle_level DESC,k.power DESC,k.id ASC) AS castle_rank," +
      "(SELECT COUNT(*) FROM battle_reports br WHERE br.winner_kingdom_id=k.id) AS battles_won," +
      "(SELECT COALESCE(SUM(rl.amount),0) FROM resource_ledger rl " +
        "WHERE rl.kingdom_id=k.id AND rl.amount>0 AND rl.resource IN ('food','wood','stone','iron') AND rl.reason LIKE 'coleta de nó de recurso:%') AS resources_collected " +
    "FROM kingdoms k JOIN players p ON p.id=k.player_id " +
    "LEFT JOIN player_nicknames n ON n.player_id=p.id " +
    "ORDER BY k.power DESC,k.id ASC LIMIT 100"
  ).all();
  return reply({ ranking: (rows.results || []).map(row => ({
    ...row,
    castle_level: Number(row.castle_level || 1),
    power: Number(row.power || 0),
    power_rank: Number(row.power_rank || 0),
    castle_rank: Number(row.castle_rank || 0),
    battles_won: Number(row.battles_won || 0),
    resources_collected: Number(row.resources_collected || 0),
  })) });
}

async function getFormations(env, kingdom) {
  const rows = await env.DB.prepare(
    "SELECT slot_number,formation_name,troop_data,hero_id,is_active,updated_at " +
    "FROM troop_formations WHERE kingdom_id=? ORDER BY slot_number"
  ).bind(kingdom.id).all();
  return reply({ formations: (rows.results || []).map(row => ({
    ...row,
    troop_data: safeJson(row.troop_data),
    is_active: Number(row.is_active) === 1,
  })) });
}

async function saveFormation(request, env, kingdom) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Formação inválida." }, 400);
  const slot = safeInteger(body.slot_number, 1, 5);
  const name = String(body.formation_name || "Formação " + slot).trim().slice(0, 32);
  const heroId = body.hero_id == null || body.hero_id === "" ? null : safeInteger(body.hero_id, 1, Number.MAX_SAFE_INTEGER);
  const troops = body.troop_data;
  if (slot === null || !name || !troops || typeof troops !== "object" || Array.isArray(troops)) {
    return reply({ error: "Informe slot, nome e tropas válidos." }, 400);
  }
  if (body.hero_id != null && body.hero_id !== "" && heroId === null) return reply({ error: "Herói inválido." }, 400);
  const entries = Object.entries(troops);
  if (!entries.length || entries.length > TROOP_TYPES.size) return reply({ error: "Composição de tropas inválida." }, 400);
  const normalized = {};
  let total = 0;
  for (const [type, raw] of entries) {
    const quantity = safeInteger(raw, 0, 100000);
    if (!TROOP_TYPES.has(type) || quantity === null) return reply({ error: "Tipo ou quantidade de tropa inválida." }, 400);
    if (quantity > 0) {
      normalized[type] = quantity;
      total += quantity;
    }
  }
  if (!total || total > 100000) return reply({ error: "A formação deve conter entre 1 e 100.000 tropas." }, 400);
  if (heroId !== null) {
    const hero = await env.DB.prepare(
      "SELECT id FROM heroes WHERE id=? AND kingdom_id=?"
    ).bind(heroId, kingdom.id).first();
    if (!hero) return reply({ error: "O herói não pertence a este reino." }, 403);
  }

  const activate = body.is_active === true;
  const statements = [];
  if (activate) {
    statements.push(env.DB.prepare(
      "UPDATE troop_formations SET is_active=0 WHERE kingdom_id=? AND is_active=1"
    ).bind(kingdom.id));
  }
  statements.push(env.DB.prepare(
    "INSERT INTO troop_formations(kingdom_id,slot_number,formation_name,troop_data,hero_id,is_active,updated_at) " +
    "VALUES(?,?,?,?,?,?,unixepoch()) " +
    "ON CONFLICT(kingdom_id,slot_number) DO UPDATE SET " +
    "formation_name=excluded.formation_name,troop_data=excluded.troop_data," +
    "hero_id=excluded.hero_id,is_active=excluded.is_active,updated_at=unixepoch()"
  ).bind(kingdom.id, slot, name, JSON.stringify(normalized), heroId, activate ? 1 : 0));
  await env.DB.batch(statements);
  return reply({ success: true, slot_number: slot, is_active: activate });
}

export async function handleKingdomMeta(request, env, publicPlayerId, route) {
  try {
    const kingdom = await findKingdom(env, publicPlayerId);
    if (!kingdom) return reply({ error: "Reino não encontrado." }, 404);
    const method = request.method;

    if (route === "vip" && method === "GET") return await getVipStatus(env, kingdom);
    if (route === "visual-settings" && method === "GET") return await getVisualSettings(env, kingdom);
    if (route === "visual-settings" && method === "PUT") return await updateVisualSettings(request, env, kingdom);
    if (route === "speedups" && method === "GET") return await getSpeedups(env, kingdom);
    if (route === "speedups/use" && method === "POST") return await useSpeedup(request, env, kingdom);
    if (route === "tasks" && method === "GET") return await getTasks(env, kingdom);
    if (route === "tasks/claim" && method === "POST") return await claimTask(request, env, kingdom);
    if (route === "mail" && method === "GET") return await getMail(env, kingdom);
    if (route === "mail/read" && method === "POST") return await markMailRead(request, env, kingdom);
    if (route === "mail/claim" && method === "POST") return await claimMail(request, env, kingdom);
    if (route === "achievements" && method === "GET") return await getAchievements(env, kingdom);
    if (route === "achievements/claim" && method === "POST") return await claimAchievement(request, env, kingdom);
    if (route === "ranking" && method === "GET") return await getRanking(env);
    if (route === "formations" && method === "GET") return await getFormations(env, kingdom);
    if (route === "formations/save" && method === "POST") return await saveFormation(request, env, kingdom);
    return reply({ error: "Rota ou método de progressão inválido." }, 404);
  } catch (error) {
    console.error("kingdom_meta_request_failed", String(error?.message || error));
    return reply({ error: "Não foi possível processar a solicitação do reino." }, 500);
  }
}
