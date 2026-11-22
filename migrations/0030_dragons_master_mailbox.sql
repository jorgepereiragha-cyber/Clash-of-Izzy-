-- Clash of Izzy 0030: dragões colecionáveis, pacote Master único e correio persistente.
-- Nenhum item de produção é removido e chaves antigas são preservadas.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS kingdom_dragons(
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 dragon_key TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'game' CHECK(source IN ('starter','game','master')),
 acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(kingdom_id,dragon_key)
);
INSERT OR IGNORE INTO kingdom_dragons(kingdom_id,dragon_key,source)
 SELECT kingdom_id,dragon_key,'starter' FROM dragons WHERE dragon_key='ember_wyrm';
CREATE TABLE IF NOT EXISTS master_bonus_claims(
 request_id INTEGER NOT NULL UNIQUE REFERENCES purchase_requests(id),
 kingdom_id INTEGER NOT NULL UNIQUE REFERENCES kingdoms(id) ON DELETE CASCADE,
 granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kingdom_mailbox(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 source_key TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
 reward_key TEXT NOT NULL DEFAULT '' CHECK(reward_key IN ('','welcome_v1')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT,
 claimed_at TEXT,
 UNIQUE(kingdom_id,source_key)
);
CREATE INDEX IF NOT EXISTS idx_mailbox_kingdom_created ON kingdom_mailbox(kingdom_id,created_at DESC,id DESC);
INSERT OR IGNORE INTO kingdom_mailbox(kingdom_id,source_key,title,body,reward_key)
 SELECT id,'welcome:v1','Boas-vindas a Eldoria','Abra a mochila, desenvolva o castelo e receba um bônus inicial de 1.000 comida e 500 madeira.','welcome_v1' FROM kingdoms;
-- Oferta configurável, desativada no endpoint até MASTER_PACK_ENABLED=true.
INSERT OR IGNORE INTO vip_packages(name,price_brl,gems) VALUES('Pacote Master de Eldoria',399.00,10000);
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_one_per_player
 ON purchase_requests(player_id,product_kind,product_name)
 WHERE product_kind='vip_package' AND product_name='Pacote Master de Eldoria' AND status IN ('pending','approved');
