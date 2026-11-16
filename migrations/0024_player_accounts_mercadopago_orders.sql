-- Clash of Izzy 0024: contas persistentes e Checkout Pro via Orders API.
-- A migração preserva players, kingdoms, compras e sessões já existentes.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS player_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  email TEXT,
  email_key TEXT,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 310000 CHECK (password_iterations BETWEEN 100000 AND 1000000),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_accounts_email_key
  ON player_accounts(email_key) WHERE email_key IS NOT NULL;

ALTER TABLE purchase_requests ADD COLUMN mp_external_reference TEXT;
ALTER TABLE purchase_requests ADD COLUMN mp_idempotency_key TEXT;
ALTER TABLE purchase_requests ADD COLUMN mp_order_id TEXT;
ALTER TABLE purchase_requests ADD COLUMN mp_checkout_url TEXT;
ALTER TABLE purchase_requests ADD COLUMN mp_payment_status TEXT;
ALTER TABLE purchase_requests ADD COLUMN mp_checkout_lock TEXT;
ALTER TABLE purchase_requests ADD COLUMN mp_checkout_lock_expires_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_mp_external_reference
  ON purchase_requests(mp_external_reference) WHERE mp_external_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_mp_order_id
  ON purchase_requests(mp_order_id) WHERE mp_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mercadopago_orders (
  order_id TEXT PRIMARY KEY,
  request_id INTEGER NOT NULL UNIQUE REFERENCES purchase_requests(id) ON DELETE RESTRICT,
  external_reference TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (currency = 'BRL'),
  status TEXT NOT NULL,
  status_detail TEXT,
  payment_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mercadopago_orders_request
  ON mercadopago_orders(request_id, created_at DESC);
