-- Additive P1–P8 progression without replacing kingdoms, players or existing balances.
CREATE TABLE IF NOT EXISTS kingdom_player_progression (
 kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
 total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp BETWEEN 0 AND 1000000000000),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Each completed queue can grant XP only once, even if its completion token
-- is replayed. This table is not subject to cleanup of UI event history.
CREATE TABLE IF NOT EXISTS kingdom_progression_awards (
 queue_id INTEGER PRIMARY KEY,
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 xp_amount INTEGER NOT NULL CHECK (xp_amount BETWEEN 1 AND 3000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_progression_awards_kingdom
 ON kingdom_progression_awards(kingdom_id, queue_id);
