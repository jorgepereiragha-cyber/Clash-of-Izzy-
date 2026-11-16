-- Clash of Izzy — dados fictícios para DESENVOLVIMENTO LOCAL.
-- Use somente: npm run db:seed:local
-- NÃO execute em D1 remoto/produção. Não cria pagamentos ou gemas compradas.
-- Idempotente: chaves coi-local-seed-* podem ser mantidas e o arquivo reexecutado.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO players (player_id, name, gems) VALUES
('coi-local-seed-01', 'TESTE Viking Ragnar', 5000),
('coi-local-seed-02', 'TESTE Shield Maiden', 2500),
('coi-local-seed-03', 'TESTE Odin Hall', 10000),
('coi-local-seed-04', 'TESTE Freya Garden', 800),
('coi-local-seed-05', 'TESTE Loki Maze', 15000),
('coi-local-seed-06', 'TESTE Thor Hammer', 3500),
('coi-local-seed-07', 'TESTE Fenrir Wolf', 1200),
('coi-local-seed-08', 'TESTE Valhalla King', 20000),
('coi-local-seed-09', 'TESTE Rune Mystic', 600),
('coi-local-seed-10', 'TESTE Dragon Slayer', 7500);

WITH seed(player_key, kingdom_name, castle_level, power, food, wood, stone, iron, gold) AS (
  VALUES
  ('coi-local-seed-01','TESTE Fortaleza de Ragnar',8,45000,50000,45000,30000,12000,10000),
  ('coi-local-seed-02','TESTE Fortaleza do Escudo',6,38000,35000,30000,24000,9000,8000),
  ('coi-local-seed-03','TESTE Salão de Odin',12,120000,120000,100000,80000,35000,30000),
  ('coi-local-seed-04','TESTE Jardim de Freya',4,22000,24000,22000,16000,5000,5000),
  ('coi-local-seed-05','TESTE Labirinto de Loki',10,95000,90000,85000,65000,24000,22000),
  ('coi-local-seed-06','TESTE Pico do Trovão',8,55000,55000,50000,35000,15000,13000),
  ('coi-local-seed-07','TESTE Covil de Fenrir',5,28000,28000,25000,18000,7000,6000),
  ('coi-local-seed-08','TESTE Valhalla Prime',15,250000,180000,170000,140000,60000,50000),
  ('coi-local-seed-09','TESTE Santuário Rúnico',3,18000,18000,16000,12000,4000,4000),
  ('coi-local-seed-10','TESTE Covil do Dragão',9,72000,70000,65000,50000,20000,18000)
)
INSERT OR IGNORE INTO kingdoms
(player_id, kingdom_name, castle_level, power, food, wood, stone, iron, gold)
SELECT p.id, s.kingdom_name, s.castle_level, s.power, s.food, s.wood, s.stone, s.iron, s.gold
FROM seed s JOIN players p ON p.player_id=s.player_key;

WITH seed(player_key, building_type, level, x, z) AS (
  VALUES
  ('coi-local-seed-01','castle',8,0,0),('coi-local-seed-01','farm',6,-7,-7),('coi-local-seed-01','barracks',5,7,-7),('coi-local-seed-01','academy',4,-7,7),('coi-local-seed-01','lumber_mill',5,7,7),('coi-local-seed-01','quarry',4,0,14),('coi-local-seed-01','stable',3,14,0),
  ('coi-local-seed-02','castle',6,0,0),('coi-local-seed-02','farm',5,-7,-7),('coi-local-seed-02','barracks',4,7,-7),('coi-local-seed-02','archery_range',3,-7,7),
  ('coi-local-seed-03','castle',12,0,0),('coi-local-seed-03','farm',10,-7,-7),('coi-local-seed-03','barracks',10,7,-7),('coi-local-seed-03','academy',9,-7,7),('coi-local-seed-03','stable',8,7,7),('coi-local-seed-03','siege_workshop',6,0,14),
  ('coi-local-seed-04','castle',4,0,0),('coi-local-seed-04','farm',4,-7,-7),('coi-local-seed-04','lumber_mill',3,7,-7),
  ('coi-local-seed-05','castle',10,0,0),('coi-local-seed-05','farm',8,-7,-7),('coi-local-seed-05','barracks',8,7,-7),('coi-local-seed-05','academy',7,-7,7),('coi-local-seed-05','siege_workshop',5,7,7),
  ('coi-local-seed-06','castle',8,0,0),('coi-local-seed-06','farm',6,-7,-7),('coi-local-seed-06','stable',5,7,-7),('coi-local-seed-06','archery_range',5,-7,7),
  ('coi-local-seed-07','castle',5,0,0),('coi-local-seed-07','farm',4,-7,-7),('coi-local-seed-07','barracks',3,7,-7),
  ('coi-local-seed-08','castle',15,0,0),('coi-local-seed-08','farm',12,-7,-7),('coi-local-seed-08','barracks',12,7,-7),('coi-local-seed-08','academy',12,-7,7),('coi-local-seed-08','stable',10,7,7),('coi-local-seed-08','siege_workshop',9,0,14),
  ('coi-local-seed-09','castle',3,0,0),('coi-local-seed-09','farm',3,-7,-7),('coi-local-seed-09','barracks',2,7,-7),
  ('coi-local-seed-10','castle',9,0,0),('coi-local-seed-10','farm',7,-7,-7),('coi-local-seed-10','barracks',7,7,-7),('coi-local-seed-10','academy',6,-7,7),('coi-local-seed-10','archery_range',6,7,7)
)
INSERT OR IGNORE INTO kingdom_buildings (kingdom_id, building_type, level, position_x, position_z)
SELECT k.id, s.building_type, s.level, s.x, s.z
FROM seed s
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id;

WITH seed(player_key, unit_type, tier, quantity, wounded) AS (
  VALUES
  ('coi-local-seed-01','militia',1,800,10),('coi-local-seed-01','archer',1,200,0),('coi-local-seed-01','knight',1,150,0),
  ('coi-local-seed-02','militia',1,500,0),('coi-local-seed-02','spearman',1,300,0),('coi-local-seed-02','archer',1,400,0),
  ('coi-local-seed-03','swordsman',2,1000,20),('coi-local-seed-03','cavalry',2,500,0),('coi-local-seed-03','mage',1,120,0),('coi-local-seed-03','catapult',1,20,0),
  ('coi-local-seed-04','militia',1,300,0),('coi-local-seed-04','archer',1,600,0),
  ('coi-local-seed-05','cavalry',2,1200,0),('coi-local-seed-05','swordsman',2,600,0),('coi-local-seed-05','catapult',1,50,0),
  ('coi-local-seed-06','knight',1,400,0),('coi-local-seed-06','militia',1,600,0),('coi-local-seed-06','archer',1,300,0),
  ('coi-local-seed-07','militia',1,400,0),('coi-local-seed-07','archer',1,200,0),
  ('coi-local-seed-08','swordsman',3,2000,0),('coi-local-seed-08','cavalry',3,1500,0),('coi-local-seed-08','knight',2,1000,0),('coi-local-seed-08','trebuchet',1,100,0),
  ('coi-local-seed-09','militia',1,200,0),('coi-local-seed-09','archer',1,150,0),
  ('coi-local-seed-10','knight',2,600,0),('coi-local-seed-10','swordsman',2,400,0),('coi-local-seed-10','archer',2,500,0),('coi-local-seed-10','ram',1,30,0)
)
INSERT OR IGNORE INTO army_units (kingdom_id, unit_type, tier, quantity, wounded)
SELECT k.id, s.unit_type, s.tier, s.quantity, s.wounded
FROM seed s
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id;

WITH seed(player_key, hero_key, hero_name, level, experience, rarity) AS (
  VALUES
  ('coi-local-seed-01','soldado_basico','Soldado Recruta',15,450,'common'),
  ('coi-local-seed-02','sacerdotisa_luar','Sacerdotisa do Luar',12,280,'rare'),
  ('coi-local-seed-03','rei_artur','Rei Artur',25,1500,'legendary'),
  ('coi-local-seed-04','arqueiro_comum','Arqueiro da Floresta',8,120,'common'),
  ('coi-local-seed-05','merlin_arquimago','Merlin',20,850,'legendary'),
  ('coi-local-seed-06','capitao_espada','Capitão da Guarda',18,620,'rare'),
  ('coi-local-seed-07','curandeiro_aldeia','Curandeiro da Aldeia',7,90,'common'),
  ('coi-local-seed-08','joana_darc','Joana D’Arc',30,2500,'legendary'),
  ('coi-local-seed-09','cavaleiro_iniciante','Cavaleiro Novato',5,40,'common'),
  ('coi-local-seed-10','cavaleiro_dragao','Cavaleiro do Dragão',22,950,'rare')
)
INSERT OR IGNORE INTO heroes (kingdom_id, hero_key, hero_name, level, experience, rarity)
SELECT k.id, s.hero_key, s.hero_name, s.level, s.experience, s.rarity
FROM seed s
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id;

INSERT OR IGNORE INTO player_nicknames (player_id, nickname, nickname_key)
SELECT id,
  CASE player_id
    WHEN 'coi-local-seed-01' THEN 'VikingRagnar'
    WHEN 'coi-local-seed-02' THEN 'ShieldMaiden'
    WHEN 'coi-local-seed-03' THEN 'OdinSon'
    WHEN 'coi-local-seed-04' THEN 'FreyaBless'
    WHEN 'coi-local-seed-05' THEN 'LokiTrick'
    WHEN 'coi-local-seed-06' THEN 'ThorHammer'
    WHEN 'coi-local-seed-07' THEN 'FenrirWolf'
    WHEN 'coi-local-seed-08' THEN 'ValhallaKing'
    WHEN 'coi-local-seed-09' THEN 'RunaMystic'
    ELSE 'DragonSlayer'
  END,
  lower(CASE player_id
    WHEN 'coi-local-seed-01' THEN 'VikingRagnar'
    WHEN 'coi-local-seed-02' THEN 'ShieldMaiden'
    WHEN 'coi-local-seed-03' THEN 'OdinSon'
    WHEN 'coi-local-seed-04' THEN 'FreyaBless'
    WHEN 'coi-local-seed-05' THEN 'LokiTrick'
    WHEN 'coi-local-seed-06' THEN 'ThorHammer'
    WHEN 'coi-local-seed-07' THEN 'FenrirWolf'
    WHEN 'coi-local-seed-08' THEN 'ValhallaKing'
    WHEN 'coi-local-seed-09' THEN 'RunaMystic'
    ELSE 'DragonSlayer'
  END)
FROM players
WHERE player_id LIKE 'coi-local-seed-%';

WITH seed(player_key, research_key, level) AS (
  VALUES
  ('coi-local-seed-01','military',3),('coi-local-seed-01','economy',4),('coi-local-seed-01','gear_forging',2),
  ('coi-local-seed-03','military',8),('coi-local-seed-03','defense',5),('coi-local-seed-03','gear_ward',3),
  ('coi-local-seed-05','military',6),('coi-local-seed-05','gear_vitality',2),
  ('coi-local-seed-08','military',10),('coi-local-seed-08','construction',8),('coi-local-seed-08','gear_logistics',4),
  ('coi-local-seed-10','military',5),('coi-local-seed-10','economy',4)
)
INSERT OR IGNORE INTO research (kingdom_id, research_key, level)
SELECT k.id, s.research_key, s.level
FROM seed s
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id;

WITH seed(player_key, item_key, quantity) AS (
  VALUES
  ('coi-local-seed-01','power_crystal',5),('coi-local-seed-01','royal_blueprint',2),('coi-local-seed-01','imperial_seal',1),
  ('coi-local-seed-03','power_crystal',20),('coi-local-seed-03','royal_blueprint',10),('coi-local-seed-03','imperial_crest',3),
  ('coi-local-seed-08','power_crystal',30),('coi-local-seed-08','royal_blueprint',15),('coi-local-seed-08','imperial_crest',5)
)
INSERT OR IGNORE INTO inventory_items (kingdom_id, item_key, quantity)
SELECT k.id, s.item_key, s.quantity
FROM seed s
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id;

INSERT OR IGNORE INTO alliances (name, tag, leader_kingdom_id, description)
SELECT 'TESTE Filhos de Odin','TSTOD',k.id,'Aliança fictícia para testes locais.'
FROM players p JOIN kingdoms k ON k.player_id=p.id
WHERE p.player_id='coi-local-seed-03';

INSERT OR IGNORE INTO alliances (name, tag, leader_kingdom_id, description)
SELECT 'TESTE Lobos de Fenrir','TSTLF',k.id,'Aliança fictícia para testes locais.'
FROM players p JOIN kingdoms k ON k.player_id=p.id
WHERE p.player_id='coi-local-seed-05';

INSERT OR IGNORE INTO alliances (name, tag, leader_kingdom_id, description)
SELECT 'TESTE Guardiões de Asgard','TSTGA',k.id,'Aliança fictícia para testes locais.'
FROM players p JOIN kingdoms k ON k.player_id=p.id
WHERE p.player_id='coi-local-seed-08';

WITH seed(tag, player_key, role, rank) AS (
  VALUES
  ('TSTOD','coi-local-seed-03','leader','lider'),
  ('TSTOD','coi-local-seed-01','officer','oficial'),
  ('TSTOD','coi-local-seed-06','member','membro'),
  ('TSTOD','coi-local-seed-09','member','membro'),
  ('TSTLF','coi-local-seed-05','leader','lider'),
  ('TSTLF','coi-local-seed-07','officer','oficial'),
  ('TSTLF','coi-local-seed-10','member','membro'),
  ('TSTGA','coi-local-seed-08','leader','lider'),
  ('TSTGA','coi-local-seed-02','officer','oficial'),
  ('TSTGA','coi-local-seed-04','member','membro')
)
INSERT OR IGNORE INTO alliance_members (alliance_id, kingdom_id, role, rank)
SELECT a.id, k.id, s.role, s.rank
FROM seed s
JOIN alliances a ON a.tag=s.tag
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id;

WITH seed(territory_key, name, terrain, x, z, owner_player_key, resource_type, resource_rate, level, alliance_tag) AS (
  VALUES
  ('coi-local-seed-t01','TESTE Planície do Norte','plains',40,60,'coi-local-seed-01','food',120,2,'TSTOD'),
  ('coi-local-seed-t02','TESTE Bosque Antigo','forest',90,130,'coi-local-seed-02','wood',140,3,'TSTGA'),
  ('coi-local-seed-t03','TESTE Colina dos Reis','hills',150,80,'coi-local-seed-03','stone',110,4,'TSTOD'),
  ('coi-local-seed-t04','TESTE Rio Prateado','river',210,160,NULL,'food',100,2,NULL),
  ('coi-local-seed-t05','TESTE Mina Abandonada','mountain',280,70,NULL,'iron',90,5,NULL),
  ('coi-local-seed-t06','TESTE Ponte de Asgard','bridge',330,210,'coi-local-seed-08','gold',60,5,'TSTGA'),
  ('coi-local-seed-t07','TESTE Floresta Sombria','forest',390,100,'coi-local-seed-05','wood',160,4,'TSTLF'),
  ('coi-local-seed-t08','TESTE Campos de Freya','plains',450,260,'coi-local-seed-04','food',130,2,'TSTGA'),
  ('coi-local-seed-t09','TESTE Pedreira Oriental','hills',520,150,NULL,'stone',150,3,NULL),
  ('coi-local-seed-t10','TESTE Vale do Dragão','plains',580,300,'coi-local-seed-10','iron',100,4,NULL)
)
INSERT OR IGNORE INTO world_territories
(territory_key, name, terrain, x, z, owner_kingdom_id, level, resource_type, resource_rate, alliance_id)
SELECT s.territory_key, s.name, s.terrain, s.x, s.z, k.id, s.level, s.resource_type, s.resource_rate, a.id
FROM seed s
LEFT JOIN players p ON p.player_id=s.owner_player_key
LEFT JOIN kingdoms k ON k.player_id=p.id
LEFT JOIN alliances a ON a.tag=s.alliance_tag;

WITH seed(player_key, territory_key, march_type, units_json, offset_minutes) AS (
  VALUES
  ('coi-local-seed-01','coi-local-seed-t01','scout','{"militia":5}',-90),
  ('coi-local-seed-03','coi-local-seed-t03','gather','{"spearman":10}',-60),
  ('coi-local-seed-08','coi-local-seed-t06','return','{"knight":4}',-30)
)
INSERT OR IGNORE INTO marches (kingdom_id, target_territory_id, march_type, units_json, status, started_at, arrives_at, resolved_at)
SELECT k.id, t.id, s.march_type, s.units_json, 'completed',
  strftime('%Y-%m-%dT%H:%M:%fZ','now',printf('%+d minutes',s.offset_minutes)),
  strftime('%Y-%m-%dT%H:%M:%fZ','now',printf('%+d minutes',s.offset_minutes+10)),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM seed s
JOIN players p ON p.player_id=s.player_key
JOIN kingdoms k ON k.player_id=p.id
JOIN world_territories t ON t.territory_key=s.territory_key;

INSERT OR IGNORE INTO battle_reports
(attacker_kingdom_id, defender_kingdom_id, territory_id, winner_kingdom_id, battle_type, attacker_power, defender_power, losses_json, rewards_json, battle_log)
SELECT attacker.id, defender.id, t.id, attacker.id, 'seed_local_demo', 12500, 8900,
  '{"militia":12,"archer":4}', '{"food":500,"wood":250}',
  '[{"event":"local_seed_fixture"},{"event":"victory"}]'
FROM players pa
JOIN kingdoms attacker ON attacker.player_id=pa.id
JOIN players pd ON pd.player_id='coi-local-seed-04'
JOIN kingdoms defender ON defender.player_id=pd.id
JOIN world_territories t ON t.territory_key='coi-local-seed-t04'
WHERE pa.player_id='coi-local-seed-01';

INSERT OR IGNORE INTO battle_reports
(attacker_kingdom_id, defender_kingdom_id, territory_id, winner_kingdom_id, battle_type, attacker_power, defender_power, losses_json, rewards_json, battle_log)
SELECT attacker.id, defender.id, t.id, defender.id, 'seed_local_demo', 7900, 18000,
  '{"knight":25,"archer":18}', '{}',
  '[{"event":"local_seed_fixture"},{"event":"defeat"}]'
FROM players pa
JOIN kingdoms attacker ON attacker.player_id=pa.id
JOIN players pd ON pd.player_id='coi-local-seed-03'
JOIN kingdoms defender ON defender.player_id=pd.id
JOIN world_territories t ON t.territory_key='coi-local-seed-t05'
WHERE pa.player_id='coi-local-seed-06';

INSERT OR IGNORE INTO kingdom_events (kingdom_id, event_type, payload_json)
SELECT k.id, 'local_seed_fixture', '{"source":"scripts/seed-local.sql","notice":"Dados fictícios de desenvolvimento; sem efeito econômico real."}'
FROM players p JOIN kingdoms k ON k.player_id=p.id
WHERE p.player_id LIKE 'coi-local-seed-%';

INSERT OR IGNORE INTO kingdom_cosmetic_wallet (kingdom_id, shards)
SELECT id, 150 FROM kingdoms
WHERE player_id IN (SELECT id FROM players WHERE player_id LIKE 'coi-local-seed-%');

-- Confirmação de integridade básica: deve retornar 10 jogadores e 10 reinos.
SELECT
  (SELECT COUNT(*) FROM players WHERE player_id LIKE 'coi-local-seed-%') AS seed_players,
  (SELECT COUNT(*) FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id LIKE 'coi-local-seed-%') AS seed_kingdoms,
  (SELECT COUNT(*) FROM world_territories WHERE territory_key LIKE 'coi-local-seed-%') AS seed_territories;
