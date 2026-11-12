-- Clash of Izzy: base persistente para reinos, economia, tropas, herois e mundo
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS kingdoms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  kingdom_name TEXT NOT NULL DEFAULT 'Novo Reino',
  castle_level INTEGER NOT NULL DEFAULT 1 CHECK (castle_level BETWEEN 1 AND 30),
  food INTEGER NOT NULL DEFAULT 5000 CHECK (food >= 0),
  wood INTEGER NOT NULL DEFAULT 5000 CHECK (wood >= 0),
  stone INTEGER NOT NULL DEFAULT 3000 CHECK (stone >= 0),
  iron INTEGER NOT NULL DEFAULT 1000 CHECK (iron >= 0),
  gold INTEGER NOT NULL DEFAULT 1000 CHECK (gold >= 0),
  power INTEGER NOT NULL DEFAULT 0 CHECK (power >= 0),
  protection_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kingdom_buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  building_type TEXT NOT NULL CHECK (building_type IN ('castle','barracks','farm','quarry','lumber_mill','iron_mine','market','academy','wall','hospital','watchtower','stable','archery_range','siege_workshop','embassy','warehouse')),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  position_x REAL NOT NULL DEFAULT 0,
  position_z REAL NOT NULL DEFAULT 0,
  upgraded_at TEXT,
  UNIQUE (kingdom_id, building_type)
);

CREATE TABLE IF NOT EXISTS army_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('militia','swordsman','spearman','archer','cavalry','knight','crossbowman','catapult','ram','trebuchet')),
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 10),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  wounded INTEGER NOT NULL DEFAULT 0 CHECK (wounded >= 0),
  UNIQUE (kingdom_id, unit_type, tier)
);

CREATE TABLE IF NOT EXISTS heroes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  hero_key TEXT NOT NULL,
  hero_name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  experience INTEGER NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary','mythic')),
  assigned_to TEXT,
  UNIQUE (kingdom_id, hero_key)
);

CREATE TABLE IF NOT EXISTS hero_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hero_id INTEGER NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('weapon','helmet','armor','boots','accessory')),
  item_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  UNIQUE (hero_id, slot)
);

CREATE TABLE IF NOT EXISTS research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  research_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 30),
  completed_at TEXT,
  UNIQUE (kingdom_id, research_key)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE (kingdom_id, item_key)
);

CREATE TABLE IF NOT EXISTS alliances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE,
  leader_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alliance_members (
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL UNIQUE REFERENCES kingdoms(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','officer','member')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alliance_id, kingdom_id)
);

CREATE TABLE IF NOT EXISTS world_territories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  territory_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  terrain TEXT NOT NULL DEFAULT 'plains',
  x REAL NOT NULL,
  z REAL NOT NULL,
  owner_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 1,
  resource_type TEXT,
  resource_rate INTEGER NOT NULL DEFAULT 0,
  shield_until TEXT
);

CREATE TABLE IF NOT EXISTS marches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  target_territory_id INTEGER REFERENCES world_territories(id),
  march_type TEXT NOT NULL CHECK (march_type IN ('gather','reinforce','scout','attack','return')),
  units_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'marching' CHECK (status IN ('marching','arrived','returning','completed','cancelled')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  arrives_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS battle_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
  defender_kingdom_id INTEGER REFERENCES kingdoms(id),
  territory_id INTEGER REFERENCES world_territories(id),
  winner_kingdom_id INTEGER REFERENCES kingdoms(id),
  battle_type TEXT NOT NULL DEFAULT 'pve',
  attacker_power INTEGER NOT NULL DEFAULT 0,
  defender_power INTEGER NOT NULL DEFAULT 0,
  losses_json TEXT NOT NULL DEFAULT '{}',
  rewards_json TEXT NOT NULL DEFAULT '{}',
  battle_log TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  resource TEXT NOT NULL CHECK (resource IN ('food','wood','stone','iron','gold','gems')),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kingdom_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_buildings_kingdom ON kingdom_buildings(kingdom_id);
CREATE INDEX IF NOT EXISTS idx_units_kingdom ON army_units(kingdom_id);
CREATE INDEX IF NOT EXISTS idx_heroes_kingdom ON heroes(kingdom_id);
CREATE INDEX IF NOT EXISTS idx_territories_owner ON world_territories(owner_kingdom_id);
CREATE INDEX IF NOT EXISTS idx_marches_arrival ON marches(status, arrives_at);
CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battle_reports(attacker_kingdom_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_kingdom ON resource_ledger(kingdom_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_kingdom ON kingdom_events(kingdom_id, created_at);

-- Edificios iniciais e tropas são criados pela rotina de fundação do reino no servidor.
