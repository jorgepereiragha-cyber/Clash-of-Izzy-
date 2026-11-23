-- Exclusivo do banco D1 beta. NAO aplicar em producao ou preview.
-- Aplicar somente depois das migrations comuns e da confirmacao do UUID beta.
CREATE TABLE IF NOT EXISTS beta_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 100),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at INTEGER,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS beta_access_sessions (
  session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
  invite_id INTEGER NOT NULL REFERENCES beta_invites(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS beta_sessions_expiry ON beta_access_sessions(expires_at);
CREATE TABLE IF NOT EXISTS beta_redeem_attempts (
  source_hash TEXT NOT NULL CHECK (length(source_hash) = 64),
  time_bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1 CHECK (hits > 0),
  PRIMARY KEY(source_hash, time_bucket)
);
