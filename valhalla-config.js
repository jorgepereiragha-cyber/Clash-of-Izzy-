const CONFIG_KEYS = [
  "valhalla_mode_active",
  "valhalla_resource_multiplier",
  "valhalla_speed_multiplier",
  "valhalla_start_time",
  "valhalla_end_time",
  "valhalla_daily_runes_reward",
];

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bounded(value, fallback, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finiteNumber(value, fallback)));
}

/**
 * Converts the D1 key/value rows into a validated seasonal configuration.
 * Configured multipliers remain visible to clients while inactive, but the
 * runtime helper below returns identity multipliers until the event is live.
 */
export function normalizeValhallaConfigRows(rows = [], now = Date.now()) {
  const values = new Map((Array.isArray(rows) ? rows : []).map(row => [
    String(row?.key || ""),
    String(row?.value ?? ""),
  ]));

  const startTime = Math.max(0, Math.floor(bounded(values.get("valhalla_start_time"), 0, 0, 4102444800)));
  const endTime = Math.max(0, Math.floor(bounded(values.get("valhalla_end_time"), 0, 0, 4102444800)));
  const currentSeconds = Math.floor(now / 1000);
  const configuredActive = values.get("valhalla_mode_active") === "1";
  const withinStart = startTime === 0 || currentSeconds >= startTime;
  const beforeEnd = endTime === 0 || currentSeconds < endTime;
  const resourceMultiplier = bounded(values.get("valhalla_resource_multiplier"), 5, 1, 20);
  const speedMultiplier = bounded(values.get("valhalla_speed_multiplier"), 0.2, 0.05, 1);
  const dailyRunesReward = Math.floor(bounded(values.get("valhalla_daily_runes_reward"), 100, 1, 100000));

  return {
    active: configuredActive && withinStart && beforeEnd,
    resourceMultiplier,
    speedMultiplier,
    startTime,
    endTime,
    dailyRunesReward,
  };
}

export async function getValhallaConfig(env, now = Date.now()) {
  if (!env?.DB) throw new Error("Banco D1 indisponível para ler a configuração de Valhalla.");
  const rows = await env.DB.prepare(
    "SELECT key,value FROM game_config WHERE key IN (" +
      CONFIG_KEYS.map(() => "?").join(",") +
    ")"
  ).bind(...CONFIG_KEYS).all();
  return normalizeValhallaConfigRows(rows.results || [], now);
}

/** Effective multipliers for server-side game calculations. */
export async function getValhallaMultipliers(env, now = Date.now()) {
  const config = await getValhallaConfig(env, now);
  return {
    active: config.active,
    resource: config.active ? config.resourceMultiplier : 1,
    speed: config.active ? config.speedMultiplier : 1,
  };
}

/** Scale only newly created queues; already-running queues keep their deadline. */
export function scaleValhallaDurationSeconds(baseSeconds, multipliers) {
  const base = Math.max(1, Math.floor(finiteNumber(baseSeconds, 1)));
  if (!multipliers?.active) return base;
  const speed = bounded(multipliers.speed, 1, 0.05, 1);
  return Math.max(10, Math.floor(base * speed));
}

export async function handleValhallaConfig(_request, env) {
  try {
    const config = await getValhallaConfig(env);
    return new Response(JSON.stringify(config), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[VALHALLA CONFIG ERROR]", String(error?.message || error));
    return new Response(JSON.stringify({ error: "Erro ao carregar configurações de Valhalla." }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
