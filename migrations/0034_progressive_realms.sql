-- Eldoria 0034: mapas progressivos 1 aberto, 2 >=700 reinos, 3 >=1000.
-- NÃO move castelos/reinos antigos, não apaga personagens e não muda pagamentos.
PRAGMA foreign_keys=ON;
ALTER TABLE kingdoms ADD COLUMN map_slot INTEGER;
-- A migration 0026 colocou todos os castelos legados no mundo 1 usando (id-1).
UPDATE kingdoms SET map_slot=id-1 WHERE map_slot IS NULL AND map_region=1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdoms_region_slot ON kingdoms(map_region,map_slot);
CREATE TABLE IF NOT EXISTS realm_openings(
 realm_id INTEGER PRIMARY KEY CHECK(realm_id BETWEEN 1 AND 3),
 unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO realm_openings(realm_id) VALUES(1);
INSERT OR IGNORE INTO realm_openings(realm_id)
 SELECT 2 WHERE (SELECT COUNT(*) FROM kingdoms)>=700;
INSERT OR IGNORE INTO realm_openings(realm_id)
 SELECT 3 WHERE (SELECT COUNT(*) FROM kingdoms)>=1000;
-- Territórios são identificados pelo mundo; isto evita ver/interagir com
-- castelos e pontos de coleta de outro servidor.
ALTER TABLE world_territories ADD COLUMN map_region INTEGER NOT NULL DEFAULT 1
 CHECK(map_region BETWEEN 1 AND 3);
UPDATE world_territories SET map_region=(
 SELECT k.map_region FROM kingdoms k WHERE k.id=world_territories.owner_kingdom_id
) WHERE territory_kind='castle' AND owner_kingdom_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_world_territories_region_kind_coords
 ON world_territories(map_region,territory_kind,x,z);
