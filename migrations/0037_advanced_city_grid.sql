-- Cidade 4X: extensão aditiva dos reinos existentes, sem recriar economias.
-- Os edifícios originais permanecem em kingdom_buildings e suas filas originais.
CREATE TABLE IF NOT EXISTS city_building_types(
 type TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('core','resource','military','defense')),
 width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 5),
 height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 5),
 cost_wood INTEGER NOT NULL DEFAULT 0 CHECK(cost_wood>=0),
 cost_stone INTEGER NOT NULL DEFAULT 0 CHECK(cost_stone>=0),
 cost_iron INTEGER NOT NULL DEFAULT 0 CHECK(cost_iron>=0),
 cost_food INTEGER NOT NULL DEFAULT 0 CHECK(cost_food>=0),
 build_seconds INTEGER NOT NULL DEFAULT 60 CHECK(build_seconds>=0),
 workers_required INTEGER NOT NULL DEFAULT 0 CHECK(workers_required BETWEEN 0 AND 10),
 input_resource TEXT,
 output_resource TEXT,
 input_rate INTEGER NOT NULL DEFAULT 0,
 output_rate INTEGER NOT NULL DEFAULT 0,
 defense_power INTEGER NOT NULL DEFAULT 0,
 damage INTEGER NOT NULL DEFAULT 0,
 attack_range INTEGER NOT NULL DEFAULT 0,
 attack_speed REAL NOT NULL DEFAULT 0,
 placeable INTEGER NOT NULL DEFAULT 0 CHECK(placeable IN (0,1))
);
INSERT OR IGNORE INTO city_building_types(type,name,category,width,height,workers_required,input_resource,output_resource,input_rate,output_rate) VALUES
 ('castle','Castelo','core',5,5,0,NULL,NULL,0,0),
 ('barracks','Quartel','military',3,3,0,NULL,NULL,0,0),
 ('farm','Fazenda','resource',2,2,1,NULL,'wheat',0,100),
 ('quarry','Pedreira','resource',2,2,0,NULL,NULL,0,0),
 ('lumber_mill','Serraria','resource',2,2,0,NULL,NULL,0,0),
 ('iron_mine','Mina de ferro','resource',2,2,2,NULL,'iron_ore',0,40),
 ('market','Mercado','resource',3,3,0,NULL,NULL,0,0),
 ('academy','Academia','military',3,3,0,NULL,NULL,0,0),
 ('wall','Muralha principal','defense',3,2,0,NULL,NULL,0,0),
 ('hospital','Hospital','core',3,2,0,NULL,NULL,0,0),
 ('watchtower','Torre de vigia','defense',2,2,0,NULL,NULL,0,0),
 ('stable','Estábulo','military',3,2,0,NULL,NULL,0,0),
 ('archery_range','Campo de arqueiros','military',3,2,0,NULL,NULL,0,0),
 ('siege_workshop','Oficina de cerco','military',3,3,0,NULL,NULL,0,0),
 ('embassy','Embaixada','core',2,2,0,NULL,NULL,0,0),
 ('warehouse','Armazém','resource',3,2,0,NULL,NULL,0,0);
INSERT OR IGNORE INTO city_building_types(type,name,category,width,height,cost_wood,cost_stone,cost_iron,cost_food,build_seconds,workers_required,input_resource,output_resource,input_rate,output_rate,defense_power,damage,attack_range,attack_speed,placeable) VALUES
 ('house','Casa','core',2,2,150,50,0,0,45,0,NULL,NULL,0,0,0,0,0,0,1),
 ('mill','Moinho','resource',2,2,250,100,0,0,75,1,'wheat','flour',100,80,0,0,0,0,1),
 ('bakery','Padaria','resource',2,2,300,100,0,0,90,1,'flour','food',80,60,0,0,0,0,1),
 ('smelter','Fundição','resource',2,2,400,200,0,0,120,2,'iron_ore','iron',40,30,0,0,0,0,1),
 ('forge','Forja','military',2,2,400,200,100,0,120,2,'iron','weapons',30,20,0,0,0,0,1),
 ('blacksmith','Ferreiro','military',2,2,300,200,0,0,120,0,NULL,NULL,0,0,0,0,0,0,1),
 ('arrow_tower','Torre de arqueiros','defense',1,1,100,150,0,0,60,0,NULL,NULL,0,0,50,50,10,2,1),
 ('cannon_tower','Torre de canhão','defense',1,1,200,300,100,0,120,0,NULL,NULL,0,0,140,150,12,0.5,1),
 ('trap_spikes','Armadilha de espinhos','defense',1,1,50,0,50,0,30,0,NULL,NULL,0,0,25,200,1,0,1),
 ('trap_boulder','Armadilha de pedra','defense',1,1,150,200,0,0,60,0,NULL,NULL,0,0,45,500,1,0,1),
 ('oil_pot','Caldeirão de óleo','defense',1,1,80,100,0,0,50,0,NULL,NULL,0,0,35,100,3,1,1),
 ('gate','Portão','defense',2,1,200,300,0,0,90,0,NULL,NULL,0,0,75,0,0,0,1),
 ('wall_segment','Segmento de muralha','defense',1,1,50,100,0,0,30,0,NULL,NULL,0,0,20,0,0,0,1);

CREATE TABLE IF NOT EXISTS city_structures(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 building_type TEXT NOT NULL REFERENCES city_building_types(type),
 core_building_type TEXT,
 request_key TEXT UNIQUE,
 grid_x INTEGER NOT NULL CHECK(grid_x BETWEEN 0 AND 49),
 grid_y INTEGER NOT NULL CHECK(grid_y BETWEEN 0 AND 49),
 width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 5),
 height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 5),
 rotation INTEGER NOT NULL DEFAULT 0 CHECK(rotation IN (0,90,180,270)),
 workers_assigned INTEGER NOT NULL DEFAULT 0 CHECK(workers_assigned BETWEEN 0 AND 10),
 finishes_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 cost_wood INTEGER NOT NULL DEFAULT 0,
 cost_stone INTEGER NOT NULL DEFAULT 0,
 cost_iron INTEGER NOT NULL DEFAULT 0,
 cost_food INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(grid_x+width<=50 AND grid_y+height<=50)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_city_core_structure
 ON city_structures(kingdom_id,core_building_type) WHERE core_building_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_city_structure_rect
 ON city_structures(kingdom_id,grid_x,grid_y);
-- Integridade no banco: duas requisições concorrentes não podem ocupar as mesmas células.
CREATE TRIGGER IF NOT EXISTS city_structures_insert_no_overlap
 BEFORE INSERT ON city_structures
 WHEN EXISTS(
  SELECT 1 FROM city_structures other
  WHERE other.kingdom_id=NEW.kingdom_id
   AND other.grid_x<NEW.grid_x+NEW.width AND other.grid_x+other.width>NEW.grid_x
   AND other.grid_y<NEW.grid_y+NEW.height AND other.grid_y+other.height>NEW.grid_y
 )
 OR EXISTS(
  SELECT 1 FROM kingdom_buildings kb
  JOIN city_building_types cfg ON cfg.type=kb.building_type
  WHERE kb.kingdom_id=NEW.kingdom_id
    AND kb.position_x+25<NEW.grid_x+NEW.width
    AND kb.position_x+25+cfg.width>NEW.grid_x
    AND kb.position_z+25<NEW.grid_y+NEW.height
    AND kb.position_z+25+cfg.height>NEW.grid_y
 )
 BEGIN SELECT RAISE(ABORT,'city_cell_occupied'); END;
CREATE TRIGGER IF NOT EXISTS city_structures_move_no_overlap
 BEFORE UPDATE OF grid_x,grid_y,width,height ON city_structures
 WHEN EXISTS(
  SELECT 1 FROM city_structures other
  WHERE other.kingdom_id=NEW.kingdom_id AND other.id<>OLD.id
   AND other.grid_x<NEW.grid_x+NEW.width AND other.grid_x+other.width>NEW.grid_x
   AND other.grid_y<NEW.grid_y+NEW.height AND other.grid_y+other.height>NEW.grid_y
 )
 OR EXISTS(
  SELECT 1 FROM kingdom_buildings kb
  JOIN city_building_types cfg ON cfg.type=kb.building_type
  WHERE kb.kingdom_id=NEW.kingdom_id
    AND kb.position_x+25<NEW.grid_x+NEW.width
    AND kb.position_x+25+cfg.width>NEW.grid_x
    AND kb.position_z+25<NEW.grid_y+NEW.height
    AND kb.position_z+25+cfg.height>NEW.grid_y
 )
 BEGIN SELECT RAISE(ABORT,'city_cell_occupied'); END;

CREATE TABLE IF NOT EXISTS city_population(
 kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
 happiness INTEGER NOT NULL DEFAULT 100 CHECK(happiness BETWEEN 0 AND 100)
);
-- O posicionamento dos edifícios originais continua somente em kingdom_buildings.
-- A camada avançada guarda apenas a alocação de operários dos edifícios originais.
CREATE TABLE IF NOT EXISTS city_core_workers(
 kingdom_id INTEGER NOT NULL,
 building_type TEXT NOT NULL,
 workers_assigned INTEGER NOT NULL DEFAULT 0 CHECK(workers_assigned BETWEEN 0 AND 10),
 PRIMARY KEY(kingdom_id,building_type),
 FOREIGN KEY(kingdom_id,building_type) REFERENCES kingdom_buildings(kingdom_id,building_type) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS city_stock(
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 resource TEXT NOT NULL CHECK(resource IN ('wheat','flour','iron_ore','weapons','food_credit','iron_credit')),
 quantity_milli INTEGER NOT NULL DEFAULT 0 CHECK(quantity_milli>=0),
 PRIMARY KEY(kingdom_id,resource)
);
CREATE TABLE IF NOT EXISTS city_economy_clock(
 kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id) ON DELETE CASCADE,
 last_tick_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 claim_token TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO city_population(kingdom_id) SELECT id FROM kingdoms;
INSERT OR IGNORE INTO city_economy_clock(kingdom_id) SELECT id FROM kingdoms;
INSERT OR IGNORE INTO city_stock(kingdom_id,resource)
 SELECT k.id,r.column1 FROM kingdoms k CROSS JOIN
 (VALUES ('wheat'),('flour'),('iron_ore'),('weapons'),('food_credit'),('iron_credit')) AS r;
-- Somente trabalhadores: nenhuma cópia das posições originais é gravada.
INSERT OR IGNORE INTO city_core_workers(kingdom_id,building_type)
 SELECT kingdom_id,building_type FROM kingdom_buildings
 WHERE building_type IN ('farm','iron_mine');
