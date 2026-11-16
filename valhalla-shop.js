import { getValhallaMultipliers } from "./valhalla-config.js";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

function parseReward(raw) {
  try {
    const value = JSON.parse(String(raw || "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function isSafeCount(value, maximum = 1000000) {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

async function findKingdom(env, publicPlayerId) {
  return env.DB.prepare(
    "SELECT k.id,k.kingdom_name,k.destiny_runes,k.valhalla_rank,k.valhalla_title " +
    "FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?"
  ).bind(publicPlayerId).first();
}

async function getCatalog(env, playerId) {
  const config = await getValhallaMultipliers(env);
  if (!config.active) {
    return json({
      active: false,
      message: "A Ascensão de Valhalla não está ativa.",
    });
  }

  const kingdom = await findKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);

  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    "SELECT c.id,c.name,c.description,c.category,c.cost_runes,c.stock_limit,c.is_featured," +
      "CASE WHEN c.stock_limit=-1 THEN -1 ELSE MAX(0,c.stock_limit-(" +
        "SELECT COUNT(*) FROM valhalla_purchases vp WHERE vp.kingdom_id=? AND vp.catalog_id=c.id" +
      ")) END AS remaining_stock," +
      "(SELECT COUNT(*) FROM valhalla_purchases vp WHERE vp.kingdom_id=? AND vp.catalog_id=c.id) AS purchased_count " +
    "FROM valhalla_catalog c " +
    "WHERE c.active=1 AND (c.available_from=0 OR c.available_from<=?) " +
      "AND (c.available_until=0 OR c.available_until>=?) " +
    "ORDER BY c.is_featured DESC,c.cost_runes ASC,c.name ASC"
  ).bind(kingdom.id, kingdom.id, now, now).all();

  return json({
    active: true,
    player_runes: Number(kingdom.destiny_runes || 0),
    player_rank: Number(kingdom.valhalla_rank || 0),
    kingdom_name: kingdom.kingdom_name,
    catalog: result.results || [],
  });
}

async function validateReward(env, item, reward) {
  if (!reward) return { error: "A recompensa deste item está inválida." };

  if (item.category === "troop_pack") {
    if (!reward.troops || typeof reward.troops !== "object" || Array.isArray(reward.troops)) {
      return { error: "Pacote de tropas inválido." };
    }
    const entries = Object.entries(reward.troops);
    if (!entries.length || entries.length > 8) return { error: "Pacote de tropas inválido." };
    const troopRows = await env.DB.prepare(
      "SELECT id FROM valhalla_troop_catalog WHERE active=1 AND id IN (" +
      entries.map(() => "?").join(",") + ")"
    ).bind(...entries.map(([key]) => key)).all();
    const allowed = new Set((troopRows.results || []).map(row => row.id));
    for (const [unit, count] of entries) {
      if (!allowed.has(unit) || !isSafeCount(count)) {
        return { error: "O pacote contém uma unidade ou quantidade inválida." };
      }
    }
    return { delivery: { type: "troops", entries } };
  }

  if (item.category === "hero") {
    const heroKey = String(reward.hero || "");
    const level = Number(reward.level ?? 1);
    if (!/^[a-z0-9_]{2,64}$/.test(heroKey) || !Number.isSafeInteger(level) || level < 1 || level > 100) {
      return { error: "Recompensa de herói inválida." };
    }
    const hero = await env.DB.prepare(
      "SELECT hero_key,hero_name,rarity,base_level FROM valhalla_hero_catalog WHERE hero_key=? AND active=1"
    ).bind(heroKey).first();
    if (!hero) return { error: "Herói sazonal não está disponível no catálogo." };
    return { delivery: { type: "hero", hero, level: Math.max(level, Number(hero.base_level || 1)) } };
  }

  if (item.category === "cosmetic") {
    const cosmeticId = String(reward.cosmetic || "");
    if (!/^[a-zA-Z0-9_-]{2,80}$/.test(cosmeticId)) {
      return { error: "Cosmético inválido." };
    }
    return { delivery: { type: "cosmetic", cosmeticId, appliesTo: String(reward.applies_to || "kingdom").slice(0, 40) } };
  }

  if (item.category === "title") {
    const title = String(reward.title || "");
    if (!/^[a-zA-Z0-9_-]{2,80}$/.test(title)) return { error: "Título sazonal inválido." };
    return { delivery: { type: "title", title } };
  }

  if (item.category === "buff") {
    const buffKey = String(reward.buff || "");
    const multiplier = Number(reward.multiplier);
    const durationHours = Number(reward.duration_hours);
    const allowedBuffs = new Set(["attack_power", "build_speed", "resource_production"]);
    if (!allowedBuffs.has(buffKey) || !Number.isFinite(multiplier) ||
        multiplier <= 1 || multiplier > 5 || !Number.isSafeInteger(durationHours) ||
        durationHours < 1 || durationHours > 168) {
      return { error: "Configuração do bônus temporário inválida." };
    }
    return { delivery: { type: "buff", buffKey, multiplier, durationHours } };
  }

  return { error: "Categoria de recompensa não suportada." };
}

async function getPurchaseFailure(env, kingdomId, item) {
  const [kingdom, stock] = await Promise.all([
    env.DB.prepare("SELECT destiny_runes FROM kingdoms WHERE id=?").bind(kingdomId).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM valhalla_purchases WHERE kingdom_id=? AND catalog_id=?")
      .bind(kingdomId, item.id).first(),
  ]);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);
  const balance = Number(kingdom.destiny_runes || 0);
  if (balance < Number(item.cost_runes)) {
    return json({
      error: "Runas do Destino insuficientes.",
      required: Number(item.cost_runes),
      available: balance,
    }, 402);
  }
  if (Number(item.stock_limit) !== -1 && Number(stock?.count || 0) >= Number(item.stock_limit)) {
    return json({
      error: "Limite de compras atingido para este item.",
      limit: Number(item.stock_limit),
      purchased: Number(stock?.count || 0),
    }, 409);
  }
  return json({ error: "Não foi possível confirmar a compra. Atualize o catálogo e tente novamente." }, 409);
}

async function getExistingRequest(env, requestKey) {
  return env.DB.prepare(
    "SELECT id,kingdom_id,catalog_id,cost_runes,reward_json,request_key,purchased_at " +
    "FROM valhalla_purchases WHERE request_key=?"
  ).bind(requestKey).first();
}

async function replayPurchase(env, existing, kingdomId, catalogId) {
  if (Number(existing.kingdom_id) !== Number(kingdomId) || existing.catalog_id !== catalogId) {
    return json({ error: "request_key já utilizado em outra compra." }, 409);
  }
  const kingdom = await env.DB.prepare("SELECT destiny_runes FROM kingdoms WHERE id=?").bind(kingdomId).first();
  return json({
    success: true,
    replayed: true,
    message: "Esta compra já foi processada anteriormente.",
    purchase_id: existing.id,
    new_runes_balance: Number(kingdom?.destiny_runes || 0),
    reward: parseReward(existing.reward_json),
  });
}

function buildDeliveryStatements(env, delivery, kingdomId, purchaseKey, purchaseIdKey) {
  const statements = [];
  if (delivery.type === "troops") {
    for (const [unit, quantity] of delivery.entries) {
      statements.push(env.DB.prepare(
        "INSERT INTO valhalla_troops(kingdom_id,unit_type,quantity,wounded,updated_at) " +
        "SELECT ?,?,?,0,unixepoch() WHERE changes()>0 " +
        "ON CONFLICT(kingdom_id,unit_type) DO UPDATE SET " +
        "quantity=valhalla_troops.quantity+excluded.quantity,updated_at=unixepoch()"
      ).bind(kingdomId, unit, quantity));
    }
  } else if (delivery.type === "hero") {
    const rarity = delivery.hero.rarity === "mythic" ? "purple" : "purple";
    statements.push(env.DB.prepare(
      "INSERT INTO hero_inventory(kingdom_id,hero_key,rarity,level,experience) " +
      "SELECT ?,?,?,?,0 WHERE changes()>0"
    ).bind(kingdomId, delivery.hero.hero_key, rarity, delivery.level));
    statements.push(env.DB.prepare(
      "INSERT INTO heroes(kingdom_id,hero_key,hero_name,level,experience,rarity) " +
      "SELECT ?,?,?,?,?,? WHERE changes()>0"
    ).bind(
      kingdomId,
      delivery.hero.hero_key,
      delivery.hero.hero_name,
      delivery.level,
      0,
      delivery.hero.rarity
    ));
    statements.push(env.DB.prepare(
      "INSERT INTO hero_summon_history(kingdom_id,hero_key,rarity,result_type) " +
      "SELECT ?,?,?, 'valhalla_shop' WHERE changes()>0"
    ).bind(kingdomId, delivery.hero.hero_key, delivery.hero.rarity));
  } else if (delivery.type === "cosmetic") {
    statements.push(env.DB.prepare(
      "INSERT INTO kingdom_cosmetics(kingdom_id,item_id,kind) " +
      "SELECT ?,?,'valhalla_skin' WHERE changes()>0"
    ).bind(kingdomId, delivery.cosmeticId));
  } else if (delivery.type === "title") {
    statements.push(env.DB.prepare(
      "INSERT INTO kingdom_cosmetics(kingdom_id,item_id,kind) " +
      "SELECT ?,?,'valhalla_title' WHERE changes()>0"
    ).bind(kingdomId, delivery.title));
    statements.push(env.DB.prepare(
      "UPDATE kingdoms SET valhalla_title=?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=? AND changes()>0"
    ).bind(delivery.title, kingdomId));
  } else if (delivery.type === "buff") {
    statements.push(env.DB.prepare(
      "INSERT INTO valhalla_buffs(kingdom_id,buff_key,multiplier,starts_at,expires_at,purchase_id) " +
      "SELECT ?,?,?,unixepoch(),unixepoch()+?,(SELECT id FROM valhalla_purchases WHERE request_key=?) " +
      "WHERE changes()>0"
    ).bind(
      kingdomId,
      delivery.buffKey,
      delivery.multiplier,
      delivery.durationHours * 3600,
      purchaseKey
    ));
  }

  // The final event is an audit breadcrumb, not the source of truth for the purchase or balance.
  statements.push(env.DB.prepare(
    "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) " +
    "SELECT ?,?,? WHERE changes()>0"
  ).bind(
    kingdomId,
    "valhalla_shop_purchase",
    JSON.stringify({ request_key: purchaseKey, purchase_idempotency_key: purchaseIdKey, reward_type: delivery.type })
  ));
  return statements;
}

async function buyItem(env, playerId, body) {
  const catalogId = String(body.catalog_id || "").trim();
  const requestKey = String(body.request_key || "").trim();
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(catalogId)) {
    return json({ error: "catalog_id obrigatório ou inválido." }, 400);
  }
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey)) {
    return json({ error: "request_key obrigatório (16–80 caracteres) para evitar compras duplicadas." }, 400);
  }

  const config = await getValhallaMultipliers(env);
  if (!config.active) return json({ error: "A Loja de Valhalla não está ativa." }, 403);

  const kingdom = await findKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);

  const existing = await getExistingRequest(env, requestKey);
  if (existing) return replayPurchase(env, existing, kingdom.id, catalogId);

  const now = Math.floor(Date.now() / 1000);
  const item = await env.DB.prepare(
    "SELECT id,name,description,category,cost_runes,reward_json,stock_limit,available_from,available_until,is_featured,active " +
    "FROM valhalla_catalog WHERE id=?"
  ).bind(catalogId).first();
  if (!item || Number(item.active) !== 1) return json({ error: "Item não encontrado ou indisponível." }, 404);
  if (Number(item.available_from) > 0 && Number(item.available_from) > now) {
    return json({ error: "Item ainda não está disponível." }, 409);
  }
  if (Number(item.available_until) > 0 && Number(item.available_until) < now) {
    return json({ error: "A disponibilidade deste item terminou." }, 409);
  }

  const reward = parseReward(item.reward_json);
  const validated = await validateReward(env, item, reward);
  if (validated.error) {
    console.error("[VALHALLA SHOP] Recompensa inválida no catálogo:", item.id, validated.error);
    return json({ error: "A recompensa deste item não está configurada corretamente." }, 503);
  }

  const delivery = validated.delivery;
  if (delivery.type === "hero") {
    const owned = await env.DB.prepare(
      "SELECT 1 AS found FROM hero_inventory WHERE kingdom_id=? AND hero_key=? " +
      "UNION ALL SELECT 1 AS found FROM heroes WHERE kingdom_id=? AND hero_key=? LIMIT 1"
    ).bind(kingdom.id, delivery.hero.hero_key, kingdom.id, delivery.hero.hero_key).first();
    if (owned) return json({ error: "Este reino já possui o herói sazonal." }, 409);
  }
  if (delivery.type === "cosmetic") {
    const owned = await env.DB.prepare(
      "SELECT 1 AS found FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?"
    ).bind(kingdom.id, delivery.cosmeticId).first();
    if (owned) return json({ error: "Este cosmético já pertence ao reino." }, 409);
  }
  if (delivery.type === "title") {
    const owned = await env.DB.prepare(
      "SELECT 1 AS found FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?"
    ).bind(kingdom.id, delivery.title).first();
    if (owned) return json({ error: "Este título já foi adquirido por este reino." }, 409);
  }

  const purchaseIdempotencyKey = "valhalla-shop:" + requestKey;
  const metadata = JSON.stringify({
    catalog_id: item.id,
    item_name: item.name,
    request_key: requestKey,
  });

  const statements = [
    // Purchase is the first conditional write. Every following statement is chained
    // to changes()>0, so retries and failed preconditions cannot deliver rewards.
    env.DB.prepare(
      "INSERT INTO valhalla_purchases(kingdom_id,catalog_id,cost_runes,reward_json,request_key) " +
      "SELECT ?,?,?,?,? " +
      "WHERE EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND destiny_runes>=?) " +
      "AND EXISTS(SELECT 1 FROM valhalla_catalog WHERE id=? AND active=1 " +
        "AND (available_from=0 OR available_from<=?) AND (available_until=0 OR available_until>=?)) " +
      "AND (?=-1 OR (SELECT COUNT(*) FROM valhalla_purchases WHERE kingdom_id=? AND catalog_id=?)<?) " +
      "AND NOT EXISTS(SELECT 1 FROM valhalla_purchases WHERE request_key=?) " +
      "AND (?<>'hero' OR NOT EXISTS(SELECT 1 FROM hero_inventory WHERE kingdom_id=? AND hero_key=?)) " +
      "AND (?<>'hero' OR NOT EXISTS(SELECT 1 FROM heroes WHERE kingdom_id=? AND hero_key=?)) " +
      "AND (?<>'cosmetic' OR NOT EXISTS(SELECT 1 FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?)) " +
      "AND (?<>'title' OR NOT EXISTS(SELECT 1 FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?))"
    ).bind(
      kingdom.id, item.id, item.cost_runes, item.reward_json, requestKey,
      kingdom.id, item.cost_runes,
      item.id, now, now,
      item.stock_limit, kingdom.id, item.id, item.stock_limit,
      requestKey,
      item.category, kingdom.id, delivery.hero?.hero_key || "",
      item.category, kingdom.id, delivery.hero?.hero_key || "",
      item.category, kingdom.id, delivery.cosmeticId || "",
      item.category, kingdom.id, delivery.title || ""
    ),
    env.DB.prepare(
      "UPDATE kingdoms SET destiny_runes=destiny_runes-?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=? AND destiny_runes>=? AND changes()>0"
    ).bind(item.cost_runes, kingdom.id, item.cost_runes),
    env.DB.prepare(
      "INSERT INTO valhalla_rune_ledger(kingdom_id,entry_type,reason,amount,idempotency_key,metadata_json) " +
      "SELECT ?,'debit','shop_purchase',?,?,? WHERE changes()>0"
    ).bind(kingdom.id, item.cost_runes, purchaseIdempotencyKey, metadata),
    ...buildDeliveryStatements(env, delivery, kingdom.id, requestKey, purchaseIdempotencyKey),
  ];

  let results;
  try {
    results = await env.DB.batch(statements);
  } catch (error) {
    const repeated = await getExistingRequest(env, requestKey);
    if (repeated) return replayPurchase(env, repeated, kingdom.id, catalogId);
    console.error("[VALHALLA SHOP] D1 batch failed:", String(error?.message || error));
    return json({ error: "Falha ao processar a compra. Nenhuma recompensa foi liberada." }, 500);
  }

  if (!results[0]?.meta?.changes) {
    const repeated = await getExistingRequest(env, requestKey);
    if (repeated) return replayPurchase(env, repeated, kingdom.id, catalogId);
    return await getPurchaseFailure(env, kingdom.id, item);
  }

  if (!results[1]?.meta?.changes || !results[2]?.meta?.changes) {
    console.error("[VALHALLA SHOP] Inconsistência em compra encadeada:", requestKey);
    return json({ error: "A compra não foi concluída corretamente. Contate o suporte com o protocolo da solicitação." }, 500);
  }

  const purchase = await getExistingRequest(env, requestKey);
  const updatedKingdom = await env.DB.prepare(
    "SELECT destiny_runes FROM kingdoms WHERE id=?"
  ).bind(kingdom.id).first();

  return json({
    success: true,
    replayed: false,
    message: "Compra realizada: " + item.name,
    purchase_id: purchase?.id || null,
    new_runes_balance: Number(updatedKingdom?.destiny_runes || 0),
    reward,
  }, 201);
}

async function getHistory(env, playerId) {
  const kingdom = await findKingdom(env, playerId);
  if (!kingdom) return json({ error: "Reino não encontrado." }, 404);

  const result = await env.DB.prepare(
    "SELECT vp.id,vp.catalog_id,vc.name,vc.category,vp.cost_runes,vp.reward_json," +
      "vp.purchased_at,vp.request_key " +
    "FROM valhalla_purchases vp JOIN valhalla_catalog vc ON vc.id=vp.catalog_id " +
    "WHERE vp.kingdom_id=? ORDER BY vp.purchased_at DESC,vp.id DESC LIMIT 50"
  ).bind(kingdom.id).all();

  return json({ history: result.results || [] });
}

export async function getValhallaBuffMultipliers(env, kingdomId, now = Math.floor(Date.now() / 1000)) {
  if (!env?.DB || !Number.isSafeInteger(Number(kingdomId)) || Number(kingdomId) <= 0) {
    return { attackPower: 1, buildSpeed: 1, resourceProduction: 1 };
  }
  const rows = await env.DB.prepare(
    "SELECT buff_key,MAX(multiplier) AS multiplier FROM valhalla_buffs " +
    "WHERE kingdom_id=? AND starts_at<=? AND expires_at>? GROUP BY buff_key"
  ).bind(kingdomId, now, now).all();
  const values = Object.fromEntries((rows.results || []).map(row => [row.buff_key, Number(row.multiplier) || 1]));
  return {
    attackPower: Math.max(1, Math.min(5, values.attack_power || 1)),
    buildSpeed: Math.max(1, Math.min(5, values.build_speed || 1)),
    resourceProduction: Math.max(1, Math.min(5, values.resource_production || 1)),
  };
}

export async function handleValhallaShop(request, env, playerId, body = {}) {
  if (!env?.DB) return json({ error: "Banco D1 indisponível." }, 503);
  const path = new URL(request.url).pathname;
  try {
    if (request.method === "GET" && path === "/api/game/valhalla-shop/catalog") {
      return await getCatalog(env, playerId);
    }
    if (request.method === "GET" && path === "/api/game/valhalla-shop/history") {
      return await getHistory(env, playerId);
    }
    if (request.method === "POST" && path === "/api/game/valhalla-shop/buy") {
      return await buyItem(env, playerId, body);
    }
    return json({ error: "Rota da Loja de Valhalla inválida." }, 404);
  } catch (error) {
    console.error("[VALHALLA SHOP ERROR]", String(error?.message || error));
    return json({ error: "Erro interno na Loja de Valhalla." }, 500);
  }
}
