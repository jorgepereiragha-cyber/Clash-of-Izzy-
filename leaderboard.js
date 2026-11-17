const ALLOWED_TYPES = new Set(["kingdoms", "alliances"]);
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MAX_PAGE = 2000;

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function handleLeaderboardRoute(request, env, { json, rateLimitDecision }) {
  if (request.method !== "GET") {
    return json({ error: "Método não permitido." }, 405, { Allow: "GET" });
  }

  const url = new URL(request.url);
  const type = String(url.searchParams.get("type") || "kingdoms").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    return json({ error: "Categoria de ranking inválida.", allowed: [...ALLOWED_TYPES] }, 400);
  }

  const limit = boundedInteger(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const page = boundedInteger(url.searchParams.get("page"), 1, 1, MAX_PAGE);
  const offset = (page - 1) * limit;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limited = await rateLimitDecision(env, "leaderboard-public-ip", ip, 120, 60);
  if (limited) return limited;

  try {
    let countQuery;
    let rowsQuery;
    if (type === "kingdoms") {
      countQuery = env.DB.prepare("SELECT COUNT(*) AS total FROM kingdoms");
      rowsQuery = env.DB.prepare(
        "SELECT COALESCE(NULLIF(n.nickname,''),NULLIF(p.name,''),'Comandante') AS commander_name," +
        "k.kingdom_name,k.castle_level,k.power,COALESCE(a.tag,'') AS alliance_tag,k.updated_at " +
        "FROM kingdoms k JOIN players p ON p.id=k.player_id " +
        "LEFT JOIN player_nicknames n ON n.player_id=p.id " +
        "LEFT JOIN alliance_members am ON am.kingdom_id=k.id " +
        "LEFT JOIN alliances a ON a.id=am.alliance_id " +
        "ORDER BY k.power DESC,k.castle_level DESC,k.updated_at ASC,k.id ASC LIMIT ? OFFSET ?"
      ).bind(limit, offset);
    } else {
      countQuery = env.DB.prepare(
        "SELECT COUNT(*) AS total FROM alliances a " +
        "WHERE EXISTS(SELECT 1 FROM alliance_members am WHERE am.alliance_id=a.id)"
      );
      rowsQuery = env.DB.prepare(
        "SELECT a.name,a.tag,a.level,a.xp,COUNT(DISTINCT am.kingdom_id) AS member_count," +
        "COALESCE(SUM(k.power),0) AS total_power,a.territory_count " +
        "FROM alliances a LEFT JOIN alliance_members am ON am.alliance_id=a.id " +
        "LEFT JOIN kingdoms k ON k.id=am.kingdom_id " +
        "WHERE EXISTS(SELECT 1 FROM alliance_members active WHERE active.alliance_id=a.id) " +
        "GROUP BY a.id,a.name,a.tag,a.level,a.xp,a.territory_count " +
        "ORDER BY total_power DESC,a.level DESC,a.xp DESC,a.name COLLATE NOCASE ASC LIMIT ? OFFSET ?"
      ).bind(limit, offset);
    }

    const [count, rows] = await Promise.all([countQuery.first(), rowsQuery.all()]);
    const total = Math.max(0, Number(count?.total) || 0);
    const results = (rows.results || []).map((row, index) => type === "kingdoms" ? {
      rank: offset + index + 1,
      commander: String(row.commander_name || "Comandante"),
      kingdom: String(row.kingdom_name || "Reino sem nome"),
      castleLevel: Math.max(1, Number(row.castle_level) || 1),
      power: Math.max(0, Number(row.power) || 0),
      allianceTag: String(row.alliance_tag || "")
    } : {
      rank: offset + index + 1,
      name: String(row.name || "Aliança sem nome"),
      tag: String(row.tag || ""),
      level: Math.max(1, Number(row.level) || 1),
      experience: Math.max(0, Number(row.xp) || 0),
      members: Math.max(0, Number(row.member_count) || 0),
      power: Math.max(0, Number(row.total_power) || 0),
      territories: Math.max(0, Number(row.territory_count) || 0)
    });

    return json({
      type,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      results
    });
  } catch (error) {
    console.error("public_leaderboard_failed", String(error?.message || error));
    return json({ error: "Ranking temporariamente indisponível. Tente novamente." }, 503);
  }
}
