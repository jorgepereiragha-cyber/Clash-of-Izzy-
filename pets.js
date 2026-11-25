// Mascotes do reino: inventário, evolução e passivas calculadas no servidor.
const MAX_PET_LEVEL = 50;
const MAX_FEED_AMOUNT = 1000;

function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function safeJson(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function kingdomForPlayer(env, publicPlayerId) {
  const row = await env.DB.prepare(
    "SELECT k.id FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?"
  ).bind(publicPlayerId).first();
  return row ? Number(row.id) : null;
}

export function calculatePetProgress(level, experience, gainedExperience, maxLevel = MAX_PET_LEVEL) {
  let nextLevel = Math.max(1, Math.min(maxLevel, Math.floor(Number(level) || 1)));
  let nextExperience = Math.max(0, Math.floor(Number(experience) || 0)) +
    Math.max(0, Math.floor(Number(gainedExperience) || 0));
  while (nextLevel < maxLevel && nextExperience >= nextLevel * 100) {
    nextExperience -= nextLevel * 100;
    nextLevel += 1;
  }
  return { level: nextLevel, experience: nextExperience };
}

function petBonusesFromRow(row) {
  const empty = {
    activePetId: null,
    marchSpeedPercent: 0,
    infantryAttackPercent: 0,
    resourceProductionMultiplier: 1
  };
  if (!row) return empty;

  const skill = safeJson(row.base_skill_json);
  const value = Math.max(0, Number(skill.value) || 0);
  const levelScale = 1 + Math.max(0, Number(row.level || 1) - 1) * 0.02;
  const scaled = value * levelScale;
  const bonuses = { ...empty, activePetId: row.pet_id };

  if (skill.type === "march_speed") {
    bonuses.marchSpeedPercent = Math.min(50, scaled * 100);
  } else if (skill.type === "infantry_attack") {
    bonuses.infantryAttackPercent = Math.min(30, scaled * 100);
  } else if (skill.type === "resource_prod") {
    bonuses.resourceProductionMultiplier = Math.min(1.5, 1 + scaled);
  }
  return bonuses;
}

export async function getPetBonuses(env, kingdomId) {
  if (!env?.DB || !Number.isSafeInteger(Number(kingdomId)) || Number(kingdomId) <= 0) {
    return petBonusesFromRow(null);
  }
  const row = await env.DB.prepare(
    "SELECT kp.pet_id,kp.level,pc.base_skill_json " +
    "FROM kingdom_pets kp JOIN pet_catalog pc ON pc.id=kp.pet_id " +
    "WHERE kp.kingdom_id=? AND kp.is_active=1 AND pc.active=1 LIMIT 1"
  ).bind(Number(kingdomId)).first();
  return petBonusesFromRow(row);
}

export async function getPetsState(env, kingdomId) {
  const reads = await env.DB.batch([
    env.DB.prepare(
      "SELECT pc.id,pc.name,pc.description,pc.rarity,pc.base_skill_json,pc.icon,pc.unlock_cost_gold, " +
      "kp.level,kp.experience,kp.is_active,kp.acquired_at, " +
      "CASE WHEN kp.pet_id IS NULL THEN 0 ELSE 1 END AS is_owned " +
      "FROM pet_catalog pc LEFT JOIN kingdom_pets kp " +
      "ON kp.pet_id=pc.id AND kp.kingdom_id=? " +
      "WHERE pc.active=1 ORDER BY CASE pc.rarity WHEN 'mythic' THEN 0 WHEN 'legendary' THEN 1 WHEN 'epic' THEN 2 WHEN 'rare' THEN 3 ELSE 4 END,pc.name"
    ).bind(kingdomId),
    env.DB.prepare("SELECT gold FROM kingdoms WHERE id=?").bind(kingdomId),
    env.DB.prepare(
      "SELECT kp.pet_id,kp.level,pc.base_skill_json " +
      "FROM kingdom_pets kp JOIN pet_catalog pc ON pc.id=kp.pet_id " +
      "WHERE kp.kingdom_id=? AND kp.is_active=1 AND pc.active=1 LIMIT 1"
    ).bind(kingdomId)
  ]);

  const rows = reads[0];
  const kingdom = reads[1]?.results?.[0] || null;
  const bonuses = petBonusesFromRow(reads[2]?.results?.[0] || null);
  const pets = (rows.results || []).map(row => ({
    ...row,
    is_owned: Number(row.is_owned) === 1,
    is_active: Number(row.is_active || 0) === 1,
    skill: safeJson(row.base_skill_json)
  }));
  return { pets, bonuses, gold: Number(kingdom?.gold || 0), max_level: MAX_PET_LEVEL };
}

async function unlockPet(env, kingdomId, body) {
  const petId = String(body.pet_id || "").trim();
  if (!/^[a-z0-9_]{3,64}$/.test(petId)) return reply({ error: "Mascote inválido." }, 400);

  const pet = await env.DB.prepare(
    "SELECT id,name,unlock_cost_gold FROM pet_catalog WHERE id=? AND active=1"
  ).bind(petId).first();
  if (!pet) return reply({ error: "Mascote não encontrado ou indisponível." }, 404);

  const owned = await env.DB.prepare(
    "SELECT 1 AS found FROM kingdom_pets WHERE kingdom_id=? AND pet_id=?"
  ).bind(kingdomId, petId).first();
  if (owned) return reply({ error: "Este mascote já pertence ao seu reino." }, 409);

  const cost = Math.max(0, Math.floor(Number(pet.unlock_cost_gold) || 0));
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE kingdoms SET gold=gold-?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=? AND gold>=? AND NOT EXISTS(" +
      "SELECT 1 FROM kingdom_pets WHERE kingdom_id=? AND pet_id=?) " +
      "AND EXISTS(SELECT 1 FROM pet_catalog WHERE id=? AND active=1 AND unlock_cost_gold=?)"
    ).bind(cost, kingdomId, cost, kingdomId, petId, petId, cost),
    env.DB.prepare(
      "INSERT INTO kingdom_pets(kingdom_id,pet_id,level,experience,is_active) " +
      "SELECT ?,?,1,0,0 WHERE changes()>0"
    ).bind(kingdomId, petId),
    env.DB.prepare(
      "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) " +
      "SELECT ?,'pet_unlocked',? WHERE changes()>0"
    ).bind(kingdomId, JSON.stringify({ pet_id: petId, gold_spent: cost }))
  ]);

  if (!result[1]?.meta?.changes) {
    const current = await env.DB.prepare(
      "SELECT gold FROM kingdoms WHERE id=?"
    ).bind(kingdomId).first();
    if (Number(current?.gold || 0) < cost) {
      return reply({ error: "Ouro insuficiente para desbloquear este mascote.", required: cost, available: Number(current?.gold || 0) }, 402);
    }
    return reply({ error: "Não foi possível desbloquear o mascote. Atualize e tente novamente." }, 409);
  }
  return reply({ success: true, pet_id: petId, message: pet.name + " foi desbloqueado." }, 201);
}

async function activatePet(env, kingdomId, body) {
  const petId = String(body.pet_id || "").trim();
  if (!/^[a-z0-9_]{3,64}$/.test(petId)) return reply({ error: "Mascote inválido." }, 400);

  const owned = await env.DB.prepare(
    "SELECT kp.pet_id FROM kingdom_pets kp JOIN pet_catalog pc ON pc.id=kp.pet_id WHERE kp.kingdom_id=? AND kp.pet_id=? AND pc.active=1"
  ).bind(kingdomId, petId).first();
  if (!owned) return reply({ error: "Desbloqueie este mascote antes de ativá-lo." }, 404);

  const result = await env.DB.batch([
    env.DB.prepare("UPDATE kingdom_pets SET is_active=0,updated_at=unixepoch() WHERE kingdom_id=? AND is_active=1 AND pet_id<>? AND EXISTS(SELECT 1 FROM kingdom_pets kp JOIN pet_catalog pc ON pc.id=kp.pet_id WHERE kp.kingdom_id=? AND kp.pet_id=? AND pc.active=1)").bind(kingdomId, petId, kingdomId, petId),
    env.DB.prepare("UPDATE kingdom_pets SET is_active=1,updated_at=unixepoch() WHERE kingdom_id=? AND pet_id=? AND is_active=0 AND EXISTS(SELECT 1 FROM pet_catalog WHERE id=? AND active=1)").bind(kingdomId, petId, petId),
    env.DB.prepare(
      "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) " +
      "SELECT ?,'pet_activated',? WHERE changes()>0"
    ).bind(kingdomId, JSON.stringify({ pet_id: petId }))
  ]);
  const bonuses = await getPetBonuses(env, kingdomId);
  if (!result[1]?.meta?.changes && bonuses.activePetId !== petId) return reply({ error: "Não foi possível ativar o mascote." }, 409);
  return reply({ success: true, replayed: !result[1]?.meta?.changes, pet_id: petId, bonuses });
}

async function existingFeed(env, kingdomId, requestKey) {
  return env.DB.prepare(
    "SELECT pet_id,food_amount,gold_spent,exp_gained,level_after,experience_after " +
    "FROM kingdom_pet_feed_requests WHERE kingdom_id=? AND request_key=?"
  ).bind(kingdomId, requestKey).first();
}

async function feedPet(env, kingdomId, body) {
  const petId = String(body.pet_id || "").trim();
  const amount = Number(body.food_amount);
  const requestKey = String(body.request_key || "").trim();
  if (!/^[a-z0-9_]{3,64}$/.test(petId) ||
      !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_FEED_AMOUNT) {
    return reply({ error: "Mascote ou quantidade de alimento inválidos." }, 400);
  }
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey)) {
    return reply({ error: "request_key obrigatório (16–80 caracteres) para impedir consumo duplicado." }, 400);
  }

  const repeated = await existingFeed(env, kingdomId, requestKey);
  if (repeated) {
    if (repeated.pet_id !== petId || Number(repeated.food_amount) !== amount) {
      return reply({ error: "request_key já utilizado em outra alimentação." }, 409);
    }
    return reply({
      success: true,
      replayed: true,
      pet_id: petId,
      gold_spent: Number(repeated.gold_spent),
      exp_gained: Number(repeated.exp_gained),
      level: Number(repeated.level_after),
      experience: Number(repeated.experience_after)
    });
  }

  const state = await env.DB.prepare(
    "SELECT kp.level,kp.experience,k.gold " +
    "FROM kingdom_pets kp JOIN kingdoms k ON k.id=kp.kingdom_id JOIN pet_catalog pc ON pc.id=kp.pet_id " +
    "WHERE kp.kingdom_id=? AND kp.pet_id=? AND pc.active=1"
  ).bind(kingdomId, petId).first();
  if (!state) return reply({ error: "Mascote não desbloqueado." }, 404);

  const goldCost = amount * 10;
  const expGained = amount * 5;
  if (Number(state.gold || 0) < goldCost) {
    return reply({ error: "Ouro insuficiente para alimentar o mascote.", required: goldCost, available: Number(state.gold || 0) }, 402);
  }
  const currentLevel = Number(state.level);
  const currentExperience = Number(state.experience);
  const next = calculatePetProgress(currentLevel, currentExperience, expGained);

  const result = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO kingdom_pet_feed_requests(" +
      "kingdom_id,request_key,pet_id,food_amount,gold_spent,exp_gained,level_after,experience_after) " +
      "SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(" +
      "SELECT 1 FROM kingdom_pet_feed_requests WHERE kingdom_id=? AND request_key=?) " +
      "AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND gold>=?) " +
      "AND EXISTS(SELECT 1 FROM kingdom_pets kp JOIN pet_catalog pc ON pc.id=kp.pet_id WHERE kp.kingdom_id=? AND kp.pet_id=? AND kp.level=? AND kp.experience=? AND pc.active=1)"
    ).bind(
      kingdomId, requestKey, petId, amount, goldCost, expGained, next.level, next.experience,
      kingdomId, requestKey, kingdomId, goldCost, kingdomId, petId, currentLevel, currentExperience
    ),
    env.DB.prepare(
      "UPDATE kingdoms SET gold=gold-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND gold>=? AND changes()>0"
    ).bind(goldCost, kingdomId, goldCost),
    env.DB.prepare(
      "UPDATE kingdom_pets SET level=?,experience=?,updated_at=unixepoch() " +
      "WHERE kingdom_id=? AND pet_id=? AND level=? AND experience=? AND changes()>0"
    ).bind(next.level, next.experience, kingdomId, petId, currentLevel, currentExperience),
    env.DB.prepare(
      "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) " +
      "SELECT ?,'pet_fed',? WHERE changes()>0"
    ).bind(kingdomId, JSON.stringify({ pet_id: petId, food_amount: amount, gold_spent: goldCost, exp_gained: expGained }))
  ]);

  if (!result[0]?.meta?.changes || !result[1]?.meta?.changes || !result[2]?.meta?.changes) {
    const after = await existingFeed(env, kingdomId, requestKey);
    if (after && after.pet_id === petId && Number(after.food_amount) === amount) {
      return reply({
        success: true, replayed: true, pet_id: petId,
        gold_spent: Number(after.gold_spent), exp_gained: Number(after.exp_gained),
        level: Number(after.level_after), experience: Number(after.experience_after)
      });
    }
    const latest = await env.DB.prepare("SELECT gold FROM kingdoms WHERE id=?").bind(kingdomId).first();
    if (Number(latest?.gold || 0) < goldCost) {
      return reply({ error: "Ouro insuficiente para alimentar o mascote.", required: goldCost, available: Number(latest?.gold || 0) }, 402);
    }
    return reply({ error: "O mascote foi atualizado por outra ação. Atualize e tente novamente." }, 409);
  }

  return reply({
    success: true,
    replayed: false,
    pet_id: petId,
    gold_spent: goldCost,
    exp_gained: expGained,
    level: next.level,
    experience: next.experience,
    bonuses: await getPetBonuses(env, kingdomId)
  }, 200);
}

export async function handlePetsRoute(request, env, publicPlayerId, path, body = {}) {
  if (!env?.DB) return reply({ error: "Banco D1 indisponível." }, 503);
  try {
    const kingdomId = await kingdomForPlayer(env, publicPlayerId);
    if (!kingdomId) return reply({ error: "Reino não encontrado." }, 404);

    if (request.method === "GET" && path === "catalog") {
      return reply(await getPetsState(env, kingdomId));
    }
    if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
    if (path === "unlock") return await unlockPet(env, kingdomId, body);
    if (path === "feed") return await feedPet(env, kingdomId, body);
    if (path === "activate") return await activatePet(env, kingdomId, body);
    return reply({ error: "Rota de mascotes inválida." }, 404);
  } catch (error) {
    console.error("pets_request_failed", String(error?.message || error));
    return reply({ error: "Não foi possível processar a operação de mascotes." }, 500);
  }
}
