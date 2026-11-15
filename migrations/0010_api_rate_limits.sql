-- Atomic per-IP, per-player and per-account API rate limits.
-- Raw IP addresses and account identifiers are never stored.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expiry
  ON api_rate_limits(expires_at);
