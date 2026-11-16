-- Clash of Izzy 0026: relatórios completos e índices de resolução PvP.
PRAGMA foreign_keys = ON;

ALTER TABLE battle_reports
  ADD COLUMN wall_damage INTEGER NOT NULL DEFAULT 0 CHECK (wall_damage >= 0);
ALTER TABLE battle_reports
  ADD COLUMN wounded_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(wounded_json));

CREATE INDEX IF NOT EXISTS idx_battle_reports_defender_created
  ON battle_reports(defender_kingdom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marches_due_status_arrival
  ON marches(status, arrives_at, kingdom_id);
CREATE INDEX IF NOT EXISTS idx_army_units_kingdom_quantity
  ON army_units(kingdom_id, quantity, unit_type, tier);
