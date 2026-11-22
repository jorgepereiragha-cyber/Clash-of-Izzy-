-- 0043 - Conciliar valores P4-P8 de uma versao anterior do catalogo 0042.
-- Atualiza apenas registros com precos E gemas legados conhecidos. Nao altera
-- IDs, nao recria linhas, nao toca pedidos historicos e nao insere recompensas.
-- Caso a versao revisada de 0042 ja esteja aplicada, todos os UPDATEs sao no-op.
-- Se houver precos personalizados diferentes, interromper e revisar manualmente.
UPDATE vip_packages SET price_brl=99.90,gems=10000
WHERE name='Pacote Marques Real' AND ROUND(price_brl*100)=8990 AND gems=8000;

UPDATE vip_packages SET price_brl=149.90,gems=20000
WHERE name='Pacote Duque Imperial' AND ROUND(price_brl*100)=12990 AND gems=12000;

UPDATE vip_packages SET price_brl=199.90,gems=35000
WHERE name='Pacote Principe Soberano' AND ROUND(price_brl*100)=17990 AND gems=17000;

UPDATE vip_packages SET price_brl=299.90,gems=60000
WHERE name='Pacote Rei Supremo' AND ROUND(price_brl*100)=22990 AND gems=23000;

UPDATE vip_packages SET price_brl=499.90,gems=100000
WHERE name='Pacote Imperador Eterno' AND ROUND(price_brl*100)=29990 AND gems=30000;
