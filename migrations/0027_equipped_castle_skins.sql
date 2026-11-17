-- Clash of Izzy 0027: persist the castle appearance selected by each owner.
-- player_skins remains the only ownership ledger; this column stores selection only.
PRAGMA foreign_keys = ON;

ALTER TABLE kingdoms
  ADD COLUMN equipped_skin_id INTEGER REFERENCES skins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kingdoms_equipped_skin
  ON kingdoms(equipped_skin_id)
  WHERE equipped_skin_id IS NOT NULL;
