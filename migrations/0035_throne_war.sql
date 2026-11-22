-- Clash of Izzy 0035: throne in the CENTER of each opened realm.
-- IMPORTANT: legacy world_territories.territory_kind CHECK permits resource/castle
-- only. Throne is a reserved 'resource' key exposed as a virtual 'throne' by
-- the API; regular resource gathering/attacks are blocked at the Worker.
-- First throne shield lasts exactly 35 days after its realm opening.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS realm_thrones(
  realm_id INTEGER PRIMARY KEY REFERENCES realm_openings(realm_id),
  territory_id INTEGER NOT NULL UNIQUE REFERENCES world_territories(id),
  shield_until TEXT NOT NULL,
  occupying_alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL,
  occupying_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
  occupied_since TEXT,
  occupation_cycle INTEGER,
  occupying_power INTEGER NOT NULL DEFAULT 0,
  crowned_alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL,
  crowned_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
  crowned_cycle INTEGER,
  crowned_at TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
);

CREATE TABLE IF NOT EXISTS throne_assaults(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  realm_id INTEGER NOT NULL REFERENCES realm_openings(realm_id),
  cycle INTEGER NOT NULL CHECK(cycle>=0),
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  units_json TEXT NOT NULL,
  casualties_json TEXT NOT NULL,
  attacker_power INTEGER NOT NULL CHECK(attacker_power>0),
  defender_power INTEGER NOT NULL CHECK(defender_power>0),
  won INTEGER NOT NULL CHECK(won IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kingdom_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_throne_assaults_realm_cycle_time
  ON throne_assaults(realm_id,cycle,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_throne_assaults_kingdom_time
  ON throne_assaults(kingdom_id,created_at DESC);

INSERT OR IGNORE INTO world_territories(
  territory_key,name,terrain,x,z,level,resource_type,
  resource_rate,territory_kind,map_region,shield_until
)
SELECT 'royal_throne_'||r.realm_id,'Trono Imperial de Eldoria',
       'royal',0,0,30,NULL,0,'resource',r.realm_id,
       datetime(r.unlocked_at,'+35 days')
FROM realm_openings r;

INSERT OR IGNORE INTO realm_thrones(realm_id,territory_id,shield_until)
SELECT r.realm_id,wt.id,datetime(r.unlocked_at,'+35 days')
FROM realm_openings r
JOIN world_territories wt ON wt.territory_key='royal_throne_'||r.realm_id
 AND wt.map_region=r.realm_id;
