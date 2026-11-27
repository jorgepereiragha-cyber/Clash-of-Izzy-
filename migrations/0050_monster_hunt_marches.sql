CREATE TABLE monster_hunt_marches (
  march_id INTEGER PRIMARY KEY REFERENCES marches(id) ON DELETE CASCADE,
  dispatch_key TEXT NOT NULL UNIQUE,
  monster_id INTEGER NOT NULL REFERENCES world_monsters(id),
  generation INTEGER NOT NULL CHECK (generation > 0),
  level INTEGER NOT NULL CHECK (level IN (1, 3, 5, 8, 12, 18)),
  damage INTEGER NOT NULL CHECK (damage > 0),
  energy_cost INTEGER NOT NULL CHECK (energy_cost > 0),
  outcome TEXT CHECK (outcome IN ('victory', 'wounded', 'unavailable')),
  damage_dealt INTEGER NOT NULL DEFAULT 0 CHECK (damage_dealt >= 0 AND damage_dealt <= damage)
);
