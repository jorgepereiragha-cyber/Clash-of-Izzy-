-- Preserva frações da produção passiva e acelera as consultas mais frequentes do reino.
ALTER TABLE kingdoms ADD COLUMN production_remainders TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_marches_kingdom_status_arrival
  ON marches(kingdom_id, status, arrives_at);

CREATE INDEX IF NOT EXISTS idx_marches_target_status
  ON marches(target_territory_id, status);

CREATE INDEX IF NOT EXISTS idx_battle_reports_attacker_id
  ON battle_reports(attacker_kingdom_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_kingdom_events_kingdom_id
  ON kingdom_events(kingdom_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_alliance_members_alliance_rank
  ON alliance_members(alliance_id, rank, contribution DESC);
