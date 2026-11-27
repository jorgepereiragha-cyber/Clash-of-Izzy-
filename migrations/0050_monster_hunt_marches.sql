-- Additive hunt queue. No dispatch route until shared slots and settlement are integrated.
CREATE TABLE IF NOT EXISTS monster_hunt_marches (
 id TEXT PRIMARY KEY,
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 monster_id INTEGER NOT NULL REFERENCES world_monsters(id),
 monster_generation INTEGER NOT NULL CHECK(monster_generation>=1),
 units_json TEXT NOT NULL CHECK(json_valid(units_json) AND json_type(units_json)='object'),
 energy_cost INTEGER NOT NULL CHECK(energy_cost BETWEEN 1 AND 120),
 started_at INTEGER NOT NULL CHECK(started_at>0),
 arrives_at INTEGER NOT NULL CHECK(arrives_at>started_at),
 status TEXT NOT NULL DEFAULT 'marching' CHECK(status IN ('marching','completed','cancelled')),
 resolution_token TEXT UNIQUE,
 resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_hunt_marches_active ON monster_hunt_marches(kingdom_id,status,arrives_at);
