-- Add Mercado Pago hosted payment link as a selectable method for store purchases.
-- The hosted link is shared/static, so payment confirmation remains a protected Master action.
PRAGMA defer_foreign_keys = ON;
CREATE TABLE purchase_requests_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('vip_package','skin')),
  product_id INTEGER NOT NULL CHECK (product_id > 0),
  product_name TEXT NOT NULL,
  price_brl REAL NOT NULL CHECK (price_brl > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  gems_amount INTEGER NOT NULL DEFAULT 0 CHECK (gems_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('mercadopago_link','pix','bank_transfer','manual')),
  payment_reference TEXT CHECK (payment_reference IS NULL OR length(payment_reference) <= 120),
  request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 12 AND 64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT,
  UNIQUE (player_id, request_key)
);
INSERT INTO purchase_requests_new
  (id,player_id,kingdom_id,product_kind,product_id,product_name,price_brl,currency,gems_amount,payment_method,payment_reference,request_key,status,created_at,reviewed_at,reviewed_by)
SELECT id,player_id,kingdom_id,product_kind,product_id,product_name,price_brl,currency,gems_amount,payment_method,payment_reference,request_key,status,created_at,reviewed_at,reviewed_by
FROM purchase_requests;
DROP TABLE purchase_requests;
ALTER TABLE purchase_requests_new RENAME TO purchase_requests;
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_created ON purchase_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_player_created ON purchase_requests(player_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_requests_one_pending_product
  ON purchase_requests(player_id, product_kind, product_id) WHERE status='pending';
