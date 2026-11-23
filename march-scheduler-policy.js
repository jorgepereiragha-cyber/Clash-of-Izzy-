// Bounded fair-ish scheduled march progression for the isolated beta.
// Sort realms by their oldest outstanding due march; keep the D1/CPU budget small.
// The combat settlement remains in worker.js and retains its atomic D1.batch guards.
export const MAX_DUE_KINGDOMS_PER_TICK = 4;
export const MAX_DUE_MARCHES_PER_KINGDOM = 2;

export const DUE_MARCH_KINGDOMS_SQL =
  "SELECT kingdom_id FROM marches WHERE status='marching' AND arrives_at<=? " +
  "GROUP BY kingdom_id ORDER BY MIN(arrives_at), kingdom_id LIMIT ?";

export async function resolveDueMarchKingdoms({
  db, now, resolveKingdom, onFailure = () => {},
  realmLimit = MAX_DUE_KINGDOMS_PER_TICK,
  marchLimit = MAX_DUE_MARCHES_PER_KINGDOM,
} = {}) {
  if (!db || typeof resolveKingdom !== "function") {
    throw new Error("Missing scheduler database or settlement handler");
  }
  const maxRealms = Math.max(1, Math.min(MAX_DUE_KINGDOMS_PER_TICK,
    Math.floor(Number(realmLimit) || 1)));
  const maxMarches = Math.max(1, Math.min(MAX_DUE_MARCHES_PER_KINGDOM,
    Math.floor(Number(marchLimit) || 1)));
  const queryAt = typeof now === "string" && Number.isFinite(Date.parse(now))
    ? now : new Date().toISOString();
  const due = await db.prepare(DUE_MARCH_KINGDOMS_SQL).bind(queryAt, maxRealms).all();
  let completed = 0, failed = 0;
  // Diagnostic failures must never prevent other due kingdoms from settling.
  const reportFailure = async (id, error) => {
    try { await onFailure(id, error); }
    catch { console.warn("Beta march failure reporter failed; continuing tick"); }
  };
  for (const row of (due.results || []).slice(0, maxRealms)) {
    const id = Number(row.kingdom_id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      failed++;
      await reportFailure(row.kingdom_id, new Error("Invalid realm identifier"));
      continue;
    }
    try {
      await resolveKingdom(id, maxMarches);
      completed++;
    } catch (error) {
      failed++;
      await reportFailure(id, error);
      // Never let one realm with failing state block the others this tick.
    }
  }
  return { selected: completed + failed, completed, failed };
}
