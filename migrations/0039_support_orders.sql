-- Contribuições opcionais ao desenvolvimento; sem vantagens de jogo e sem créditos automáticos.
CREATE TABLE IF NOT EXISTS support_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK(tier IN ('escudeiro','cavaleiro','senhor')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents IN (1000,5000,20000)),
  request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 12 AND 80),
  external_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  mp_order_id TEXT UNIQUE,
  mp_checkout_url TEXT,
  mp_payment_status TEXT,
  lock_token TEXT,
  lock_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  UNIQUE(player_id, request_key)
);
CREATE INDEX IF NOT EXISTS idx_support_orders_paid ON support_orders(status,confirmed_at);
