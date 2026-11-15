-- Account-bound, server-authoritative narrative discoveries.
CREATE TABLE IF NOT EXISTS kingdom_story_progress (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  campaign_key TEXT NOT NULL,
  step_key TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kingdom_id, campaign_key, step_key)
);
CREATE INDEX IF NOT EXISTS idx_story_progress_campaign
  ON kingdom_story_progress(kingdom_id, campaign_key, completed_at);
