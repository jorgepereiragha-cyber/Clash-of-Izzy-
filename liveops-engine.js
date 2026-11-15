export const DAILY_TASKS = [
  { id: "train_troops", title: "Reforçar as fileiras", description: "Treine 20 unidades", target: 20, kind: "sum", source: "troops_trained", reward: { food: 1200, wood: 600 }, icon: "⚔️" },
  { id: "upgrade_building", title: "Erguer o reino", description: "Melhore 1 edifício", target: 1, kind: "count", source: "building_upgraded", reward: { wood: 500, stone: 500 }, icon: "🏰" },
  { id: "research", title: "Conhecimento é poder", description: "Conclua 1 pesquisa", target: 1, kind: "count", source: "research_upgraded", reward: { gold: 250 }, icon: "🔬" },
  { id: "battle", title: "Provar seu valor", description: "Participe de 1 batalha PvE", target: 1, kind: "battle", source: "battle_reports", reward: { food: 1000, gold: 150 }, icon: "🛡️" }
];

function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

async function taskProgress(env, kingdomId, task, day) {
  if (task.kind === "battle") {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS value FROM battle_reports WHERE attacker_kingdom_id=? AND battle_type='pve' AND date(created_at)=?"
    ).bind(kingdomId, day).first();
    return Number(row?.value || 0);
  }
  if (task.kind === "sum") {
    const row = await env.DB.prepare(
      "SELECT COALESCE(SUM(CAST(json_extract(payload_json,'$.quantity') AS INTEGER)),0) AS value FROM kingdom_events WHERE kingdom_id=? AND event_type=? AND date(created_at)=?"
    ).bind(kingdomId, task.source, day).first();
    return Number(row?.value || 0);
  }
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS value FROM kingdom_events WHERE kingdom_id=? AND event_type=? AND date(created_at)=?"
  ).bind(kingdomId, task.source, day).first();
  return Number(row?.value || 0);
}

export async function getDailyTasks(env, kingdomId, now = new Date()) {
  const day = utcDay(now);
  const claims = await env.DB.prepare(
    "SELECT task_id FROM liveops_daily_claims WHERE kingdom_id=? AND cycle_id=?"
  ).bind(kingdomId, day).all();
  const claimed = new Set((claims.results || []).map(row => row.task_id));
  const tasks = await Promise.all(DAILY_TASKS.map(async task => {
    const progress = Math.min(task.target, await taskProgress(env, kingdomId, task, day));
    return {
      id: task.id, title: task.title, description: task.description, icon: task.icon,
      target: task.target, progress, completed: progress >= task.target,
      claimed: claimed.has(task.id), reward: task.reward
    };
  }));
  return { cycleId: day, resetsAt: new Date(Date.parse(day + "T00:00:00.000Z") + 86400000).toISOString(), tasks };
}

export async function claimDailyTask(env, kingdomId, taskId, now = new Date()) {
  const task = DAILY_TASKS.find(item => item.id === taskId);
  if (!task) return { ok: false, error: "Missão diária inválida." };
  const day = utcDay(now);
  const progress = await taskProgress(env, kingdomId, task, day);
  if (progress < task.target) return { ok: false, error: "Conclua o objetivo antes de resgatar a recompensa." };
  const reward = task.reward;
  const insert = env.DB.prepare(
    "INSERT OR IGNORE INTO liveops_daily_claims(kingdom_id,cycle_id,task_id) VALUES(?,?,?)"
  ).bind(kingdomId, day, task.id);
  const update = env.DB.prepare(
    "UPDATE kingdoms SET food=food+?,wood=wood+?,stone=stone+?,iron=iron+?,gold=gold+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0"
  ).bind(reward.food || 0, reward.wood || 0, reward.stone || 0, reward.iron || 0, reward.gold || 0, kingdomId);
  const result = await env.DB.batch([insert, update]);
  if (!result[0]?.meta?.changes) return { ok: false, error: "Esta recompensa já foi resgatada hoje." };
  return { ok: true, taskId: task.id, reward, cycleId: day };
}
