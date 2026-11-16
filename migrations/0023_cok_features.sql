-- CoK-style progression services for the existing kingdom/player schema.
-- Premium currency and rewards are only changed by authenticated server flows.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS player_vip (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  vip_level INTEGER NOT NULL DEFAULT 0 CHECK (vip_level BETWEEN 0 AND 15),
  vip_exp INTEGER NOT NULL DEFAULT 0 CHECK (vip_exp >= 0),
  vip_expires INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS vip_benefits (
  vip_level INTEGER PRIMARY KEY CHECK (vip_level BETWEEN 0 AND 15),
  build_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (build_speed_bonus BETWEEN 0 AND 0.8),
  train_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (train_speed_bonus BETWEEN 0 AND 0.8),
  research_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (research_speed_bonus BETWEEN 0 AND 0.8),
  resource_bonus REAL NOT NULL DEFAULT 0 CHECK (resource_bonus BETWEEN 0 AND 0.8),
  march_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (march_speed_bonus BETWEEN 0 AND 0.3),
  daily_gift_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(daily_gift_json))
);
INSERT OR IGNORE INTO vip_benefits
  (vip_level,build_speed_bonus,train_speed_bonus,research_speed_bonus,resource_bonus,march_speed_bonus,daily_gift_json)
VALUES
  (0,0,0,0,0,0,'{}'),
  (1,0.05,0.05,0.05,0.05,0,'{}'),
  (2,0.10,0.10,0.10,0.10,0.02,'{}'),
  (3,0.15,0.15,0.15,0.15,0.04,'{}'),
  (4,0.20,0.20,0.20,0.20,0.06,'{}'),
  (5,0.25,0.25,0.25,0.25,0.08,'{}'),
  (6,0.30,0.30,0.30,0.30,0.10,'{}'),
  (7,0.35,0.35,0.35,0.35,0.12,'{}'),
  (8,0.40,0.40,0.40,0.40,0.14,'{}'),
  (9,0.45,0.45,0.45,0.45,0.16,'{}'),
  (10,0.50,0.50,0.50,0.50,0.18,'{}'),
  (11,0.55,0.55,0.55,0.55,0.20,'{}'),
  (12,0.60,0.60,0.60,0.60,0.22,'{}'),
  (13,0.65,0.65,0.65,0.65,0.24,'{}'),
  (14,0.70,0.70,0.70,0.70,0.26,'{}'),
  (15,0.80,0.80,0.80,0.80,0.30,'{}');

CREATE TABLE IF NOT EXISTS player_speedups (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  speedup_type TEXT NOT NULL CHECK (speedup_type IN ('build','train','research','march')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds IN (60,300,900,1800,3600,14400,28800,86400)),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (player_id,speedup_type,duration_seconds)
);

CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('battle','build','train','gather','research','login')),
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
  is_daily INTEGER NOT NULL DEFAULT 1 CHECK (is_daily IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);
CREATE TABLE IF NOT EXISTS player_task_progress (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,task_id,period_key)
);
INSERT OR IGNORE INTO daily_tasks
  (id,title,description,task_type,target_count,reward_json,is_daily,active)
VALUES
  ('daily_battle_1','Primeira Vitória','Vença uma batalha de campanha hoje.','battle',1,'{"gems":25,"speedup":{"type":"train","seconds":300,"quantity":1}}',1,1),
  ('daily_build_1','Mãos à Obra','Conclua uma melhoria de edifício hoje.','build',1,'{"wood":400,"stone":200}',1,1),
  ('daily_gather_1','Coleta Real','Colete recursos de um nó do mapa hoje.','gather',1,'{"food":500,"speedup":{"type":"build","seconds":300,"quantity":1}}',1,1),
  ('daily_research_1','Mente Estratégica','Conclua uma pesquisa hoje.','research',1,'{"gems":35,"speedup":{"type":"research","seconds":300,"quantity":1}}',1,1),
  ('daily_train_100','Reforços do Reino','Mantenha 100 tropas no exército.','train',100,'{"food":500,"wood":250}',1,1);

CREATE TABLE IF NOT EXISTS player_mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT 'Sistema',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_json TEXT CHECK (attachment_json IS NULL OR json_valid(attachment_json)),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  is_claimed INTEGER NOT NULL DEFAULT 0 CHECK (is_claimed IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_player_mail_recipient
  ON player_mail(recipient_id,is_read,created_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('combat','building','social','collection')),
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL CHECK (requirement_value > 0),
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json))
);
CREATE TABLE IF NOT EXISTS player_achievements (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1)),
  completed_at INTEGER,
  PRIMARY KEY (kingdom_id,achievement_id)
);
INSERT OR IGNORE INTO achievements
  (id,title,description,category,tier,requirement_type,requirement_value,reward_json)
VALUES
  ('first_blood','Primeiro Sangue','Vença sua primeira batalha.','combat',1,'battles_won',1,'{"gems":100}'),
  ('warrior_10','Veterano de Guerra','Vença dez batalhas.','combat',2,'battles_won',10,'{"gems":300}'),
  ('builder_5','Arquiteto','Alcance cinco níveis de construção somados.','building',1,'building_levels',5,'{"gems":150}'),
  ('social_1','Irmãos de Armas','Entre em uma aliança.','social',1,'alliance_joined',1,'{"gems":200}'),
  ('collector_1000','Colecionador','Receba 1.000 recursos pelo ledger.','collection',1,'resources_received',1000,'{"gems":100}');

CREATE TABLE IF NOT EXISTS troop_formations (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 5),
  formation_name TEXT NOT NULL DEFAULT 'Formação',
  troop_data TEXT NOT NULL CHECK (json_valid(troop_data)),
  hero_id INTEGER REFERENCES heroes(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,slot_number)
);
CREATE INDEX IF NOT EXISTS idx_troop_formations_active
  ON troop_formations(kingdom_id,is_active);

CREATE TABLE IF NOT EXISTS mount_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','rare','epic','legendary')),
  speed_bonus REAL NOT NULL DEFAULT 0 CHECK (speed_bonus BETWEEN 0 AND 0.5),
  attack_bonus REAL NOT NULL DEFAULT 0 CHECK (attack_bonus BETWEEN 0 AND 0.5),
  defense_bonus REAL NOT NULL DEFAULT 0 CHECK (defense_bonus BETWEEN 0 AND 0.5),
  icon TEXT NOT NULL DEFAULT '🐎'
);
CREATE TABLE IF NOT EXISTS player_mounts (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  mount_id TEXT NOT NULL REFERENCES mount_catalog(id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  is_equipped INTEGER NOT NULL DEFAULT 0 CHECK (is_equipped IN (0,1)),
  obtained_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,mount_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_mount_one_equipped
  ON player_mounts(kingdom_id) WHERE is_equipped=1;

-- Cosmetics ownership remains in kingdom_cosmetics; these are catalog tables only.
CREATE TABLE IF NOT EXISTS city_skin_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL,
  model_url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏰'
);
CREATE TABLE IF NOT EXISTS portrait_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL,
  icon_url TEXT NOT NULL
);
INSERT OR IGNORE INTO mount_catalog
  (id,name,description,rarity,speed_bonus,attack_bonus,defense_bonus,icon)
VALUES
  ('horse_basic','Cavalo de Guerra','Montaria inicial do reino.','common',0.05,0,0,'🐎'),
  ('horse_war','Cavalo de Batalha','Montaria de combate.','rare',0.10,0.05,0,'🐴'),
  ('wolf_fenrir','Lobo de Fenrir','Montaria lendária das sagas nórdicas.','legendary',0.20,0.15,0.10,'🐺'),
  ('sleipnir','Sleipnir','A montaria de oito patas de Odin.','legendary',0.30,0.20,0.15,'🦄');
INSERT OR IGNORE INTO city_skin_catalog(id,name,description,rarity,model_url,icon) VALUES
  ('skin_viking','Estilo Viking','Visual nórdico clássico.','common','/assets/3d/skins/viking.glb','🏰'),
  ('skin_valhalla','Estilo Valhalla','Visual dourado lendário.','legendary','/assets/3d/skins/valhalla.glb','🏯'),
  ('skin_ragnarok','Estilo Ragnarök','Visual apocalíptico.','epic','/assets/3d/skins/ragnarok.glb','🏰');
INSERT OR IGNORE INTO portrait_catalog(id,name,description,rarity,icon_url) VALUES
  ('portrait_viking','Guerreiro Viking','Retrato do guerreiro do norte.','common','/assets/portraits/viking.webp'),
  ('portrait_valkyrie','Valquíria','Retrato das guardiãs de Asgard.','epic','/assets/portraits/valkyrie.webp'),
  ('portrait_odin','Odin','Retrato do Pai de Todos.','legendary','/assets/portraits/odin.webp');
