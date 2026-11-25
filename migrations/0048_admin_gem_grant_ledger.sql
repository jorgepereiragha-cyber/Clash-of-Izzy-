-- 0048: trilha idempotente para creditos manuais de gemas do Painel Master.
-- A migracao cria apenas uma tabela; nao altera saldos nem registros existentes.
CREATE TABLE IF NOT EXISTS admin_gem_grants (
  request_key TEXT PRIMARY KEY CHECK(length(request_key) BETWEEN 16 AND 80),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 200),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_gem_grants_player_created
  ON admin_gem_grants(player_id,created_at DESC);
