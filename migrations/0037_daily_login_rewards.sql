-- Resgate diário com unicidade por jogador e data UTC; nenhum cliente informa saldo.
CREATE TABLE IF NOT EXISTS daily_reward_claims (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  claim_date TEXT NOT NULL,
  cycle_day INTEGER NOT NULL CHECK (cycle_day BETWEEN 1 AND 7),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(player_id, claim_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_latest ON daily_reward_claims(player_id, claim_date DESC);
