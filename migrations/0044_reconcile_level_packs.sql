-- 0044 - Reconciliacao conservadora do catalogo de pacotes P4-P8.
-- PRE-REQUISITO: a variante incondicional 0043_align_level_pack_catalog.sql
-- NAO pode existir. Integrar com a PR #236, que contem a 0043_fix_vip_catalog.sql.
-- Atua apenas sobre pares legados EXATOS de preco (centavos) e gemas.
-- Preserva IDs, historico de compras, pedidos, niveis e valores personalizados.
-- Nao executar remotamente ate obter auditoria D1 Preview, revisar pedidos
-- pendentes e obter aprovacao comercial dos valores P4-P8.
-- Se 0043_fix ja atualizou o catalogo, cada UPDATE abaixo e um no-op.
-- Pedido pendente do mesmo produto bloqueia sua atualizacao por esta 0044.

UPDATE vip_packages
SET price_brl=99.90, gems=10000
WHERE name='Pacote Marques Real'
  AND ROUND(price_brl*100)=8990
  AND gems=8000
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_requests r
    WHERE r.product_kind='vip_package'
      AND r.product_id=vip_packages.id
      AND r.status='pending'
  );

UPDATE vip_packages
SET price_brl=149.90, gems=20000
WHERE name='Pacote Duque Imperial'
  AND ROUND(price_brl*100)=12990
  AND gems=12000
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_requests r
    WHERE r.product_kind='vip_package'
      AND r.product_id=vip_packages.id
      AND r.status='pending'
  );

UPDATE vip_packages
SET price_brl=199.90, gems=35000
WHERE name='Pacote Principe Soberano'
  AND ROUND(price_brl*100)=17990
  AND gems=17000
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_requests r
    WHERE r.product_kind='vip_package'
      AND r.product_id=vip_packages.id
      AND r.status='pending'
  );

UPDATE vip_packages
SET price_brl=299.90, gems=60000
WHERE name='Pacote Rei Supremo'
  AND ROUND(price_brl*100)=22990
  AND gems=23000
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_requests r
    WHERE r.product_kind='vip_package'
      AND r.product_id=vip_packages.id
      AND r.status='pending'
  );

UPDATE vip_packages
SET price_brl=499.90, gems=100000
WHERE name='Pacote Imperador Eterno'
  AND ROUND(price_brl*100)=29990
  AND gems=30000
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_requests r
    WHERE r.product_kind='vip_package'
      AND r.product_id=vip_packages.id
      AND r.status='pending'
  );
