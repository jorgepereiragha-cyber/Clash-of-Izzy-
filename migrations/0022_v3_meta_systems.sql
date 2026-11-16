-- Clash of Izzy v3.0 — meta systems, scoped to the authoritative kingdom.
-- Additive only: existing player identity, economy, queues and inventories remain unchanged.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS kingdom_visual_settings (
  kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
  particles_enabled INTEGER NOT NULL DEFAULT 1 CHECK (particles_enabled IN (0,1)),
  screen_shake_enabled INTEGER NOT NULL DEFAULT 1 CHECK (screen_shake_enabled IN (0,1)),
  damage_numbers_enabled INTEGER NOT NULL DEFAULT 1 CHECK (damage_numbers_enabled IN (0,1)),
  day_night_cycle_enabled INTEGER NOT NULL DEFAULT 1 CHECK (day_night_cycle_enabled IN (0,1)),
  quality_level TEXT NOT NULL DEFAULT 'balanced'
    CHECK (quality_level IN ('low','balanced','high')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- VIP is kingdom progression. Levels and bonuses are read from this server-owned catalog;
-- this migration does not invent a gem price or expose a client-priced upgrade endpoint.
CREATE TABLE IF NOT EXISTS kingdom_vip (
  kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
  vip_level INTEGER NOT NULL DEFAULT 0 CHECK (vip_level BETWEEN 0 AND 15),
  vip_exp INTEGER NOT NULL DEFAULT 0 CHECK (vip_exp >= 0),
  vip_expires INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS vip_benefits (
  vip_level INTEGER PRIMARY KEY CHECK (vip_level BETWEEN 0 AND 15),
  build_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (build_speed_bonus BETWEEN 0 AND 0.20),
  train_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (train_speed_bonus BETWEEN 0 AND 0.20),
  research_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (research_speed_bonus BETWEEN 0 AND 0.20),
  resource_bonus REAL NOT NULL DEFAULT 0 CHECK (resource_bonus BETWEEN 0 AND 0.20),
  march_speed_bonus REAL NOT NULL DEFAULT 0 CHECK (march_speed_bonus BETWEEN 0 AND 0.20),
  daily_gift_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(daily_gift_json))
);

INSERT OR IGNORE INTO vip_benefits
  (vip_level,build_speed_bonus,train_speed_bonus,research_speed_bonus,resource_bonus,march_speed_bonus,daily_gift_json)
VALUES
  (0,0,0,0,0,0,'{}'),
  (1,0.01,0.01,0.01,0.01,0,'{"gems":10}'),
  (2,0.02,0.02,0.02,0.02,0.01,'{"gems":20}'),
  (3,0.03,0.03,0.03,0.03,0.02,'{"gems":30}'),
  (4,0.04,0.04,0.04,0.04,0.03,'{"gems":40}'),
  (5,0.05,0.05,0.05,0.05,0.04,'{"gems":50}'),
  (6,0.06,0.06,0.06,0.06,0.05,'{"gems":60}'),
  (7,0.07,0.07,0.07,0.07,0.06,'{"gems":70}'),
  (8,0.08,0.08,0.08,0.08,0.07,'{"gems":80}'),
  (9,0.09,0.09,0.09,0.09,0.08,'{"gems":90}'),
  (10,0.10,0.10,0.10,0.10,0.09,'{"gems":100}'),
  (11,0.11,0.11,0.11,0.11,0.10,'{"gems":110}'),
  (12,0.12,0.12,0.12,0.12,0.11,'{"gems":120}'),
  (13,0.13,0.13,0.13,0.13,0.12,'{"gems":130}'),
  (14,0.14,0.14,0.14,0.14,0.13,'{"gems":140}'),
  (15,0.15,0.15,0.15,0.15,0.14,'{"gems":150}');

CREATE TABLE IF NOT EXISTS kingdom_speedups (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  queue_type TEXT NOT NULL CHECK (queue_type IN ('construction','training','research','march')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds IN (60,300,900,3600,14400,86400)),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (kingdom_id,queue_type,duration_seconds)
);

CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'daily' CHECK (period_type IN ('daily','weekly')),
  progress_field TEXT NOT NULL CHECK (progress_field IN ('one','quantity','amount')),
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS kingdom_task_progress (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,task_id,period_key)
);
CREATE INDEX IF NOT EXISTS idx_kingdom_tasks_period
  ON kingdom_task_progress(kingdom_id,period_key,completed,claimed);

INSERT OR IGNORE INTO daily_tasks
  (id,title,description,event_type,period_type,progress_field,target_count,reward_json)
VALUES
  ('daily_battle_1','Vitória do Dia','Vença 1 batalha contra um inimigo.','battle_won','daily','one',1,
    '{"gems":50,"speedups":[{"queue_type":"training","duration_seconds":300,"quantity":1}]}'),
  ('daily_build_2','Mãos à Obra','Conclua 2 melhorias de edifícios.','building_upgraded','daily','one',2,
    '{"gems":30,"resources":{"wood":1000}}'),
  ('daily_train_500','Reforços do Reino','Treine 500 tropas.','troops_trained','daily','quantity',500,
    '{"gems":40,"resources":{"food":2000}}'),
  ('daily_gather_10000','Coletor de Midgard','Recolha 10.000 recursos nos nós do mapa.','resources_gathered','daily','amount',10000,
    '{"gems":35,"speedups":[{"queue_type":"construction","duration_seconds":3600,"quantity":1}]}'),
  ('daily_research_1','Conhecimento Ancestral','Conclua 1 pesquisa.','research_upgraded','daily','one',1,
    '{"gems":60,"speedups":[{"queue_type":"research","duration_seconds":3600,"quantity":1}]}'),
  ('weekly_battle_10','Semana de Guerra','Vença 10 batalhas nesta semana.','battle_won','weekly','one',10,
    '{"gems":300,"speedups":[{"queue_type":"training","duration_seconds":3600,"quantity":2}]}'),
  ('weekly_gather_50000','Tributo de Midgard','Recolha 50.000 recursos nesta semana.','resources_gathered','weekly','amount',50000,
    '{"gems":350,"resources":{"gold":1000}}');

CREATE TABLE IF NOT EXISTS achievement_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('combat','building','social','collection')),
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  event_type TEXT NOT NULL,
  progress_field TEXT NOT NULL CHECK (progress_field IN ('one','quantity','amount')),
  requirement_value INTEGER NOT NULL CHECK (requirement_value > 0),
  reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS kingdom_achievement_progress (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievement_catalog(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1)),
  completed_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_kingdom_achievements
  ON kingdom_achievement_progress(kingdom_id,completed,claimed);
CREATE INDEX IF NOT EXISTS idx_battle_reports_winner
  ON battle_reports(winner_kingdom_id,id);

INSERT OR IGNORE INTO achievement_catalog
  (id,title,description,category,tier,event_type,progress_field,requirement_value,reward_json)
VALUES
  ('first_blood','Primeiro Sangue','Vença sua primeira batalha.','combat',1,'battle_won','one',1,'{"gems":100}'),
  ('warrior_10','Veterano de Guerra','Vença 10 batalhas.','combat',2,'battle_won','one',10,'{"gems":500}'),
  ('warrior_100','Lenda da Guerra','Vença 100 batalhas.','combat',3,'battle_won','one',100,'{"gems":2000}'),
  ('builder_5','Arquiteto Iniciante','Conclua 5 melhorias de edifícios.','building',1,'building_upgraded','one',5,'{"gems":150}'),
  ('builder_20','Mestre Construtor','Conclua 20 melhorias de edifícios.','building',2,'building_upgraded','one',20,'{"gems":800}'),
  ('collector_10000','Colecionador','Recolha 10.000 recursos nos nós.','collection',1,'resources_gathered','amount',10000,'{"gems":100}'),
  ('collector_1000000','Magnata','Recolha 1.000.000 recursos nos nós.','collection',4,'resources_gathered','amount',1000000,'{"gems":5000}');

CREATE TABLE IF NOT EXISTS kingdom_mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT 'Sistema',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_json TEXT CHECK (attachment_json IS NULL OR json_valid(attachment_json)),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  is_claimed INTEGER NOT NULL DEFAULT 0 CHECK (is_claimed IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kingdom_mail_inbox
  ON kingdom_mail(kingdom_id,is_read,created_at DESC);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_troop_formations_one_active
  ON troop_formations(kingdom_id) WHERE is_active=1;

-- Domain events are the single source for daily tasks and permanent achievements.
-- A new event advances both ledgers; historical events are intentionally not replayed.
CREATE TRIGGER IF NOT EXISTS trg_kingdom_event_meta_progress
AFTER INSERT ON kingdom_events
BEGIN
  INSERT INTO kingdom_task_progress(kingdom_id,task_id,period_key,progress)
  SELECT NEW.kingdom_id,dt.id,strftime('%Y-%m-%d','now'),
    CASE dt.progress_field
      WHEN 'quantity' THEN MAX(0,CAST(COALESCE(json_extract(NEW.payload_json,'$.quantity'),0) AS INTEGER))
      WHEN 'amount' THEN MAX(0,CAST(COALESCE(json_extract(NEW.payload_json,'$.amount'),0) AS INTEGER))
      ELSE 1
    END
  FROM daily_tasks dt
  WHERE dt.active=1 AND dt.event_type=NEW.event_type
  ON CONFLICT(kingdom_id,task_id,period_key) DO UPDATE SET
    progress=MIN(
      (SELECT target_count FROM daily_tasks WHERE id=excluded.task_id),
      kingdom_task_progress.progress+excluded.progress
    ),
    completed=CASE WHEN MIN(
      (SELECT target_count FROM daily_tasks WHERE id=excluded.task_id),
      kingdom_task_progress.progress+excluded.progress
    ) >= (SELECT target_count FROM daily_tasks WHERE id=excluded.task_id) THEN 1 ELSE 0 END,
    updated_at=unixepoch();

  UPDATE kingdom_task_progress
  SET completed=1,updated_at=unixepoch()
  WHERE kingdom_id=NEW.kingdom_id
    AND task_id IN (SELECT id FROM daily_tasks WHERE event_type=NEW.event_type AND active=1)
    AND period_key=(SELECT CASE period_type WHEN 'weekly' THEN strftime('%Y-W%W','now')
      ELSE strftime('%Y-%m-%d','now') END FROM daily_tasks WHERE id=kingdom_task_progress.task_id)
    AND progress >= (SELECT target_count FROM daily_tasks WHERE id=kingdom_task_progress.task_id);

  INSERT INTO kingdom_achievement_progress(kingdom_id,achievement_id,progress)
  SELECT NEW.kingdom_id,a.id,
    CASE a.progress_field
      WHEN 'quantity' THEN MAX(0,CAST(COALESCE(json_extract(NEW.payload_json,'$.quantity'),0) AS INTEGER))
      WHEN 'amount' THEN MAX(0,CAST(COALESCE(json_extract(NEW.payload_json,'$.amount'),0) AS INTEGER))
      ELSE 1
    END
  FROM achievement_catalog a
  WHERE a.active=1 AND a.event_type=NEW.event_type
  ON CONFLICT(kingdom_id,achievement_id) DO UPDATE SET
    progress=MIN(
      (SELECT requirement_value FROM achievement_catalog WHERE id=excluded.achievement_id),
      kingdom_achievement_progress.progress+excluded.progress
    ),
    completed=CASE WHEN MIN(
      (SELECT requirement_value FROM achievement_catalog WHERE id=excluded.achievement_id),
      kingdom_achievement_progress.progress+excluded.progress
    ) >= (SELECT requirement_value FROM achievement_catalog WHERE id=excluded.achievement_id) THEN 1 ELSE 0 END,
    completed_at=CASE WHEN MIN(
      (SELECT requirement_value FROM achievement_catalog WHERE id=excluded.achievement_id),
      kingdom_achievement_progress.progress+excluded.progress
    ) >= (SELECT requirement_value FROM achievement_catalog WHERE id=excluded.achievement_id)
      THEN COALESCE(kingdom_achievement_progress.completed_at,unixepoch())
      ELSE kingdom_achievement_progress.completed_at END,
    updated_at=unixepoch();

  UPDATE kingdom_achievement_progress
  SET completed=1,completed_at=COALESCE(completed_at,unixepoch()),updated_at=unixepoch()
  WHERE kingdom_id=NEW.kingdom_id
    AND achievement_id IN (SELECT id FROM achievement_catalog WHERE event_type=NEW.event_type AND active=1)
    AND progress >= (SELECT requirement_value FROM achievement_catalog WHERE id=kingdom_achievement_progress.achievement_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_battle_report_meta_event
AFTER INSERT ON battle_reports
WHEN NEW.winner_kingdom_id IS NOT NULL AND NEW.winner_kingdom_id=NEW.attacker_kingdom_id
BEGIN
  INSERT INTO kingdom_events(kingdom_id,event_type,payload_json)
  VALUES(
    NEW.attacker_kingdom_id,
    'battle_won',
    json_object('battle_id',NEW.id,'battle_type',NEW.battle_type,'attacker_power',NEW.attacker_power)
  );
END;
