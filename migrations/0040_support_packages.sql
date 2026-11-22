-- Produtos de apoio: benefícios monetários entregues apenas após pagamento confirmado.
-- Usa purchase_requests + Mercado Pago Orders/webhook existentes (sem webhook paralelo).
INSERT OR IGNORE INTO vip_packages(name,price_brl,gems) VALUES
  ('Apoio Escudeiro',10.00,500),
  ('Apoio Cavaleiro',50.00,3000),
  ('Apoio Senhor Feudal',200.00,15000);
