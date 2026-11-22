-- 0041 - expansão 4X aditiva. NÃO renomear migrações legadas nem alterar dados históricos.
-- As posições legadas continuam em kingdom_buildings.position_x/position_z (grid [-25,25)).
-- A feature flag GAME_4X_SYSTEMS_ENABLED deve ficar desligada até aplicação/validação em staging.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS intermediate_resources (
  kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
  wheat INTEGER NOT NULL DEFAULT 0 CHECK(wheat BETWEEN 0 AND 100000),
  flour INTEGER NOT NULL DEFAULT 0 CHECK(flour BETWEEN 0 AND 100000),
  mill_level INTEGER NOT NULL DEFAULT 1 CHECK(mill_level BETWEEN 1 AND 30),
  bakery_level INTEGER NOT NULL DEFAULT 1 CHECK(bakery_level BETWEEN 1 AND 30),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS city_defenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  defense_type TEXT NOT NULL CHECK(defense_type IN ('tower','trap','gate')),
  grid_x INTEGER NOT NULL CHECK(grid_x BETWEEN -25 AND 24),
  grid_z INTEGER NOT NULL CHECK(grid_z BETWEEN -25 AND 24),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 5),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 5),
  level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 30),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(grid_x+width<=25 AND grid_z+height<=25)
);
CREATE INDEX IF NOT EXISTS idx_city_defenses_grid ON city_defenses(kingdom_id,grid_x,grid_z);
CREATE INDEX IF NOT EXISTS idx_city_defenses_kind ON city_defenses(kingdom_id,defense_type);

-- Progressão de jogador é ortogonal a kingdoms.castle_level e kingdoms.prestige (VIP 1-7).
-- XP só é escrito pelo servidor após fila de jogo concluída com token de conclusão.
CREATE TABLE IF NOT EXISTS kingdom_progression (
  kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 100000000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS progression_xp_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  xp INTEGER NOT NULL CHECK(xp BETWEEN 1 AND 10000),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kingdom_id,source_key)
);
CREATE INDEX IF NOT EXISTS idx_progression_xp_ledger_recent ON progression_xp_ledger(kingdom_id,id DESC);
