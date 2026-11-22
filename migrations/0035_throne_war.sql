-- Guerra do Trono de Eldoria: 35 dias de proteção a partir da abertura de cada mapa.
-- Nenhuma migração de reino, alteração financeira ou remoção de dados históricos.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS throne_sieges (
 realm_id INTEGER NOT NULL REFERENCES realm_openings(realm_id),
 round_id INTEGER NOT NULL CHECK(round_id>=1),
 holding_alliance_id INTEGER NOT NULL REFERENCES alliances(id),
 holding_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
 held_since TEXT NOT NULL,
 garrison_power INTEGER NOT NULL CHECK(garrison_power BETWEEN 1 AND 1000000),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(realm_id,round_id)
);
CREATE INDEX IF NOT EXISTS idx_throne_sieges_alliance
 ON throne_sieges(holding_alliance_id,realm_id,round_id);

CREATE TABLE IF NOT EXISTS throne_crowns (
 realm_id INTEGER NOT NULL REFERENCES realm_openings(realm_id),
 round_id INTEGER NOT NULL CHECK(round_id>=1),
 alliance_id INTEGER NOT NULL REFERENCES alliances(id),
 king_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
 crowned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 appointed_at TEXT,
 PRIMARY KEY(realm_id,round_id)
);
CREATE INDEX IF NOT EXISTS idx_throne_crowns_history
 ON throne_crowns(realm_id,round_id DESC);

CREATE TABLE IF NOT EXISTS throne_siege_actions (
 action_id TEXT PRIMARY KEY CHECK(length(action_id)=36),
 realm_id INTEGER NOT NULL REFERENCES realm_openings(realm_id),
 round_id INTEGER NOT NULL CHECK(round_id>=1),
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
 alliance_id INTEGER NOT NULL REFERENCES alliances(id),
 action_kind TEXT NOT NULL CHECK(action_kind IN ('attack','reinforce')),
 unit_type TEXT NOT NULL,
 unit_quantity INTEGER NOT NULL CHECK(unit_quantity BETWEEN 1 AND 5000),
 casualties INTEGER NOT NULL CHECK(casualties BETWEEN 1 AND 5000),
 power INTEGER NOT NULL CHECK(power BETWEEN 1 AND 1000000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_throne_actions_cooldown
 ON throne_siege_actions(realm_id,round_id,kingdom_id,created_at DESC);

-- Mapa central: existe em cada reino liberado, inclusive o mapa 1 legado.
INSERT OR IGNORE INTO world_territories(
 territory_key,name,terrain,x,z,owner_kingdom_id,level,
 resource_type,resource_rate,territory_kind,map_region,shield_until
) SELECT 'royal_throne_realm_'||realm_id,'Trono de Eldoria','plains',
 0,0,NULL,30,NULL,0,'throne',realm_id,datetime(unlocked_at,'+35 days')
 FROM realm_openings;
