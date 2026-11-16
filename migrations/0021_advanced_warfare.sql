-- Clash of Izzy v2.0: nós de recursos, rallies e catálogo de tecnologias.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS resource_nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL CHECK (node_type IN ('mine','forest','farm','quarry')),
  map_x INTEGER NOT NULL,
  map_y INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  current_resources INTEGER NOT NULL CHECK (current_resources >= 0),
  max_resources INTEGER NOT NULL CHECK (max_resources > 0),
  regen_rate INTEGER NOT NULL CHECK (regen_rate >= 0),
  occupied_by INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
  occupation_start INTEGER,
  garrison_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(garrison_json)),
  reserved_by_rally TEXT,
  last_regen INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (map_x,map_y)
);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_coords ON resource_nodes(map_x,map_y);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_owner ON resource_nodes(occupied_by);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_available ON resource_nodes(occupied_by,reserved_by_rally);

CREATE TABLE IF NOT EXISTS rallies (
  id TEXT PRIMARY KEY,
  leader_kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'resource_node' CHECK (target_type='resource_node'),
  target_id TEXT NOT NULL REFERENCES resource_nodes(id),
  status TEXT NOT NULL DEFAULT 'gathering' CHECK (status IN ('gathering','marching','completed','cancelled')),
  total_power INTEGER NOT NULL DEFAULT 0 CHECK (total_power >= 0),
  rally_duration INTEGER NOT NULL DEFAULT 300 CHECK (rally_duration BETWEEN 60 AND 900),
  departure_time INTEGER NOT NULL,
  arrival_time INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rallies_status_departure ON rallies(status,departure_time,arrival_time);
CREATE INDEX IF NOT EXISTS idx_rallies_alliance_status ON rallies(alliance_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS rally_reinforcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id TEXT NOT NULL REFERENCES rallies(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  troop_data TEXT NOT NULL CHECK (json_valid(troop_data)),
  hero_id INTEGER REFERENCES heroes(id) ON DELETE SET NULL,
  power INTEGER NOT NULL CHECK (power >= 0),
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (rally_id,kingdom_id)
);
CREATE INDEX IF NOT EXISTS idx_rally_reinforcements_rally ON rally_reinforcements(rally_id);

CREATE TABLE IF NOT EXISTS tech_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('military','defense','economy')),
  max_level INTEGER NOT NULL DEFAULT 10 CHECK (max_level BETWEEN 1 AND 10),
  base_cost_gold INTEGER NOT NULL CHECK (base_cost_gold >= 0),
  base_research_time INTEGER NOT NULL CHECK (base_research_time > 0),
  prerequisite_tech TEXT REFERENCES tech_catalog(id),
  effect_json TEXT NOT NULL CHECK (json_valid(effect_json))
);

CREATE TABLE IF NOT EXISTS kingdom_tech (
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  tech_id TEXT NOT NULL REFERENCES tech_catalog(id),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 10),
  research_end_time INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kingdom_id,tech_id)
);

INSERT OR IGNORE INTO tech_catalog
  (id,name,description,category,max_level,base_cost_gold,base_research_time,prerequisite_tech,effect_json)
VALUES
 ('warrior_training','Treinamento de Guerreiros','+5% ataque de infantaria por nível','military',10,500,300,NULL,'{"infantry_attack":0.05}'),
 ('horsebreeding','Criação de Cavalos','+5% ataque de cavalaria por nível','military',10,600,360,NULL,'{"cavalry_attack":0.05}'),
 ('archery_mastery','Maestria em Arqueria','+5% ataque de arqueiros por nível','military',10,550,330,NULL,'{"archer_attack":0.05}'),
 ('fortification','Fortificação','+3% defesa de muralhas por nível','defense',10,700,420,NULL,'{"wall_defense":0.03}'),
 ('logistics','Logística','+2% velocidade de marcha por nível','military',10,800,480,'warrior_training','{"march_speed":0.02}'),
 ('agriculture','Agricultura','+10% produção de comida por nível','economy',10,400,240,NULL,'{"food_production":0.10}'),
 ('mining','Mineração','+10% produção de pedra por nível','economy',10,450,270,NULL,'{"stone_production":0.10}'),
 ('lumberjack','Lenhador','+10% produção de madeira por nível','economy',10,420,250,NULL,'{"wood_production":0.10}');

-- Seed determinístico de 100 nós dentro da área efetiva do mapa 3D.
-- A migração pode ser reaplicada com segurança: IDs e coordenadas são estáveis.
WITH RECURSIVE seq(n) AS (
  SELECT 0
  UNION ALL SELECT n+1 FROM seq WHERE n<99
),
generated AS (
  SELECT
    n,
    CASE ((n*7+3)%4)
      WHEN 0 THEN 'mine' WHEN 1 THEN 'forest'
      WHEN 2 THEN 'farm' ELSE 'quarry'
    END AS node_type,
    ((n*13+7)%5)+1 AS node_level,
    ((n%10)*10)-45+((n*17)%5-2) AS x,
    ((n/10)*10)-45+((n*11)%5-2) AS y
  FROM seq
)
INSERT OR IGNORE INTO resource_nodes
  (id,node_type,map_x,map_y,level,current_resources,max_resources,regen_rate,last_regen)
SELECT
  printf('node_%03d',n+1),
  node_type,x,y,node_level,
  CAST((CASE node_type WHEN 'mine' THEN 5000 WHEN 'forest' THEN 8000 WHEN 'farm' THEN 10000 ELSE 6000 END)*node_level*0.8 AS INTEGER),
  (CASE node_type WHEN 'mine' THEN 5000 WHEN 'forest' THEN 8000 WHEN 'farm' THEN 10000 ELSE 6000 END)*node_level,
  (CASE node_type WHEN 'mine' THEN 200 WHEN 'forest' THEN 300 WHEN 'farm' THEN 400 ELSE 250 END)*node_level,
  unixepoch()
FROM generated;
