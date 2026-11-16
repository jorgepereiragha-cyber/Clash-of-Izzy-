// Leitura autenticada dos replays detalhados armazenados em battle_reports.
function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ""); } catch { return fallback; }
}

export async function getBattleReplay(env, publicPlayerId, rawBattleId) {
  const battleId = Number(rawBattleId);
  if (!Number.isSafeInteger(battleId) || battleId < 1) {
    return reply({ error: "Identificador de batalha inválido." }, 400);
  }

  const row = await env.DB.prepare(
    "SELECT br.id,br.battle_type,br.attacker_power,br.defender_power,br.losses_json,br.wounded_json,br.wall_damage,br.rewards_json," +
    "br.battle_log,br.replay_json,br.replay_expires_at,br.created_at," +
    "ak.kingdom_name AS attacker_name,dk.kingdom_name AS defender_name " +
    "FROM battle_reports br " +
    "JOIN players p ON p.player_id=? " +
    "JOIN kingdoms mine ON mine.player_id=p.id " +
    "LEFT JOIN kingdoms ak ON ak.id=br.attacker_kingdom_id " +
    "LEFT JOIN kingdoms dk ON dk.id=br.defender_kingdom_id " +
    "WHERE br.id=? AND (br.attacker_kingdom_id=mine.id OR br.defender_kingdom_id=mine.id) " +
    "AND br.replay_expires_at>unixepoch() AND br.replay_json<>'{}' LIMIT 1"
  ).bind(publicPlayerId, battleId).first();

  if (!row) {
    return reply({ error: "Replay não encontrado, expirado ou sem permissão de acesso." }, 404);
  }

  const replay = parseJson(row.replay_json, null);
  if (!replay || typeof replay !== "object" || Array.isArray(replay)) {
    return reply({ error: "Replay indisponível ou inválido." }, 410);
  }

  return reply({
    battle_id: row.id,
    battle_type: row.battle_type,
    created_at: row.created_at,
    expires_at: Number(row.replay_expires_at),
    participants: { attacker: row.attacker_name || "Reino atacante", defender: row.defender_name || "Alvo PvE" },
    result: {
      attacker_power: Number(row.attacker_power || 0),
      defender_power: Number(row.defender_power || 0),
      losses: parseJson(row.losses_json, {}),
      wounded: parseJson(row.wounded_json, {}),
      wall_damage: Number(row.wall_damage || 0),
      rewards: parseJson(row.rewards_json, {})
    },
    replay,
    log: parseJson(row.battle_log, [])
  });
}
