-- Clash of Izzy: expansão social persistente de alianças
ALTER TABLE alliance_members ADD COLUMN rank TEXT NOT NULL DEFAULT 'membro' CHECK (rank IN ('lider','co_lider','oficial','membro'));
ALTER TABLE alliance_members ADD COLUMN contribution INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliance_members ADD COLUMN help_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliance_members ADD COLUMN help_reset_at TEXT;
UPDATE alliance_members SET rank=CASE WHEN role='leader' THEN 'lider' WHEN role='officer' THEN 'oficial' ELSE 'membro' END;

ALTER TABLE alliances ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE alliances ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN shared_food INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN shared_wood INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN shared_stone INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN shared_iron INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN shared_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN territory_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alliances ADD COLUMN max_members INTEGER NOT NULL DEFAULT 50;

ALTER TABLE world_territories ADD COLUMN alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS alliance_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  target_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  invited_by_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alliance_id,target_kingdom_id)
);
CREATE TABLE IF NOT EXISTS alliance_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alliance_wars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alliance_a_id INTEGER NOT NULL REFERENCES alliances(id),
  alliance_b_id INTEGER NOT NULL REFERENCES alliances(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finished')),
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(alliance_a_id <> alliance_b_id)
);
CREATE TABLE IF NOT EXISTS alliance_war_battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  war_id INTEGER NOT NULL REFERENCES alliance_wars(id) ON DELETE CASCADE,
  attacker_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
  defender_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
  winner_kingdom_id INTEGER REFERENCES kingdoms(id),
  power_destroyed INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alliance_chat_recent ON alliance_chat(alliance_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_alliance_wars_active ON alliance_wars(status,ends_at);
CREATE INDEX IF NOT EXISTS idx_alliance_invites_target ON alliance_invites(target_kingdom_id);