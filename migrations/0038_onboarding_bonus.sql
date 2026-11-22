-- Bônus de tutorial uma única vez, após ações reais registradas no D1.
CREATE TABLE IF NOT EXISTS onboarding_bonus_claims(
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
