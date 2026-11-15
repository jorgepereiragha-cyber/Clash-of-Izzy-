-- Equipamentos persistentes por reino; níveis e custos são validados pelo Worker.
CREATE TABLE IF NOT EXISTS kingdom_equipment (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kingdom_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_kingdom_equipment_kingdom ON kingdom_equipment(kingdom_id);
