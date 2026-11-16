-- Visual preferences and bounded battle VFX records.
-- Player IDs intentionally reference the internal INTEGER players.id.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS player_visual_settings (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  particles_enabled INTEGER NOT NULL DEFAULT 1 CHECK (particles_enabled IN (0,1)),
  screen_shake_enabled INTEGER NOT NULL DEFAULT 1 CHECK (screen_shake_enabled IN (0,1)),
  damage_numbers_enabled INTEGER NOT NULL DEFAULT 1 CHECK (damage_numbers_enabled IN (0,1)),
  day_night_cycle_enabled INTEGER NOT NULL DEFAULT 1 CHECK (day_night_cycle_enabled IN (0,1)),
  bloom_enabled INTEGER NOT NULL DEFAULT 1 CHECK (bloom_enabled IN (0,1)),
  quality_level TEXT NOT NULL DEFAULT 'high'
    CHECK (quality_level IN ('low','medium','high','ultra')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS visual_effects_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_id TEXT,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('damage_number','particle','screen_shake')),
  effect_data TEXT NOT NULL CHECK (json_valid(effect_data)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_vfx_battle_created
  ON visual_effects_log(battle_id,created_at);
CREATE INDEX IF NOT EXISTS idx_vfx_player_created
  ON visual_effects_log(player_id,created_at);
