-- Referral attribution for newly founded kingdoms.
-- No premium currency or seasonal runes are credited by this migration.
CREATE TABLE IF NOT EXISTS referral_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  referred_player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (referrer_player_id <> referred_player_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer
  ON referral_tracking(referrer_player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_created
  ON referral_tracking(created_at DESC);
