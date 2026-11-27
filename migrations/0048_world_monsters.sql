-- Additive monster spawns, separate from capturable territories and resource nodes.
-- Preview only; no production rewards, attacks, or player ownership.
CREATE TABLE IF NOT EXISTS world_monsters (
 id INTEGER PRIMARY KEY,
 map_region INTEGER NOT NULL CHECK(map_region BETWEEN 1 AND 3),
 spawn_key TEXT NOT NULL,
 monster_key TEXT NOT NULL,
 name TEXT NOT NULL,
 level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 30),
 x INTEGER NOT NULL CHECK(x BETWEEN -50 AND 50),
 z INTEGER NOT NULL CHECK(z BETWEEN -45 AND 45),
 max_hp INTEGER NOT NULL CHECK(max_hp>0),
 hp INTEGER NOT NULL CHECK(hp>=0 AND hp<=max_hp),
 respawn_at INTEGER NOT NULL DEFAULT 0 CHECK(respawn_at>=0),
 generation INTEGER NOT NULL DEFAULT 1 CHECK(generation>=1),
 UNIQUE(map_region,spawn_key)
);
INSERT OR IGNORE INTO world_monsters(map_region,spawn_key,monster_key,name,level,x,z,max_hp,hp)
SELECT r.region,s.spawn_key,s.monster_key,s.name,s.level,s.x,s.z,s.hp,s.hp
FROM (SELECT 1 region UNION ALL SELECT 2 UNION ALL SELECT 3) r
CROSS JOIN (
 SELECT 'wolf_north' spawn_key,'ash_wolf' monster_key,'Lobo das Cinzas' name,1 level,-12 x,24 z,240 hp
 UNION ALL SELECT 'boar_east','iron_boar','Javali de Ferro',3,22,-8,720
 UNION ALL SELECT 'bear_west','frost_bear','Urso da Geada',5,-28,2,1500
 UNION ALL SELECT 'wyrm_south','marsh_wyrm','Serpe do Pântano',8,8,-34,3200
 UNION ALL SELECT 'golem_north','stone_golem','Guardião de Pedra',12,3,35,7200
 UNION ALL SELECT 'drake_east','ember_drake','Draco das Brasas',18,42,6,18000
) s;
