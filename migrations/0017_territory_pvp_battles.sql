-- Snapshot the territory owner when an attack march is launched so
-- a territory transfer before arrival cannot redirect a stale army.
ALTER TABLE marches
  ADD COLUMN target_owner_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL;

-- Serialize battles aimed at the same territory. Expiring locks recover safely
-- if a Worker execution is interrupted before its D1 batch commits.
ALTER TABLE world_territories ADD COLUMN combat_lock_token TEXT;
ALTER TABLE world_territories ADD COLUMN combat_lock_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_territory_combat_lock
  ON world_territories(combat_lock_expires_at, id);
CREATE INDEX IF NOT EXISTS idx_marches_target_owner
  ON marches(target_owner_kingdom_id, status, arrives_at);

-- Independent expiring kingdom locks serialize PvP with PvE and world-event battles.
-- battle_token is a persistent optimistic-concurrency nonce, not a busy flag.
ALTER TABLE kingdoms ADD COLUMN battle_lock_token TEXT;
ALTER TABLE kingdoms ADD COLUMN battle_lock_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_kingdom_battle_lock
  ON kingdoms(battle_lock_expires_at, id);
