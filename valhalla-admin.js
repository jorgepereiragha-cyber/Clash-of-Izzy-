import { getValhallaConfig } from "./valhalla-config.js";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

function formatTimeRemaining(seconds) {
  if (seconds <= 0) return "Encerrado";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(days + "d");
  if (hours) parts.push(hours + "h");
  if (minutes) parts.push(minutes + "m");
  return parts.join(" ") || "< 1m";
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getStatus(env) {
  const config = await getValhallaConfig(env);
  const rows = await env.DB.prepare(
    "SELECT key,value FROM game_config WHERE key LIKE 'valhalla_%'"
  ).all();
  const values = Object.fromEntries((rows.results || []).map(row => [row.key, row.value]));
  const now = Math.floor(Date.now() / 1000);
  const remaining = config.active && config.endTime > 0
    ? Math.max(0, config.endTime - now)
    : null;

  return json({
    valhalla_mode_active: config.active ? "1" : "0",
    configured_active: values.valhalla_mode_active === "1",
    active: config.active,
    valhalla_resource_multiplier: config.resourceMultiplier,
    valhalla_speed_multiplier: config.speedMultiplier,
    valhalla_daily_runes_reward: config.dailyRunesReward,
    valhalla_start_time: config.startTime,
    valhalla_end_time: config.endTime,
    time_remaining_seconds: remaining,
    time_remaining_formatted: remaining === null ? "N/A" : formatTimeRemaining(remaining),
  });
}

async function toggleMode(body, env) {
  const action = String(body.action || "");
  if (action !== "activate" && action !== "deactivate") {
    return json({ error: 'Ação inválida. Use "activate" ou "deactivate".' }, 400);
  }

  const current = await getValhallaConfig(env);
  const now = Math.floor(Date.now() / 1000);

  if (action === "activate" && current.active) {
    return json({
      success: true,
      unchanged: true,
      message: "A Ascensão de Valhalla já está ativa.",
      start_time: current.startTime,
      end_time: current.endTime,
    });
  }

  if (action === "deactivate") {
    await env.DB.prepare(
      "UPDATE game_config SET value='0',updated_at=? WHERE key='valhalla_mode_active'"
    ).bind(now).run();

    console.log("[VALHALLA ADMIN] Modo desativado pelo painel Master.");
    return json({ success: true, message: "Modo Ascensão de Valhalla desativado." });
  }

  const endTime = now + 14 * 24 * 60 * 60;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE game_config SET value='1',updated_at=? WHERE key='valhalla_mode_active'"
    ).bind(now),
    env.DB.prepare(
      "UPDATE game_config SET value=?,updated_at=? WHERE key='valhalla_start_time'"
    ).bind(String(now), now),
    env.DB.prepare(
      "UPDATE game_config SET value=?,updated_at=? WHERE key='valhalla_end_time'"
    ).bind(String(endTime), now),
  ]);

  console.log("[VALHALLA ADMIN] Modo ativado pelo painel Master. Término:", endTime);
  return json({
    success: true,
    message: "Modo Ascensão de Valhalla ativado por 14 dias.",
    start_time: now,
    end_time: endTime,
    duration_days: 14,
  });
}

async function updateConfig(body, env) {
  const updates = [];
  const now = Math.floor(Date.now() / 1000);

  if (body.resource_multiplier !== undefined) {
    const value = finiteNumber(body.resource_multiplier);
    // Keep this range aligned with normalizeValhallaConfigRows() in valhalla-config.js.
    if (value === null || value < 1 || value > 20) {
      return json({ error: "Multiplicador de recursos deve estar entre 1 e 20." }, 400);
    }
    updates.push(["valhalla_resource_multiplier", String(value)]);
  }

  if (body.speed_multiplier !== undefined) {
    const value = finiteNumber(body.speed_multiplier);
    // The runtime enforces a 0.05 floor to avoid pathological queue durations.
    if (value === null || value < 0.05 || value > 1) {
      return json({ error: "Multiplicador de velocidade deve estar entre 0,05 e 1." }, 400);
    }
    updates.push(["valhalla_speed_multiplier", String(value)]);
  }

  if (body.daily_runes_reward !== undefined) {
    const value = finiteNumber(body.daily_runes_reward);
    if (value === null || !Number.isSafeInteger(value) || value < 1 || value > 100000) {
      return json({ error: "Recompensa diária deve ser um inteiro entre 1 e 100.000." }, 400);
    }
    updates.push(["valhalla_daily_runes_reward", String(value)]);
  }

  if (!updates.length) {
    return json({ error: "Nenhuma configuração válida foi fornecida." }, 400);
  }

  await env.DB.batch(updates.map(([key, value]) => env.DB.prepare(
    "UPDATE game_config SET value=?,updated_at=? WHERE key=?"
  ).bind(value, now, key)));

  console.log("[VALHALLA ADMIN] Configurações atualizadas:", Object.fromEntries(updates));
  return json({ success: true, message: "Configurações de Valhalla atualizadas." });
}

async function getStats(env) {
  const [
    playersWithRunes,
    creditedRunes,
    circulatingRunes,
    totalPurchases,
    spentRunes,
    purchasesByCategory,
    topItems,
    rankedKingdoms,
    wildHunt,
  ] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM kingdoms WHERE destiny_runes>0").first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM valhalla_rune_ledger WHERE entry_type='credit'").first(),
    env.DB.prepare("SELECT COALESCE(SUM(destiny_runes),0) AS total FROM kingdoms").first(),
    env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(cost_runes),0) AS total_cost FROM valhalla_purchases").first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM valhalla_rune_ledger WHERE entry_type='debit'").first(),
    env.DB.prepare(
      "SELECT vc.category,COUNT(*) AS count,COALESCE(SUM(vp.cost_runes),0) AS total_cost " +
      "FROM valhalla_purchases vp JOIN valhalla_catalog vc ON vc.id=vp.catalog_id " +
      "GROUP BY vc.category ORDER BY count DESC"
    ).all(),
    env.DB.prepare(
      "SELECT vc.id,vc.name,vc.category,COUNT(*) AS purchase_count " +
      "FROM valhalla_purchases vp JOIN valhalla_catalog vc ON vc.id=vp.catalog_id " +
      "GROUP BY vp.catalog_id,vc.id,vc.name,vc.category " +
      "ORDER BY purchase_count DESC,vc.name LIMIT 5"
    ).all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM kingdoms WHERE valhalla_rank>0").first(),
    env.DB.prepare(
      "SELECT COUNT(*) AS total_spawns," +
      "COALESCE(SUM(CASE WHEN status='defeated' THEN 1 ELSE 0 END),0) AS defeated," +
      "COALESCE(SUM(CASE WHEN status='escaped' THEN 1 ELSE 0 END),0) AS escaped " +
      "FROM valhalla_wild_hunt"
    ).first(),
  ]);

  return json({
    players_with_runes: Number(playersWithRunes?.count || 0),
    total_runes_distributed: Number(creditedRunes?.total || 0),
    total_runes_in_circulation: Number(circulatingRunes?.total || 0),
    total_purchases: Number(totalPurchases?.count || 0),
    total_purchase_cost: Number(totalPurchases?.total_cost || 0),
    total_runes_spent: Number(spentRunes?.total || 0),
    purchases_by_category: purchasesByCategory.results || [],
    top_items: topItems.results || [],
    ranked_players: Number(rankedKingdoms?.count || 0),
    wild_hunt: {
      total_spawns: Number(wildHunt?.total_spawns || 0),
      defeated: Number(wildHunt?.defeated || 0),
      escaped: Number(wildHunt?.escaped || 0),
    },
  });
}

async function getLeaderboard(env) {
  const result = await env.DB.prepare(
    "WITH rune_totals AS (" +
      "SELECT kingdom_id,SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END) AS runes_spent " +
      "FROM valhalla_rune_ledger GROUP BY kingdom_id" +
    "), purchase_totals AS (" +
      "SELECT kingdom_id,COUNT(*) AS purchase_count " +
      "FROM valhalla_purchases GROUP BY kingdom_id" +
    ") " +
    "SELECT k.id AS kingdom_id,p.name AS player_name,k.kingdom_name," +
      "k.destiny_runes,k.valhalla_rank,k.valhalla_title," +
      "COALESCE(rt.runes_spent,0) AS runes_spent," +
      "COALESCE(pt.purchase_count,0) AS purchase_count " +
    "FROM kingdoms k JOIN players p ON p.id=k.player_id " +
    "LEFT JOIN rune_totals rt ON rt.kingdom_id=k.id " +
    "LEFT JOIN purchase_totals pt ON pt.kingdom_id=k.id " +
    "WHERE k.destiny_runes>0 OR COALESCE(rt.runes_spent,0)>0 OR COALESCE(pt.purchase_count,0)>0 " +
    "ORDER BY runes_spent DESC,k.destiny_runes DESC,k.kingdom_name LIMIT 50"
  ).all();

  const leaderboard = (result.results || []).map(row => ({
    ...row,
    destiny_runes: Number(row.destiny_runes || 0),
    valhalla_rank: Number(row.valhalla_rank || 0),
    runes_spent: Number(row.runes_spent || 0),
    purchase_count: Number(row.purchase_count || 0),
  }));

  return json({ leaderboard, total: leaderboard.length });
}

async function manualDistributeRunes(body, env) {
  const playerId = String(body.player_id || "").trim();
  const amount = finiteNumber(body.amount);
  const reason = String(body.reason || "Distribuição manual").trim().slice(0, 200);
  const requestKey = String(body.request_key || "").trim();

  if (!playerId || playerId.length > 80 ||
      amount === null || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000 ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey)) {
    return json({
      error: "Informe player_id, quantidade inteira de 1 a 100.000 e request_key válido.",
    }, 400);
  }

  const target = await env.DB.prepare(
    "SELECT p.name AS player_name,k.id AS kingdom_id,k.kingdom_name,k.destiny_runes " +
    "FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?"
  ).bind(playerId).first();

  if (!target) return json({ error: "Jogador ou reino não encontrado." }, 404);

  const metadata = JSON.stringify({
    actor: "master",
    reason: reason || "Distribuição manual",
    request_key: requestKey,
  });

  const results = await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO valhalla_rune_ledger" +
      "(kingdom_id,entry_type,reason,amount,idempotency_key,metadata_json) " +
      "SELECT ?,'credit','admin_adjustment',?,?,? WHERE EXISTS(SELECT 1 FROM kingdoms WHERE id=?)"
    ).bind(target.kingdom_id, amount, requestKey, metadata, target.kingdom_id),
    env.DB.prepare(
      "UPDATE kingdoms SET destiny_runes=destiny_runes+?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=? AND changes()>0"
    ).bind(amount, target.kingdom_id),
  ]);

  if (!results[0]?.meta?.changes) {
    const existing = await env.DB.prepare(
      "SELECT kingdom_id,entry_type,reason,amount FROM valhalla_rune_ledger WHERE idempotency_key=?"
    ).bind(requestKey).first();

    if (existing &&
        Number(existing.kingdom_id) === Number(target.kingdom_id) &&
        existing.entry_type === "credit" &&
        existing.reason === "admin_adjustment" &&
        Number(existing.amount) === amount) {
      const current = await env.DB.prepare(
        "SELECT destiny_runes FROM kingdoms WHERE id=?"
      ).bind(target.kingdom_id).first();
      return json({
        success: true,
        reused: true,
        message: "Esta distribuição já havia sido processada.",
        new_balance: Number(current?.destiny_runes || 0),
        player_name: target.player_name,
        kingdom_name: target.kingdom_name,
      });
    }

    return json({ error: "Chave de solicitação já utilizada ou distribuição não registrada." }, 409);
  }

  if (!results[1]?.meta?.changes) {
    console.error("[VALHALLA ADMIN] Ledger creditado sem confirmação do saldo:", requestKey);
    return json({ error: "Não foi possível confirmar a atualização do saldo. Verifique o ledger." }, 500);
  }

  const updated = await env.DB.prepare(
    "SELECT destiny_runes FROM kingdoms WHERE id=?"
  ).bind(target.kingdom_id).first();

  console.log("[VALHALLA ADMIN] Distribuição manual:", {
    kingdomId: target.kingdom_id,
    amount,
    requestKey,
    reason,
  });

  return json({
    success: true,
    reused: false,
    message: amount + " Runas do Destino distribuídas para " + (target.player_name || target.kingdom_name) + ".",
    new_balance: Number(updated?.destiny_runes || 0),
    player_name: target.player_name,
    kingdom_name: target.kingdom_name,
    amount,
    reason,
  });
}

export async function handleValhallaAdmin(request, env, body = {}) {
  if (!env?.DB) return json({ error: "Banco D1 indisponível." }, 503);

  const path = new URL(request.url).pathname;
  try {
    if (request.method === "GET" && path === "/api/valhalla-admin/status") {
      return await getStatus(env);
    }
    if (request.method === "GET" && path === "/api/valhalla-admin/stats") {
      return await getStats(env);
    }
    if (request.method === "GET" && path === "/api/valhalla-admin/leaderboard") {
      return await getLeaderboard(env);
    }
    if (request.method === "POST" && path === "/api/valhalla-admin/toggle") {
      return await toggleMode(body, env);
    }
    if (request.method === "POST" && path === "/api/valhalla-admin/update-config") {
      return await updateConfig(body, env);
    }
    if (request.method === "POST" && path === "/api/valhalla-admin/distribute-runes") {
      return await manualDistributeRunes(body, env);
    }
    return json({ error: "Rota administrativa Valhalla inválida." }, 404);
  } catch (error) {
    console.error("[VALHALLA ADMIN ERROR]", String(error?.message || error));
    return json({ error: "Erro interno no controle administrativo de Valhalla." }, 500);
  }
}
