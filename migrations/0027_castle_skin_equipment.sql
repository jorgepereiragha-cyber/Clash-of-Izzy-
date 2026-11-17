-- Clash of Izzy 0027: persist the currently equipped paid castle skin.
-- Ownership remains in player_skins; this nullable column stores only the selected appearance.
PRAGMA foreign_keys = ON;

ALTER TABLE kingdoms ADD COLUMN equipped_skin_id INTEGER REFERENCES skins(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kingdoms_equipped_skin ON kingdoms(equipped_skin_id);
