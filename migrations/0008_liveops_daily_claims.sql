-- Daily LiveOps claims. Progress is derived from existing authoritative game logs.
CREATE TABLE IF NOT EXISTS liveops_daily_claims (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  credited_at TEXT,
  PRIMARY KEY (kingdom_id, cycle_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_liveops_daily_claims_cycle
  ON liveops_daily_claims(cycle_id, kingdom_id);

-- Composite indexes keep daily mission progress queries bounded as the event log grows.
CREATE INDEX IF NOT EXISTS idx_events_kingdom_type_created
  ON kingdom_events(kingdom_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_battles_attacker_type_created
  ON battle_reports(attacker_kingdom_id, battle_type, created_at);
