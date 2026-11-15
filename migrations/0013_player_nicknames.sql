-- Nicknames públicos únicos para descoberta de jogadores.
-- A identidade interna continua em players.player_id e nunca é exposta pela busca.
CREATE TABLE IF NOT EXISTS player_nicknames (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  nickname_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(nickname) BETWEEN 3 AND 20)
);
CREATE INDEX IF NOT EXISTS idx_player_nicknames_lookup ON player_nicknames(nickname_key);
