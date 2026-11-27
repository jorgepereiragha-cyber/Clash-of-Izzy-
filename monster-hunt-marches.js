import { evaluateMonsterHunt, HUNT_ENERGY_MAX, HUNT_RULES } from "./monster-hunt-policy.js";
import { respawnDueMonsters } from "./world-monsters.js";

const eligibilityErrors = {
  HUNT_LEVEL_LOCKED: "Derrote uma criatura do nível anterior para liberar este alvo.",
  INSUFFICIENT_ENERGY: "Energia de caça insuficiente.",
};

export async function dispatchMonsterHunt(env, { kingdomId, region, playerId, monsterId, generation, requestId, unitsJson, unitCount, maxSlots, damage, startedAt, arrivesAt }) {
  const db = env.DB;
  const key = `${kingdomId}:${requestId.toLowerCase()}`;
  const existing = async () => {
    const row = await db.prepare(`SELECT h.monster_id,h.generation,m.units_json FROM monster_hunt_marches h
      JOIN marches m ON m.id=h.march_id WHERE h.dispatch_key=?`).bind(key).first();
    if (!row) return null;
    return row.monster_id===monsterId&&row.generation===generation&&row.units_json===unitsJson
      ? { ok: true } : { status: 409, error: "Esta identificação já foi usada para outra expedição." };
  };
  const replay = await existing();
  if (replay) return replay;

  const now = Math.floor(Date.parse(startedAt) / 1000);
  await respawnDueMonsters(env, region, now);
  const [targets, progress] = await db.batch([
    db.prepare("SELECT * FROM world_monsters WHERE id=? AND map_region=?").bind(monsterId, region),
    db.prepare("SELECT energy,updated_at,revision,cleared_level FROM monster_hunt_progress WHERE kingdom_id=?").bind(kingdomId),
  ]);
  const target = targets.results[0];
  const prior = progress.results[0];
  if (!target) return { status: 404, error: "Criatura não encontrada neste mundo." };
  if (target.generation !== generation) return { status: 409, error: "A criatura reapareceu. Selecione-a novamente." };
  const hunt = evaluateMonsterHunt({ monster: target, kingdomRegion: region, clearedLevel: prior?.cleared_level, energyRow: prior, now });
  if (!hunt.ok) return { status: 409, error: eligibilityErrors[hunt.code] || "Criatura indisponível para caça." };

  // A precondição de versão vincula o gasto de energia ao mesmo lote do destacamento.
  const result = await db.batch([
    db.prepare(`UPDATE army_units SET quantity=quantity-CAST((SELECT value FROM json_each(?) WHERE key=unit_type) AS INTEGER)
      WHERE kingdom_id=? AND tier=1 AND unit_type IN (SELECT key FROM json_each(?))
      AND (SELECT COUNT(*) FROM json_each(?) requested JOIN army_units available
        ON available.kingdom_id=? AND available.tier=1 AND available.unit_type=requested.key
        WHERE available.quantity>=CAST(requested.value AS INTEGER))=?
      AND (SELECT COUNT(*) FROM marches WHERE kingdom_id=? AND status='marching')<?
      AND COALESCE((SELECT revision FROM monster_hunt_progress WHERE kingdom_id=?),-1)=?
      AND EXISTS(SELECT 1 FROM world_monsters w JOIN kingdoms k ON k.id=?
        WHERE w.id=? AND w.map_region=k.map_region AND w.generation=? AND w.hp>0 AND w.respawn_at=0)
      AND NOT EXISTS(SELECT 1 FROM monster_hunt_marches WHERE dispatch_key=?)
      AND NOT EXISTS(SELECT 1 FROM monster_hunt_marches h JOIN marches m ON m.id=h.march_id
        WHERE m.kingdom_id=? AND m.status='marching' AND h.monster_id=? AND h.generation=?)`)
      .bind(unitsJson, kingdomId, unitsJson, unitsJson, kingdomId, unitCount, kingdomId, maxSlots,
        kingdomId, prior?.revision ?? -1, kingdomId, monsterId, generation, key, kingdomId, monsterId, generation),
    db.prepare(`INSERT INTO marches(kingdom_id,march_type,units_json,status,started_at,arrives_at)
      SELECT ?,'attack',?,'marching',?,? WHERE changes()=?`).bind(kingdomId, unitsJson, startedAt, arrivesAt, unitCount),
    db.prepare(`INSERT INTO monster_hunt_marches(march_id,dispatch_key,monster_id,generation,level,damage,energy_cost)
      SELECT last_insert_rowid(),?,?,?,?,?,? WHERE changes()=1`)
      .bind(key, monsterId, generation, hunt.level, damage, hunt.energyCost),
    db.prepare(`INSERT INTO monster_hunt_progress(kingdom_id,energy,updated_at,revision)
      SELECT ?,?,?,1 WHERE changes()=1 ON CONFLICT(kingdom_id) DO UPDATE SET
        energy=excluded.energy,updated_at=excluded.updated_at,revision=monster_hunt_progress.revision+1`)
      .bind(kingdomId, hunt.energyAfter, hunt.energyUpdatedAt),
    db.prepare(`INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json)
      SELECT ?,?,'march_started',json_object('marchType','hunt','monsterId',?,'generation',?) WHERE changes()=1`)
      .bind(kingdomId, playerId, monsterId, generation),
  ]);
  if (result[2]?.meta?.changes) return { ok: true };
  return await existing() || { status: 409, error: "A caça não pôde partir. Verifique as tropas, filas, energia e disponibilidade da criatura." };
}

export function monsterHuntSettlement(db, march, { kingdomId, token, resolvedAt, guard }) {
  const { id, monster_id: monsterId, hunt_level: level } = march;
  const { rewardFood, rewardWood, respawnSeconds } = HUNT_RULES[level];
  const claimed = [id, kingdomId, token];
  const outcome = "(SELECT outcome FROM monster_hunt_marches WHERE march_id=?)";
  const won = `${outcome}='victory' AND ${guard}`;
  return [
    // Classifica usando o PV da geração atual dentro da mesma transação que aplica o dano.
    db.prepare(`UPDATE monster_hunt_marches SET (outcome,damage_dealt)=(SELECT
      CASE WHEN w.id IS NULL THEN 'unavailable' WHEN w.hp<=damage THEN 'victory' ELSE 'wounded' END,
      COALESCE(MIN(w.hp,damage),0) FROM kingdoms k LEFT JOIN world_monsters w
      ON w.id=monster_id AND w.generation=monster_hunt_marches.generation AND w.map_region=k.map_region
      AND w.hp>0 AND w.respawn_at=0 WHERE k.id=?) WHERE march_id=? AND ${guard}`)
      .bind(kingdomId, id, ...claimed),
    db.prepare(`UPDATE world_monsters SET hp=hp-(SELECT damage_dealt FROM monster_hunt_marches WHERE march_id=?),
      respawn_at=CASE WHEN ${outcome}='victory' THEN ? ELSE 0 END
      WHERE id=? AND ${outcome} IN ('victory','wounded') AND ${guard}`)
      .bind(id, id, Math.floor(Date.parse(resolvedAt) / 1000) + respawnSeconds, monsterId, id, ...claimed),
    db.prepare(`UPDATE monster_hunt_progress SET cleared_level=MAX(cleared_level,?),revision=revision+1
      WHERE kingdom_id=? AND ${won}`).bind(level, kingdomId, id, ...claimed),
    db.prepare(`UPDATE monster_hunt_progress SET energy=MIN(?,energy+(SELECT energy_cost FROM monster_hunt_marches WHERE march_id=?)),
      revision=revision+1 WHERE kingdom_id=? AND ${outcome}='unavailable' AND ${guard}`)
      .bind(HUNT_ENERGY_MAX, id, kingdomId, id, ...claimed),
    db.prepare(`UPDATE kingdoms SET food=food+?,wood=wood+? WHERE id=? AND ${won}`)
      .bind(rewardFood, rewardWood, kingdomId, id, ...claimed),
    db.prepare(`INSERT INTO resource_ledger(kingdom_id,resource,amount,reason)
      SELECT ?,'food',?,'caça de Eldoria' WHERE ${won} UNION ALL
      SELECT ?,'wood',?,'caça de Eldoria' WHERE ${won}`)
      .bind(kingdomId, rewardFood, id, ...claimed, kingdomId, rewardWood, id, ...claimed),
  ];
}
