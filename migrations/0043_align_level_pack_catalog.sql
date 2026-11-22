-- 0043 - Alinhamento seguro do catalogo P4-P8 solicitado em 2026-11-22.
-- Depende da 0042. Nao altera pedidos existentes, historico de pagamento,
-- IDs, skins ou level_pack_claims. Recursos continuam canonicos em level-packs.js.
-- Antes da aplicacao remota: conferir se ha orders pendentes com precos antigos,
-- aprovar o catalogo e homologar a migracao em D1 Preview.
-- NUNCA substituir por INSERT OR REPLACE: isso pode trocar IDs referenciados.
UPDATE vip_packages SET
  price_brl = CASE name
    WHEN 'Pacote Marques Real' THEN 99.90
    WHEN 'Pacote Duque Imperial' THEN 149.90
    WHEN 'Pacote Principe Soberano' THEN 199.90
    WHEN 'Pacote Rei Supremo' THEN 299.90
    WHEN 'Pacote Imperador Eterno' THEN 499.90
    ELSE price_brl END,
  gems = CASE name
    WHEN 'Pacote Marques Real' THEN 10000
    WHEN 'Pacote Duque Imperial' THEN 20000
    WHEN 'Pacote Principe Soberano' THEN 35000
    WHEN 'Pacote Rei Supremo' THEN 60000
    WHEN 'Pacote Imperador Eterno' THEN 100000
    ELSE gems END
WHERE name IN (
  'Pacote Marques Real',
  'Pacote Duque Imperial',
  'Pacote Principe Soberano',
  'Pacote Rei Supremo',
  'Pacote Imperador Eterno'
);
