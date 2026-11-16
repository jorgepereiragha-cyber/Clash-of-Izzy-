PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- Extend the existing purchase queue: payment approval remains centralized in Master.
CREATE TABLE purchase_requests_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('vip_package','skin','battle_pass')),
  product_id INTEGER NOT NULL CHECK (product_id > 0),
  product_ref TEXT,
  product_name TEXT NOT NULL,
  price_brl REAL NOT NULL CHECK (price_brl > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  gems_amount INTEGER NOT NULL DEFAULT 0 CHECK (gems_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('mercadopago_link','pix','bank_transfer','manual')),
  payment_reference TEXT CHECK (payment_reference IS NULL OR length(payment_reference) <= 120),
  request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 12 AND 64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT,
  UNIQUE (player_id, request_key)
);
INSERT INTO purchase_requests_new
  (id,player_id,kingdom_id,product_kind,product_id,product_ref,product_name,price_brl,currency,gems_amount,payment_method,payment_reference,request_key,status,created_at,reviewed_at,reviewed_by)
SELECT id,player_id,kingdom_id,product_kind,product_id,NULL,product_name,price_brl,currency,gems_amount,payment_method,payment_reference,request_key,status,created_at,reviewed_at,reviewed_by
FROM purchase_requests;
DROP TABLE purchase_requests;
ALTER TABLE purchase_requests_new RENAME TO purchase_requests;
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_created ON purchase_requests(status,created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_player_created ON purchase_requests(player_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_one_pending_product
  ON purchase_requests(player_id,product_kind,product_id) WHERE status='pending';

-- Tutorial progress is per kingdom; account ID remains the existing public players.player_id.
CREATE TABLE tutorial_progress (
  kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK(current_step BETWEEN 1 AND 13),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE TABLE tutorial_step_claims (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL CHECK(step_id BETWEEN 1 AND 12),
  reward_json TEXT NOT NULL DEFAULT '{}',
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(kingdom_id,step_id)
);

-- Battle Pass: one seasonal track per kingdom, with claims and mission receipts that cannot repeat.
CREATE TABLE battle_pass_seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  premium_price_brl REAL NOT NULL DEFAULT 29.90 CHECK(premium_price_brl > 0),
  max_level INTEGER NOT NULL DEFAULT 30 CHECK(max_level BETWEEN 1 AND 100),
  xp_per_level INTEGER NOT NULL DEFAULT 100 CHECK(xp_per_level > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK(end_time > start_time)
);
CREATE TABLE battle_pass_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id TEXT NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 100),
  track TEXT NOT NULL CHECK(track IN ('free','premium')),
  reward_json TEXT NOT NULL,
  UNIQUE(season_id,level,track)
);
CREATE TABLE battle_pass_missions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('daily','weekly','seasonal')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goal INTEGER NOT NULL CHECK(goal > 0),
  event_type TEXT NOT NULL,
  xp_reward INTEGER NOT NULL CHECK(xp_reward > 0),
  reset_rule TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE INDEX idx_bp_missions_season ON battle_pass_missions(season_id,type,active);
CREATE TABLE battle_pass_progress (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL DEFAULT 1 CHECK(current_level BETWEEN 1 AND 100),
  current_xp INTEGER NOT NULL DEFAULT 0 CHECK(current_xp >= 0),
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK(total_xp >= 0),
  has_premium INTEGER NOT NULL DEFAULT 0 CHECK(has_premium IN (0,1)),
  premium_purchase_request_id INTEGER REFERENCES purchase_requests(id),
  PRIMARY KEY(kingdom_id,season_id)
);
CREATE TABLE battle_pass_mission_progress (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES battle_pass_missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK(xp_awarded IN (0,1)),
  last_updated INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY(kingdom_id,mission_id,period_key)
);
CREATE TABLE battle_pass_mission_receipts (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES battle_pass_missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK(value > 0),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY(kingdom_id,mission_id,period_key,source_event_id)
);
CREATE INDEX idx_bp_receipts_kingdom ON battle_pass_mission_receipts(kingdom_id,created_at);
CREATE TABLE battle_pass_claimed (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  track TEXT NOT NULL CHECK(track IN ('free','premium')),
  reward_json TEXT NOT NULL,
  claimed_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY(kingdom_id,season_id,level,track)
);
CREATE TABLE battle_pass_completion_bonuses (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  bonus_xp INTEGER NOT NULL DEFAULT 400,
  awarded_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY(kingdom_id,season_id)
);
CREATE TABLE battle_pass_event_cursor (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_event_id INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO battle_pass_event_cursor(id,last_event_id) VALUES(1,0);

-- Extend the existing alliance war record; do not create a parallel war system.
ALTER TABLE alliance_wars ADD COLUMN phase TEXT NOT NULL DEFAULT 'active' CHECK(phase IN ('preparing','active','ended'));
ALTER TABLE alliance_wars ADD COLUMN prepare_until TEXT;
ALTER TABLE alliance_wars ADD COLUMN goal_points INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE alliance_wars ADD COLUMN declared_by_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL;
ALTER TABLE alliance_wars ADD COLUMN winner_alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL;
ALTER TABLE alliance_wars ADD COLUMN end_reason TEXT;
UPDATE alliance_wars SET phase='ended' WHERE status='finished';

-- Battle actions are request-keyed so retries never consume troops or score twice.
ALTER TABLE alliance_war_battles ADD COLUMN objective_id INTEGER REFERENCES alliance_war_objectives(id) ON DELETE SET NULL;
ALTER TABLE alliance_war_battles ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX idx_alliance_war_battles_request
  ON alliance_war_battles(war_id,attacker_kingdom_id,request_key)
  WHERE request_key IS NOT NULL;

CREATE TABLE alliance_war_objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  war_id INTEGER NOT NULL REFERENCES alliance_wars(id) ON DELETE CASCADE,
  objective_type TEXT NOT NULL CHECK(objective_type IN ('fortress','outpost','banner')),
  name TEXT NOT NULL,
  map_x INTEGER NOT NULL,
  map_y INTEGER NOT NULL,
  owner_alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL,
  garrison_power INTEGER NOT NULL CHECK(garrison_power >= 0),
  max_garrison_power INTEGER NOT NULL CHECK(max_garrison_power >= 0),
  points_per_tick INTEGER NOT NULL CHECK(points_per_tick >= 0),
  capture_bonus INTEGER NOT NULL CHECK(capture_bonus >= 0),
  last_capture_at TEXT,
  last_capture_request_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_war_objectives_war ON alliance_war_objectives(war_id);
CREATE TABLE alliance_war_participants (
  war_id INTEGER NOT NULL REFERENCES alliance_wars(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK(side IN ('a','b')),
  points INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  captures INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(war_id,kingdom_id)
);
CREATE INDEX idx_alliance_war_participants_rank ON alliance_war_participants(war_id,points DESC);
CREATE TABLE alliance_war_score_ticks (
  war_id INTEGER NOT NULL REFERENCES alliance_wars(id) ON DELETE CASCADE,
  tick_at INTEGER NOT NULL,
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(war_id,tick_at)
);
CREATE TABLE alliance_war_reward_claims (
  war_id INTEGER NOT NULL REFERENCES alliance_wars(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK(reward_type IN ('victory','defeat','draw','mvp')),
  reward_json TEXT NOT NULL,
  distributed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(war_id,kingdom_id,reward_type)
);

-- Season starts at migration time and lasts 30 days; the next season is an admin-controlled insert.
INSERT OR IGNORE INTO battle_pass_seasons(id,name,theme,start_time,end_time,premium_price_brl,max_level,xp_per_level,status)
VALUES('season_ragnarok_2026_11','Ragnarök: O Crepúsculo','Os deuses preparam-se para a batalha final. Prove seu valor!',
  strftime('%s','now'),strftime('%s','now')+30*86400,29.90,30,100,'active');

INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('daily_build_1','season_ragnarok_2026_11','daily','Arquiteto do Norte','Melhore um edifício do reino',1,'building_upgraded',10,'daily_05:00',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('daily_train_50','season_ragnarok_2026_11','daily','Mestre de Armas','Treine 50 tropas',50,'troops_trained',10,'daily_05:00',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('daily_help_1','season_ragnarok_2026_11','daily','Aliado Fiel','Ajude um membro da aliança',1,'alliance_help',10,'daily_05:00',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('weekly_win_3','season_ragnarok_2026_11','weekly','Conquistador','Vença 3 batalhas territoriais',3,'battle_win',30,'weekly_monday',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('weekly_boss_10','season_ragnarok_2026_11','weekly','Flagelo dos Deuses','Ataque o Anjo da Morte 10 vezes',10,'boss_attack',30,'weekly_monday',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('weekly_upgrade_3','season_ragnarok_2026_11','weekly','Engenheiro do Reino','Melhore 3 edifícios',3,'building_upgraded',30,'weekly_monday',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('weekly_train_500','season_ragnarok_2026_11','weekly','Exército Massivo','Treine 500 tropas',500,'troops_trained',30,'weekly_monday',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('weekly_war_500','season_ragnarok_2026_11','weekly','Herói de Guerra','Ganhe 500 pontos em guerras',500,'war_points',30,'weekly_monday',1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_castle_5','season_ragnarok_2026_11','seasonal','Soberano Ascendente','Melhore o castelo 5 vezes',5,'castle_upgrade',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_hero_3','season_ragnarok_2026_11','seasonal','Colecionador de Lendas','Convoque 3 heróis',3,'hero_summon',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_alliance','season_ragnarok_2026_11','seasonal','Irmão de Armas','Entre em uma aliança',1,'alliance_join',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_war_win','season_ragnarok_2026_11','seasonal','Vencedor de Guerras','Vença uma guerra de aliança',1,'war_win',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_boss_20','season_ragnarok_2026_11','seasonal','Matador de Deuses','Ataque o Anjo da Morte 20 vezes',20,'boss_attack',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_purchase','season_ragnarok_2026_11','seasonal','Mecenas do Reino','Tenha uma compra aprovada',1,'purchase_approved',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_cosmetics_5','season_ragnarok_2026_11','seasonal','Artista do Reino','Adquira 5 visuais cosméticos',5,'cosmetic_skin_purchased',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_battle_20','season_ragnarok_2026_11','seasonal','Gladiador Nórdico','Vença 20 batalhas territoriais',20,'battle_win',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_gather_50k','season_ragnarok_2026_11','seasonal','Coletor de Asgard','Colete 50.000 recursos',50000,'resource_gather',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_missions(id,season_id,type,title,description,goal,event_type,xp_reward,reset_rule,active) VALUES('season_research_5','season_ragnarok_2026_11','seasonal','Mente de Odin','Conclua 5 pesquisas',5,'research_upgraded',100,NULL,1);
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',1,'free','{"gems":100}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',1,'premium','{"skin_id":"n3"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',2,'free','{"gold":1000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',2,'premium','{"gems":300}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',3,'free','{"food":5000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',3,'premium','{"shards":20}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',4,'free','{"wood":5000,"stone":3000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',4,'premium','{"skin_id":"c7"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',5,'free','{"gems":500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',5,'premium','{"skin_id":"n5"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',6,'free','{"item":"acc_1h"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',6,'premium','{"gems":500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',7,'free','{"gems":200}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',7,'premium','{"skin_id":"r5"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',8,'free','{"stone":5000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',8,'premium','{"shards":25}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',9,'free','{"gems":300}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',9,'premium','{"gems":1000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',10,'free','{"gems":1000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',10,'premium','{"skin_id":"n2"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',11,'free','{"gold":2000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',11,'premium','{"shards":30}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',12,'free','{"gems":400}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',12,'premium','{"skin_id":"n4"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',13,'free','{"iron":500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',13,'premium','{"skin_id":"e2"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',14,'free','{"gems":500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',14,'premium','{"gems":2500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',15,'free','{"shards":25}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',15,'premium','{"skin_id":"n1"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',16,'free','{"item":"acc_8h"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',16,'premium','{"shards":40}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',17,'free','{"gems":600}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',17,'premium','{"skin_id":"e3"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',18,'free','{"gold":3000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',18,'premium','{"gems":3500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',19,'free','{"gems":800}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',19,'premium','{"skin_id":"l2"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',20,'free','{"shards":50}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',20,'premium','{"skin_id":"n6"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',21,'free','{"wood":15000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',21,'premium','{"skin_id":"e1"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',22,'free','{"gems":1000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',22,'premium','{"gems":4500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',23,'free','{"item":"acc_1h"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',23,'premium','{"skin_id":"r4"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',24,'free','{"gems":1500}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',24,'premium','{"shards":75}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',25,'free','{"gems":2000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',25,'premium','{"skin_id":"l1"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',26,'free','{"gold":10000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',26,'premium','{"gems":5000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',27,'free','{"food":20000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',27,'premium','{"skin_id":"l3"}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',28,'free','{"shards":75}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',28,'premium','{"shards":100}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',29,'free','{"gems":3000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',29,'premium','{"gems":8000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',30,'free','{"shards":100,"gems":5000}');
INSERT OR IGNORE INTO battle_pass_rewards(season_id,level,track,reward_json) VALUES('season_ragnarok_2026_11',30,'premium','{"skin_id":"f_ascendant","gems":10000}');