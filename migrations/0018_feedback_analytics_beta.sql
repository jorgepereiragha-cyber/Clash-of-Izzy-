-- Incremental support for beta consent, gameplay telemetry and player feedback.
-- Existing identities are retained: public player_id resolves to players.id (INTEGER).
-- No legacy table is rebuilt or altered.

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (length(event) BETWEEN 2 AND 80),
  session_id TEXT CHECK (session_id IS NULL OR length(session_id) <= 80),
  data_json TEXT CHECK (data_json IS NULL OR length(data_json) <= 4096),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_player_created
  ON analytics_events(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_created
  ON analytics_events(event, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT CHECK (text IS NULL OR length(text) <= 2000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created
  ON feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_player_created
  ON feedback(player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS beta_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(email) BETWEEN 6 AND 254),
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL DEFAULT 'beta-2026-11',
  invited INTEGER NOT NULL DEFAULT 0 CHECK (invited IN (0,1)),
  beta_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_beta_signups_created
  ON beta_signups(created_at DESC);
