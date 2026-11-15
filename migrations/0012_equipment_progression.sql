-- Equipment progression: kingdom-owned gear and equipped slots.
-- Research levels reuse the existing research table to avoid a parallel progression store.
CREATE TABLE IF NOT EXISTS kingdom_equipment (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  PRIMARY KEY (kingdom_id, item_key)
);

CREATE TABLE IF NOT EXISTS equipped_kingdom_equipment (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('weapon','helmet','armor','boots','accessory')),
  item_key TEXT NOT NULL,
  equipped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kingdom_id, slot),
  FOREIGN KEY (kingdom_id, item_key)
    REFERENCES kingdom_equipment(kingdom_id, item_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kingdom_equipment_owner
  ON kingdom_equipment(kingdom_id, item_key);
