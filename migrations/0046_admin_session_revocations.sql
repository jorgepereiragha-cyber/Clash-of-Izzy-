-- 0046: revogacao especifica de tokens administrativos, sem tocar em sessoes de jogadores.
-- D1 nao armazena tokens, apenas IDs aleatorios de sessao para impedir reuso.
CREATE TABLE IF NOT EXISTS admin_session_revocations (
  token_id TEXT PRIMARY KEY CHECK(length(token_id)=32),
  expires_at INTEGER NOT NULL CHECK(expires_at>0),
  revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_session_revocations_expiry
  ON admin_session_revocations(expires_at);
