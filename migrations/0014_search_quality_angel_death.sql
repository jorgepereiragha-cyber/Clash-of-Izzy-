-- Search quality indexes and the persistent weekend Anjo da Morte event.
-- Existing source tables and the original FTS5 index remain authoritative.
CREATE VIRTUAL TABLE IF NOT EXISTS game_search_substring_fts USING fts5(
  title, subtitle,
  content='game_search_documents',
  content_rowid='id',
  tokenize='trigram remove_diacritics 1'
);
CREATE TRIGGER IF NOT EXISTS game_search_substring_ai AFTER INSERT ON game_search_documents BEGIN
  INSERT INTO game_search_substring_fts(rowid,title,subtitle) VALUES(new.id,new.title,new.subtitle);
END;
CREATE TRIGGER IF NOT EXISTS game_search_substring_ad AFTER DELETE ON game_search_documents BEGIN
  INSERT INTO game_search_substring_fts(game_search_substring_fts,rowid,title,subtitle) VALUES('delete',old.id,old.title,old.subtitle);
END;
CREATE TRIGGER IF NOT EXISTS game_search_substring_au AFTER UPDATE ON game_search_documents BEGIN
  INSERT INTO game_search_substring_fts(game_search_substring_fts,rowid,title,subtitle) VALUES('delete',old.id,old.title,old.subtitle);
  INSERT INTO game_search_substring_fts(rowid,title,subtitle) VALUES(new.id,new.title,new.subtitle);
END;
INSERT INTO game_search_substring_fts(game_search_substring_fts) VALUES('rebuild');

CREATE VIRTUAL TABLE IF NOT EXISTS game_player_search_fts USING fts5(
  nickname,
  content='player_nicknames',
  content_rowid='player_id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3 4'
);
CREATE VIRTUAL TABLE IF NOT EXISTS game_player_substring_fts USING fts5(
  nickname,
  content='player_nicknames',
  content_rowid='player_id',
  tokenize='trigram remove_diacritics 1'
);
CREATE TRIGGER IF NOT EXISTS game_player_search_ai AFTER INSERT ON player_nicknames BEGIN
  INSERT INTO game_player_search_fts(rowid,nickname) VALUES(new.player_id,new.nickname);
  INSERT INTO game_player_substring_fts(rowid,nickname) VALUES(new.player_id,new.nickname);
END;
CREATE TRIGGER IF NOT EXISTS game_player_search_au AFTER UPDATE OF nickname ON player_nicknames BEGIN
  INSERT INTO game_player_search_fts(game_player_search_fts,rowid,nickname) VALUES('delete',old.player_id,old.nickname);
  INSERT INTO game_player_search_fts(rowid,nickname) VALUES(new.player_id,new.nickname);
  INSERT INTO game_player_substring_fts(game_player_substring_fts,rowid,nickname) VALUES('delete',old.player_id,old.nickname);
  INSERT INTO game_player_substring_fts(rowid,nickname) VALUES(new.player_id,new.nickname);
END;
CREATE TRIGGER IF NOT EXISTS game_player_search_ad AFTER DELETE ON player_nicknames BEGIN
  INSERT INTO game_player_search_fts(game_player_search_fts,rowid,nickname) VALUES('delete',old.player_id,old.nickname);
  INSERT INTO game_player_substring_fts(game_player_substring_fts,rowid,nickname) VALUES('delete',old.player_id,old.nickname);
END;
INSERT INTO game_player_search_fts(game_player_search_fts) VALUES('rebuild');
INSERT INTO game_player_substring_fts(game_player_substring_fts) VALUES('rebuild');

CREATE TABLE IF NOT EXISTS world_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','active','completed')),
  boss_hp_total INTEGER NOT NULL CHECK(boss_hp_total > 0),
  boss_hp_remaining INTEGER NOT NULL CHECK(boss_hp_remaining >= 0),
  boss_defeated_at TEXT,
  rewards_distributed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_key,starts_at),
  CHECK(ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS world_event_participants (
  event_id INTEGER NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK(score >= 0),
  damage INTEGER NOT NULL DEFAULT 0 CHECK(damage >= 0),
  attacks INTEGER NOT NULL DEFAULT 0 CHECK(attacks >= 0),
  troops_lost INTEGER NOT NULL DEFAULT 0 CHECK(troops_lost >= 0),
  first_attack_at TEXT,
  last_attack_at TEXT,
  PRIMARY KEY(event_id,kingdom_id)
);
CREATE TABLE IF NOT EXISTS world_event_attacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  damage INTEGER NOT NULL CHECK(damage >= 0),
  score INTEGER NOT NULL CHECK(score >= 0),
  troop_losses_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id,kingdom_id,request_id)
);
CREATE TABLE IF NOT EXISTS world_event_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK(rank > 0),
  score INTEGER NOT NULL CHECK(score > 0),
  reward_json TEXT NOT NULL,
  paid_at TEXT,
  UNIQUE(event_id,kingdom_id)
);
CREATE INDEX IF NOT EXISTS idx_world_events_schedule ON world_events(event_key,status,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_world_event_participants_rank ON world_event_participants(event_id,score DESC,damage DESC,last_attack_at);
CREATE INDEX IF NOT EXISTS idx_world_event_attacks_player ON world_event_attacks(event_id,kingdom_id,created_at DESC);
