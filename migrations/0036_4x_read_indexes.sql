-- Índices de leitura 4X: sem alteração de dados, custos, saldos ou regras.
-- A listagem de relatórios usa attacker_kingdom_id OR defender_kingdom_id;
-- já existe índice por atacante; este atende o outro lado do predicado.
CREATE INDEX IF NOT EXISTS idx_battle_reports_defender_recent
 ON battle_reports(defender_kingdom_id,id DESC);

-- Reivindicações e consultas do mapa por região e proprietário.
CREATE INDEX IF NOT EXISTS idx_world_territories_region_owner
 ON world_territories(map_region,owner_kingdom_id,territory_kind);
