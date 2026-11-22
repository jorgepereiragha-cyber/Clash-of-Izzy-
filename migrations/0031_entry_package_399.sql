-- Oferta de entrada de Eldoria: acessivel e repetivel.
-- A tabela vip_packages armazena apenas gemas. Nenhum bonus nao implementado
-- e prometido; o credito so acontece apos pagamento verificado.
-- INSERT OR IGNORE preserva edicoes manuais e evita duplicar uma oferta por nome.
INSERT OR IGNORE INTO vip_packages(name, price_brl, gems)
VALUES ('Pacote Inicial de Eldoria', 3.99, 35);
