-- Persistência de produção e dragão inicial do reino.
ALTER TABLE kingdoms ADD COLUMN last_production_at TEXT;

CREATE TABLE IF NOT EXISTS dragons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL UNIQUE REFERENCES kingdoms(id) ON DELETE CASCADE,
  dragon_key TEXT NOT NULL DEFAULT 'ember_wyrm',
  dragon_name TEXT NOT NULL DEFAULT 'Brasa',
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  experience INTEGER NOT NULL DEFAULT 0,
  bond INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
