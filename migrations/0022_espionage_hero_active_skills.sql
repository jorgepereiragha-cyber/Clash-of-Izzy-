-- Clash of Izzy 0022: espionagem real e habilidades ativas de heróis.
-- Migration aditiva: reutiliza marches.scout, hero_inventory e o token de jogo existente.
PRAGMA foreign_keys = ON;
ALTER TABLE marches ADD COLUMN hero_key TEXT;
ALTER TABLE marches ADD COLUMN hero_skill_key TEXT;

CREATE TABLE IF NOT EXISTS hero_skill_cooldowns (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  hero_key TEXT NOT NULL,
  skill_key TEXT NOT NULL,
  cooldown_until INTEGER NOT NULL CHECK (cooldown_until >= 0),
  last_used_at INTEGER NOT NULL DEFAULT (unixepoch()),
  use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count >= 1),
  PRIMARY KEY (kingdom_id, hero_key)
);
CREATE INDEX IF NOT EXISTS idx_hero_skill_cooldowns_ready
  ON hero_skill_cooldowns(kingdom_id, cooldown_until);

CREATE TABLE IF NOT EXISTS spy_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  target_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
  target_territory_id INTEGER REFERENCES world_territories(id) ON DELETE SET NULL,
  march_id INTEGER NOT NULL UNIQUE REFERENCES marches(id) ON DELETE CASCADE,
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_spy_reports_owner_expiry
  ON spy_reports(kingdom_id, expires_at, id DESC);
CREATE INDEX IF NOT EXISTS idx_spy_reports_target
  ON spy_reports(target_kingdom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marches_hero_skill
  ON marches(kingdom_id, hero_key, hero_skill_key, status);
