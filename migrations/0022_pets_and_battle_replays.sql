-- Clash of Izzy: mascotes persistentes e replays de batalha com validade limitada.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pet_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','rare','epic','legendary','mythic')),
  base_skill_json TEXT NOT NULL CHECK (json_valid(base_skill_json)),
  icon TEXT NOT NULL DEFAULT '🐾',
  unlock_cost_gold INTEGER NOT NULL DEFAULT 0 CHECK (unlock_cost_gold >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

INSERT OR IGNORE INTO pet_catalog
  (id,name,description,rarity,base_skill_json,icon,unlock_cost_gold,active)
VALUES
  ('pet_raven','Corvo de Odin','Aumenta a velocidade de marcha do reino em 5%.','epic','{"type":"march_speed","value":0.05}','🐦‍⬛',0,1),
  ('pet_wolf','Lobo Fenrir','Aumenta o ataque da infantaria em 8%.','legendary','{"type":"infantry_attack","value":0.08}','🐺',10000,1),
  ('pet_dragon','Dragão Nórdico','Aumenta a produção de todos os recursos em 10%.','legendary','{"type":"resource_prod","value":0.10}','🐉',25000,1);

CREATE TABLE IF NOT EXISTS kingdom_pets (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES pet_catalog(id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 50),
  experience INTEGER NOT NULL DEFAULT 0 CHECK (experience >= 0),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1)),
  acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,pet_id)
);
CREATE INDEX IF NOT EXISTS idx_kingdom_pets_active
  ON kingdom_pets(kingdom_id,is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdom_pets_one_active
  ON kingdom_pets(kingdom_id) WHERE is_active=1;

CREATE TABLE IF NOT EXISTS kingdom_pet_feed_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  food_amount INTEGER NOT NULL CHECK (food_amount BETWEEN 1 AND 1000),
  gold_spent INTEGER NOT NULL CHECK (gold_spent >= 0),
  exp_gained INTEGER NOT NULL CHECK (exp_gained >= 0),
  level_after INTEGER NOT NULL CHECK (level_after BETWEEN 1 AND 50),
  experience_after INTEGER NOT NULL CHECK (experience_after >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (kingdom_id,request_key),
  FOREIGN KEY (kingdom_id,pet_id) REFERENCES kingdom_pets(kingdom_id,pet_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pet_feed_history
  ON kingdom_pet_feed_requests(kingdom_id,id DESC);

-- Entrega o Corvo de Odin aos reinos já existentes sem duplicar inventários.
INSERT OR IGNORE INTO kingdom_pets(kingdom_id,pet_id,level,experience,is_active)
SELECT id,'pet_raven',1,0,1 FROM kingdoms;

-- O relatório resumido permanece após sete dias; somente o replay detalhado expira.
ALTER TABLE battle_reports
  ADD COLUMN replay_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(replay_json));
ALTER TABLE battle_reports
  ADD COLUMN replay_expires_at INTEGER NOT NULL DEFAULT 0;

UPDATE battle_reports
SET replay_expires_at=COALESCE(CAST(strftime('%s',created_at) AS INTEGER),unixepoch())+604800
WHERE replay_expires_at=0;

CREATE TRIGGER IF NOT EXISTS trg_battle_reports_replay_expiry
AFTER INSERT ON battle_reports
WHEN NEW.replay_expires_at=0
BEGIN
  UPDATE battle_reports
  SET replay_expires_at=unixepoch()+604800
  WHERE id=NEW.id AND replay_expires_at=0;
END;

CREATE INDEX IF NOT EXISTS idx_battle_reports_replay_expiry
  ON battle_reports(replay_expires_at);
