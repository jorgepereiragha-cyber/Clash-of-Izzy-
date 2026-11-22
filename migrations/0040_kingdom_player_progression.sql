-- Additive P1–P8 progression without replacing kingdoms, players or existing balances.
CREATE TABLE IF NOT EXISTS kingdom_player_progression (
 kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
 total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp BETWEEN 0 AND 1000000000000),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
