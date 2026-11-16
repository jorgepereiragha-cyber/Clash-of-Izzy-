-- Clash of Izzy 0025: mapa de reinos, filas duplas, economia protegida,
-- defesa estrutural e auditoria. Nenhuma tabela de jogadores/reinos é recriada.
PRAGMA foreign_keys = ON;

ALTER TABLE kingdoms ADD COLUMN map_x INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kingdoms ADD COLUMN map_z INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kingdoms ADD COLUMN map_region INTEGER NOT NULL DEFAULT 1 CHECK (map_region >= 1);

ALTER TABLE kingdoms ADD COLUMN food_capacity INTEGER NOT NULL DEFAULT 50000 CHECK (food_capacity >= 0);
ALTER TABLE kingdoms ADD COLUMN wood_capacity INTEGER NOT NULL DEFAULT 50000 CHECK (wood_capacity >= 0);
ALTER TABLE kingdoms ADD COLUMN stone_capacity INTEGER NOT NULL DEFAULT 30000 CHECK (stone_capacity >= 0);
ALTER TABLE kingdoms ADD COLUMN iron_capacity INTEGER NOT NULL DEFAULT 25000 CHECK (iron_capacity >= 0);
ALTER TABLE kingdoms ADD COLUMN gold_capacity INTEGER NOT NULL DEFAULT 20000 CHECK (gold_capacity >= 0);

ALTER TABLE kingdoms ADD COLUMN wall_hp INTEGER NOT NULL DEFAULT 10000 CHECK (wall_hp >= 0);
ALTER TABLE kingdoms ADD COLUMN wall_max_hp INTEGER NOT NULL DEFAULT 10000 CHECK (wall_max_hp >= 1);
ALTER TABLE kingdoms ADD COLUMN defense_power INTEGER NOT NULL DEFAULT 100 CHECK (defense_power >= 0);

ALTER TABLE kingdom_queues ADD COLUMN queue_slot INTEGER NOT NULL DEFAULT 1 CHECK (queue_slot BETWEEN 1 AND 2);
DROP INDEX IF EXISTS idx_kingdom_queues_one_active_lane;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdom_queues_active_lane_slot
  ON kingdom_queues(kingdom_id, queue_type, queue_slot)
  WHERE status='running';

ALTER TABLE world_territories ADD COLUMN territory_kind TEXT NOT NULL DEFAULT 'resource'
  CHECK (territory_kind IN ('resource','castle'));

-- Distribui os reinos existentes em uma grade persistente. Cada região contém
-- 400 posições únicas; o mapa local calcula as posições relativas ao jogador.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS slot
  FROM kingdoms
)
UPDATE kingdoms
SET map_x = ((SELECT slot FROM ranked WHERE ranked.id=kingdoms.id) % 20 - 10) * 5,
    map_z = (CAST((SELECT slot FROM ranked WHERE ranked.id=kingdoms.id) / 20 AS INTEGER) % 20 - 10) * 5,
    map_region = CAST((SELECT slot FROM ranked WHERE ranked.id=kingdoms.id) / 400 AS INTEGER) + 1;

-- Capacidades iniciais nunca ficam abaixo dos recursos já guardados.
UPDATE kingdoms SET
  food_capacity = MAX(food_capacity, food, 50000),
  wood_capacity = MAX(wood_capacity, wood, 50000),
  stone_capacity = MAX(stone_capacity, stone, 30000),
  iron_capacity = MAX(iron_capacity, iron, 25000),
  gold_capacity = MAX(gold_capacity, gold, 20000);

-- Defesa inicial coerente com os edifícios existentes.
UPDATE kingdoms SET
  wall_max_hp = 5000 + COALESCE((SELECT level FROM kingdom_buildings b WHERE b.kingdom_id=kingdoms.id AND b.building_type='wall'),1) * 5000,
  wall_hp = 5000 + COALESCE((SELECT level FROM kingdom_buildings b WHERE b.kingdom_id=kingdoms.id AND b.building_type='wall'),1) * 5000,
  defense_power = 50
    + COALESCE((SELECT level FROM kingdom_buildings b WHERE b.kingdom_id=kingdoms.id AND b.building_type='wall'),1) * 40
    + COALESCE((SELECT level FROM kingdom_buildings b WHERE b.kingdom_id=kingdoms.id AND b.building_type='watchtower'),0) * 50
    + castle_level * 10;

-- Cada reino vira um marco de castelo no mapa compartilhado.
INSERT OR IGNORE INTO world_territories(
  territory_key,name,terrain,x,z,owner_kingdom_id,level,resource_type,resource_rate,territory_kind
)
SELECT
  'kingdom_castle_' || k.id,
  'Castelo de ' || k.kingdom_name,
  'plains',k.map_x,k.map_z,k.id,k.castle_level,'castle',0,'castle'
FROM kingdoms k;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdoms_map_position
  ON kingdoms(map_region,map_x,map_z);
CREATE INDEX IF NOT EXISTS idx_world_territories_kind_owner
  ON world_territories(territory_kind,owner_kingdom_id);
CREATE INDEX IF NOT EXISTS idx_world_territories_coords
  ON world_territories(x,z);

CREATE TABLE IF NOT EXISTS action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_logs_kingdom_created
  ON action_logs(kingdom_id,created_at DESC);

-- Enforce warehouse capacity for every gameplay mutation, not only passive ticks.
-- This prevents loot, shop purchases and alliance rewards from bypassing storage limits.
CREATE TRIGGER IF NOT EXISTS trg_kingdom_food_capacity
AFTER UPDATE OF food ON kingdoms
WHEN NEW.food > NEW.food_capacity
BEGIN
  UPDATE kingdoms SET food=NEW.food_capacity WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kingdom_wood_capacity
AFTER UPDATE OF wood ON kingdoms
WHEN NEW.wood > NEW.wood_capacity
BEGIN
  UPDATE kingdoms SET wood=NEW.wood_capacity WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kingdom_stone_capacity
AFTER UPDATE OF stone ON kingdoms
WHEN NEW.stone > NEW.stone_capacity
BEGIN
  UPDATE kingdoms SET stone=NEW.stone_capacity WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kingdom_iron_capacity
AFTER UPDATE OF iron ON kingdoms
WHEN NEW.iron > NEW.iron_capacity
BEGIN
  UPDATE kingdoms SET iron=NEW.iron_capacity WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kingdom_gold_capacity
AFTER UPDATE OF gold ON kingdoms
WHEN NEW.gold > NEW.gold_capacity
BEGIN
  UPDATE kingdoms SET gold=NEW.gold_capacity WHERE id=NEW.id;
END;
