-- Google sign-in links an existing Clash of Izzy player to one stable Google subject.
-- Password accounts remain valid; the same Google account cannot belong to two players.
-- The nonce is one-use and has a 5-minute expiry. No Google e-mail or tokens are stored.
CREATE TABLE IF NOT EXISTS google_account_links (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  google_sub TEXT NOT NULL UNIQUE CHECK(length(google_sub) BETWEEN 6 AND 64),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK(session_version >= 1),
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS google_auth_challenges (
  nonce TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK(purpose IN ('link','login')),
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((purpose='link' AND player_id IS NOT NULL) OR (purpose='login' AND player_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_google_auth_challenges_expiry ON google_auth_challenges(expires_at);
