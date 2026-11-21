-- Clash of Izzy 0026: keep every player castle in the single shared realm.
-- The old layout started a new map_region every 400 kingdoms. Reposition only
-- map coordinates; ownership, troops, resources, buildings and progression stay intact.
PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS idx_kingdoms_map_position;

-- Use the kingdom ID as a stable global slot. The map expands in 20 columns
-- and continues with additional rows; no player is moved to another realm.
UPDATE kingdoms
SET map_x = (((id - 1) % 20) - 10) * 5,
    map_z = (CAST((id - 1) / 20 AS INTEGER) - 10) * 5,
    map_region = 1;

-- Keep each castle marker aligned with its owning kingdom's new coordinates.
UPDATE world_territories
SET x = (SELECT k.map_x FROM kingdoms k WHERE k.id = world_territories.owner_kingdom_id),
    z = (SELECT k.map_z FROM kingdoms k WHERE k.id = world_territories.owner_kingdom_id)
WHERE territory_kind = 'castle'
  AND owner_kingdom_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM kingdoms k WHERE k.id = world_territories.owner_kingdom_id);

-- map_region remains in the legacy schema but every kingdom must use region 1.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdoms_map_position
  ON kingdoms(map_region, map_x, map_z);
