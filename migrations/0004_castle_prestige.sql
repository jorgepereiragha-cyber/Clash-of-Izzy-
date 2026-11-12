-- Prestígio permanente do castelo (1 a 7)
ALTER TABLE kingdoms ADD COLUMN prestige INTEGER NOT NULL DEFAULT 0 CHECK (prestige BETWEEN 0 AND 7);
