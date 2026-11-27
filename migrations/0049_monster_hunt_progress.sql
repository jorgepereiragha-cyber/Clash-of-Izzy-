-- Persistent player-specific hunt progress and energy. Additive, no economic mutation.
CREATE TABLE IF NOT EXISTS monster_hunt_progress (
 kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
 energy INTEGER NOT NULL DEFAULT 120 CHECK(energy BETWEEN 0 AND 120),
 updated_at INTEGER NOT NULL CHECK(updated_at>0),
 cleared_level INTEGER NOT NULL DEFAULT 0 CHECK(cleared_level IN (0,1,3,5,8,12,18)),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
);
