-- Três ofertas em BRL. O pacote de R$ 3,99 é criado pela migração 0031.
-- Cada pacote pode ser adquirido no máximo uma vez a cada 24h por jogador.
-- O limite é aplicado no Worker com guarda SQL atômica; esta migração não concede gemas.
INSERT OR IGNORE INTO vip_packages(name,price_brl,gems) VALUES
 ('Pacote Diário de Eldoria',9.99,100),
 ('Pacote Premium Diário de Eldoria',49.99,600);
