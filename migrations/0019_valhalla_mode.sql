-- Clash of Izzy: Ascensao de Valhalla (schema-only foundation).
-- Additive migration: the normal kingdom economy, player identity, hero inventory,
-- and base army tables remain intact. Event-only units live in their own inventory.
-- Mode is intentionally disabled until a protected Master action enables it.

PRAGMA foreign_keys = ON;

-- The repository has no game_config table yet. Keep global event settings in one
-- table and use INSERT OR IGNORE so a later migration never resets Admin values.
CREATE TABLE IF NOT EXISTS game_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO game_config (key, value) VALUES
  ('valhalla_mode_active', '0'),
  ('valhalla_resource_multiplier', '5.0'),
  ('valhalla_speed_multiplier', '0.2'),
  ('valhalla_start_time', '0'),
  ('valhalla_end_time', '0'),
  ('valhalla_daily_runes_reward', '100');

-- Game progression is kingdom-scoped in the current schema (players.id is only
-- an identity record). Store seasonal rank, runes and title with the kingdom.
ALTER TABLE kingdoms ADD COLUMN valhalla_rank INTEGER NOT NULL DEFAULT 0
  CHECK (valhalla_rank BETWEEN 0 AND 10);
ALTER TABLE kingdoms ADD COLUMN destiny_runes INTEGER NOT NULL DEFAULT 0
  CHECK (destiny_runes >= 0);
ALTER TABLE kingdoms ADD COLUMN valhalla_title TEXT;

-- Event units are deliberately separate from army_units: its unit_type CHECK
-- constraint belongs to the permanent army and must not be rebuilt for an event.
CREATE TABLE IF NOT EXISTS valhalla_troop_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('infantry','cavalry','archer','siege')),
  attack INTEGER NOT NULL CHECK (attack >= 0),
  defense INTEGER NOT NULL CHECK (defense >= 0),
  hp INTEGER NOT NULL CHECK (hp > 0),
  speed REAL NOT NULL CHECK (speed > 0),
  cost_food INTEGER NOT NULL DEFAULT 0 CHECK (cost_food >= 0),
  cost_wood INTEGER NOT NULL DEFAULT 0 CHECK (cost_wood >= 0),
  cost_gold INTEGER NOT NULL DEFAULT 0 CHECK (cost_gold >= 0),
  training_seconds INTEGER NOT NULL DEFAULT 1 CHECK (training_seconds > 0),
  strong_against TEXT,
  weak_against TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO valhalla_troop_catalog
  (id,name,category,attack,defense,hp,speed,cost_food,cost_wood,cost_gold,training_seconds,strong_against,weak_against)
VALUES
  ('einherjar','Einherjar','infantry',50,45,300,0.8,50,30,20,30,'cavalry','archer'),
  ('valkyrie_mounted','Valquiria Alada','cavalry',55,35,250,0.6,60,40,30,45,'archer','infantry'),
  ('asgard_archer','Arqueiro de Asgard','archer',65,25,200,1.0,70,50,40,60,'infantry','cavalry'),
  ('fenrir_beast','Fenrir Desperto','siege',120,30,500,1.5,150,100,80,120,NULL,NULL);

-- The existing heroes table stores heroes owned by a kingdom, not global templates.
-- Keep the seasonal hero catalog separate; Block 2/3 will grant ownership through
-- the established hero_inventory + heroes flow.
CREATE TABLE IF NOT EXISTS valhalla_hero_catalog (
  hero_key TEXT PRIMARY KEY,
  hero_name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('legendary','mythic')),
  description TEXT NOT NULL DEFAULT '',
  stats_json TEXT NOT NULL CHECK (json_valid(stats_json)),
  base_level INTEGER NOT NULL DEFAULT 1 CHECK (base_level BETWEEN 1 AND 100),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO valhalla_hero_catalog
  (hero_key,hero_name,rarity,description,stats_json,base_level)
VALUES
  ('odin_awakened','Odin Desperto','mythic','O Pai de Todos em sua forma divina','{"hp":12000,"attack":2400,"defense":1800,"speed":95}',5),
  ('thor_ragnarok','Thor do Ragnarok','mythic','Senhor do Trovao, portador de Mjolnir','{"hp":15000,"attack":2800,"defense":1500,"speed":90}',5),
  ('freya_vanir','Freya de Vanir','legendary','Senhora de Folkvangr e da magia seidr','{"hp":10000,"attack":1900,"defense":1700,"speed":100}',5),
  ('loki_chaos','Loki do Caos','legendary','Mestre das ilusoes e da transformacao','{"hp":9000,"attack":2200,"defense":1300,"speed":110}',5),
  ('valhalla_king','Rei de Valhalla','mythic','Campeao ancestral dos saloes de Odin','{"hp":18000,"attack":3000,"defense":2400,"speed":80}',5);

CREATE TABLE IF NOT EXISTS valhalla_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('troop_pack','buff','hero','cosmetic','title')),
  cost_runes INTEGER NOT NULL CHECK (cost_runes > 0),
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
  stock_limit INTEGER NOT NULL DEFAULT -1 CHECK (stock_limit = -1 OR stock_limit > 0),
  available_from INTEGER NOT NULL DEFAULT 0,
  available_until INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (available_until = 0 OR available_from = 0 OR available_until > available_from)
);

INSERT OR IGNORE INTO valhalla_catalog
  (id,name,description,category,cost_runes,reward_json,stock_limit,is_featured)
VALUES
  ('einherjar_pack_10','Chamado dos Einherjar','Invoca 10 guerreiros imortais de Valhalla','troop_pack',500,'{"troops":{"einherjar":10}}',-1,1),
  ('valkyrie_pack_5','Asas da Valquiria','Cinco Valquirias Aladas para dominar os ceus','troop_pack',750,'{"troops":{"valkyrie_mounted":5}}',-1,0),
  ('asgard_pack_10','Flechas de Asgard','Dez arqueiros de elite de Asgard','troop_pack',800,'{"troops":{"asgard_archer":10}}',-1,0),
  ('fenrir_pack_1','Correntes de Fenrir','Uma fera de cerco devastadora; limite de tres por reino','troop_pack',2000,'{"troops":{"fenrir_beast":1}}',3,1),
  ('buff_odin_blessing','Bencao de Odin','Aumenta o poder de ataque em 50% por 24 horas','buff',1000,'{"buff":"attack_power","multiplier":1.5,"duration_hours":24}',-1,0),
  ('buff_thor_hammer','Martelo de Thor','Duplica a velocidade de construcao por 12 horas','buff',800,'{"buff":"build_speed","multiplier":2.0,"duration_hours":12}',-1,1),
  ('buff_freya_charm','Encanto de Freya','Triplica a producao de recursos por 6 horas','buff',600,'{"buff":"resource_production","multiplier":3.0,"duration_hours":6}',-1,0),
  ('hero_odin_awakened','Odin Desperto','O Pai de Todos em sua forma divina','hero',10000,'{"hero":"odin_awakened","level":5}',1,1),
  ('hero_thor_ragnarok','Thor do Ragnarok','O Deus do Trovao em sua forma final','hero',8000,'{"hero":"thor_ragnarok","level":5}',1,1),
  ('skin_rune_armor','Armadura Runica','Visual exclusivo para a infantaria do evento','cosmetic',2500,'{"cosmetic":"troop_skin_rune_armor","applies_to":"infantry"}',1,0),
  ('title_valhalla_champion','Campeao de Valhalla','Titulo sazonal exibido no reino','title',3000,'{"title":"valhalla_champion"}',1,1);

-- Event troop holdings do not leak into the permanent army until combat rules
-- explicitly support the event units.
CREATE TABLE IF NOT EXISTS valhalla_troops (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL REFERENCES valhalla_troop_catalog(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  wounded INTEGER NOT NULL DEFAULT 0 CHECK (wounded >= 0 AND wounded <= quantity),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id, unit_type)
);
CREATE INDEX IF NOT EXISTS idx_valhalla_troops_type
  ON valhalla_troops(unit_type, quantity DESC);

-- Ledger is the audit source for rune grants and spending. Runes have no path
-- to the premium gems column and are never exchanged for gems.
CREATE TABLE IF NOT EXISTS valhalla_rune_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit','debit')),
  reason TEXT NOT NULL CHECK (reason IN ('daily_reward','shop_purchase','wild_hunt','season_reward','admin_adjustment')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_valhalla_rune_ledger_kingdom
  ON valhalla_rune_ledger(kingdom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valhalla_rune_ledger_reason
  ON valhalla_rune_ledger(reason, entry_type, created_at DESC);

CREATE TABLE IF NOT EXISTS valhalla_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  catalog_id TEXT NOT NULL REFERENCES valhalla_catalog(id),
  cost_runes INTEGER NOT NULL CHECK (cost_runes > 0),
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
  request_key TEXT NOT NULL UNIQUE,
  purchased_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_valhalla_purchases_kingdom
  ON valhalla_purchases(kingdom_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_valhalla_purchases_catalog
  ON valhalla_purchases(catalog_id, purchased_at DESC);

CREATE TABLE IF NOT EXISTS valhalla_buffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  buff_key TEXT NOT NULL,
  multiplier REAL NOT NULL CHECK (multiplier > 0),
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > starts_at),
  purchase_id INTEGER REFERENCES valhalla_purchases(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_valhalla_buffs_active
  ON valhalla_buffs(kingdom_id, expires_at);

-- One row per kingdom and UTC day prevents duplicate Cron grants.
CREATE TABLE IF NOT EXISTS valhalla_daily_rewards (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  reward_date TEXT NOT NULL,
  rune_amount INTEGER NOT NULL CHECK (rune_amount > 0),
  granted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id, reward_date)
);

CREATE TABLE IF NOT EXISTS valhalla_wild_hunt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_key TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  boss_hp_max INTEGER NOT NULL CHECK (boss_hp_max > 0),
  boss_hp_current INTEGER NOT NULL CHECK (boss_hp_current >= 0 AND boss_hp_current <= boss_hp_max),
  map_x REAL NOT NULL,
  map_z REAL NOT NULL,
  spawn_at INTEGER NOT NULL,
  despawn_at INTEGER NOT NULL CHECK (despawn_at > spawn_at),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','defeated','escaped')),
  killer_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_valhalla_wild_hunt_status
  ON valhalla_wild_hunt(status, spawn_at, despawn_at);

CREATE TABLE IF NOT EXISTS valhalla_wild_hunt_attacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hunt_id INTEGER NOT NULL REFERENCES valhalla_wild_hunt(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL UNIQUE,
  damage_dealt INTEGER NOT NULL CHECK (damage_dealt > 0),
  runes_earned INTEGER NOT NULL DEFAULT 0 CHECK (runes_earned >= 0),
  attacked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_valhalla_hunt_attacks_hunt
  ON valhalla_wild_hunt_attacks(hunt_id, attacked_at DESC);
CREATE INDEX IF NOT EXISTS idx_valhalla_hunt_attacks_kingdom
  ON valhalla_wild_hunt_attacks(kingdom_id, attacked_at DESC);

CREATE TABLE IF NOT EXISTS valhalla_leaderboard (
  kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
  total_damage INTEGER NOT NULL DEFAULT 0 CHECK (total_damage >= 0),
  total_runes_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_runes_earned >= 0),
  bosses_defeated INTEGER NOT NULL DEFAULT 0 CHECK (bosses_defeated >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS valhalla_rewards_claimed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
  claimed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (kingdom_id, reward_type)
);