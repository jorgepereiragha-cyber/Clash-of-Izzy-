-- Atomic API rate limits for login and kingdom creation.
-- Identifiers are HMAC digests; raw IPs and email addresses are never persisted.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expiry
  ON api_rate_limits(expires_at);
