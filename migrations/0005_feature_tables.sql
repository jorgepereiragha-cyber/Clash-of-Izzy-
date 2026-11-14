-- Tabelas permanentes dos sistemas de heróis, cosméticos e loja.
-- Criadas uma única vez pelo controle de migrações D1.
CREATE TABLE IF NOT EXISTS hero_inventory (
 kingdom_id INTEGER NOT NULL, hero_key TEXT NOT NULL, rarity TEXT NOT NULL,
 level INTEGER NOT NULL DEFAULT 1, experience INTEGER NOT NULL DEFAULT 0,
 stars INTEGER NOT NULL DEFAULT 1, skill_level INTEGER NOT NULL DEFAULT 1,
 fragments INTEGER NOT NULL DEFAULT 0, acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (kingdom_id, hero_key)
);
CREATE TABLE IF NOT EXISTS hero_summon_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, kingdom_id INTEGER NOT NULL,
 hero_key TEXT NOT NULL, rarity TEXT NOT NULL, result_type TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kingdom_cosmetics (
 kingdom_id INTEGER NOT NULL, item_id TEXT NOT NULL, kind TEXT NOT NULL,
 acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (kingdom_id, item_id)
);
CREATE TABLE IF NOT EXISTS kingdom_cosmetic_wallet (
 kingdom_id INTEGER PRIMARY KEY, shards INTEGER NOT NULL DEFAULT 150
);
CREATE TABLE IF NOT EXISTS kingdom_collection_claims (
 kingdom_id INTEGER NOT NULL, collection_id TEXT NOT NULL,
 claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (kingdom_id, collection_id)
);
CREATE TABLE IF NOT EXISTS shop_inventory (
 kingdom_id INTEGER NOT NULL, item_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (kingdom_id, item_id)
);
CREATE TABLE IF NOT EXISTS merchant_stock (
 kingdom_id INTEGER NOT NULL, cycle_id INTEGER NOT NULL, item_id TEXT NOT NULL,
 stock INTEGER NOT NULL, PRIMARY KEY (kingdom_id, cycle_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_hero_history_kingdom ON hero_summon_history(kingdom_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_kingdom_cosmetics_kingdom ON kingdom_cosmetics(kingdom_id);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_kingdom ON shop_inventory(kingdom_id);
