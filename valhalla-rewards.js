import { getValhallaConfig } from "./valhalla-config.js";

const ACTIVE_KINGDOM_PAGE_SIZE = 10;
const D1_BATCH_KINGDOM_SIZE = 10;

/**
 * Daily runes are granted only to kingdoms whose player opened the kingdom UI
 * in the last 24 hours. The existing analytics event is the real activity
 * signal; no speculative last_login/is_banned columns are assumed.
 *
 * valhalla_daily_rewards is the once-per-UTC-day guard. The following balance
 * update and ledger insert are chained with SQLite changes() inside one D1
 * batch, so retries cannot credit runes twice.
 */
export async function distributeValhallaDailyRunes(env, now = new Date()) {
  if (!env?.DB) throw new Error("Banco D1 indisponível para distribuir Runas do Destino.");

  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new TypeError("Horário do Cron inválido.");

  const config = await getValhallaConfig(env, instant.getTime());
  const rewardDate = instant.toISOString().slice(0, 10);
  if (!config.active || config.dailyRunesReward <= 0) {
    return { active: false, rewardDate, eligible: 0, granted: 0 };
  }

  const cutoff = new Date(instant.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const nowSeconds = Math.floor(instant.getTime() / 1000);
  let eligible = 0;
  let granted = 0;
  let pagesProcessed = 0;
  const maxPagesPerScheduledRun = 1;

  while (pagesProcessed < maxPagesPerScheduledRun) {
    const candidates = await env.DB.prepare(
      "SELECT k.id " +
      "FROM kingdoms k " +
      "WHERE EXISTS (" +
        "SELECT 1 FROM analytics_events ae " +
        "WHERE ae.player_id=k.player_id " +
          "AND ae.event='kingdom.opened' " +
          "AND datetime(ae.created_at)>=datetime(?)" +
      ") " +
      "AND NOT EXISTS (" +
        "SELECT 1 FROM valhalla_daily_rewards dr " +
        "WHERE dr.kingdom_id=k.id AND dr.reward_date=?" +
      ") " +
      "ORDER BY k.id LIMIT ?"
    ).bind(cutoff, rewardDate, ACTIVE_KINGDOM_PAGE_SIZE).all();

    const kingdomIds = (candidates.results || []).map(row => Number(row.id)).filter(id => Number.isSafeInteger(id) && id > 0);
    if (!kingdomIds.length) break;
    eligible += kingdomIds.length;

    for (let offset = 0; offset < kingdomIds.length; offset += D1_BATCH_KINGDOM_SIZE) {
      const page = kingdomIds.slice(offset, offset + D1_BATCH_KINGDOM_SIZE);
      const statements = [];

      for (const kingdomId of page) {
        const idempotencyKey = "valhalla-daily:" + rewardDate + ":" + kingdomId;
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO valhalla_daily_rewards(kingdom_id,reward_date,rune_amount) " +
            "SELECT ?,?,? " +
            "WHERE EXISTS(SELECT 1 FROM game_config WHERE key='valhalla_mode_active' AND value='1') " +
            "AND CAST(COALESCE((SELECT value FROM game_config WHERE key='valhalla_start_time'),'0') AS INTEGER)<=? " +
            "AND (CAST(COALESCE((SELECT value FROM game_config WHERE key='valhalla_end_time'),'0') AS INTEGER)=0 " +
              "OR CAST((SELECT value FROM game_config WHERE key='valhalla_end_time') AS INTEGER)>?)"
          ).bind(kingdomId, rewardDate, config.dailyRunesReward, nowSeconds, nowSeconds)
        );
        statements.push(
          env.DB.prepare(
            "UPDATE kingdoms SET destiny_runes=destiny_runes+? " +
            "WHERE id=? AND changes()>0"
          ).bind(config.dailyRunesReward, kingdomId)
        );
        statements.push(
          env.DB.prepare(
            "INSERT INTO valhalla_rune_ledger(kingdom_id,entry_type,reason,amount,idempotency_key,metadata_json) " +
            "SELECT ?,'credit','daily_reward',?,?,json_object('reward_date',?) WHERE changes()>0"
          ).bind(kingdomId, config.dailyRunesReward, idempotencyKey, rewardDate)
        );
      }

      const results = await env.DB.batch(statements);
      for (let index = 2; index < results.length; index += 3) {
        if (results[index]?.meta?.changes) granted++;
      }

      // If Valhalla was switched off during a run, the guarded inserts make no
      // changes. Stop instead of repeatedly selecting the same eligible users.
      const inserted = results.filter((result, index) => index % 3 === 0 && result?.meta?.changes).length;
      if (inserted === 0) return { active: true, rewardDate, eligible, granted };
    }
    pagesProcessed += 1;
  }

  return { active: true, rewardDate, eligible, granted };
}
