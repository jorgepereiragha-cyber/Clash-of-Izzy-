-- 0042 - Pacotes P1-P8. Depende de 0041 e preserva o checkout/webhook existentes.
-- Precos P4-P8 sao PROPOSTAS e NAO devem ser vendidos sem aprovacao comercial.
-- A flag LEVEL_PACKS_ENABLED permanece desligada ate homologacao.
CREATE TABLE IF NOT EXISTS level_pack_claims (
  request_id INTEGER PRIMARY KEY REFERENCES purchase_requests(id) ON DELETE RESTRICT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE RESTRICT,
  pack_level INTEGER NOT NULL CHECK(pack_level IN (10,20,30,40,50,60,70,80)),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kingdom_id,pack_level)
);
CREATE INDEX IF NOT EXISTS idx_level_pack_claims_kingdom ON level_pack_claims(kingdom_id,pack_level);

INSERT OR IGNORE INTO vip_packages(name,price_brl,gems) VALUES
  ('Pacote Lord Iniciante',9.90,500),
  ('Pacote Senhor Feudal',29.90,2000),
  ('Pacote Conde Soberano',59.90,5000),
  ('Pacote Marques Real',99.90,10000),
  ('Pacote Duque Imperial',149.90,20000),
  ('Pacote Principe Soberano',199.90,35000),
  ('Pacote Rei Supremo',299.90,60000),
  ('Pacote Imperador Eterno',499.90,100000);
