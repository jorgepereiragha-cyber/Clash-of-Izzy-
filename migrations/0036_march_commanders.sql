-- March leadership is a different limit from total army/training capacity.
-- Preserve all existing marches and backfill no commander on historical records.
PRAGMA foreign_keys=ON;
ALTER TABLE marches ADD COLUMN commander_hero_key TEXT;
ALTER TABLE marches ADD COLUMN march_capacity_at_dispatch INTEGER NOT NULL DEFAULT 0
 CHECK(march_capacity_at_dispatch>=0);
CREATE INDEX IF NOT EXISTS idx_marches_kingdom_commander
 ON marches(kingdom_id,commander_hero_key,status);
CREATE INDEX IF NOT EXISTS idx_marches_kingdom_status_arrival
 ON marches(kingdom_id,status,arrives_at);
