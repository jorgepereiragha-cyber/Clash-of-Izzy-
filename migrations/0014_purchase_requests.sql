-- Purchase requests are created by authenticated players and released only by Master admin.
CREATE TABLE IF NOT EXISTS purchase_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('vip_package','skin')),
  product_id INTEGER NOT NULL CHECK (product_id > 0),
  product_name TEXT NOT NULL,
  price_brl REAL NOT NULL CHECK (price_brl > 0),
  gems_amount INTEGER NOT NULL DEFAULT 0 CHECK (gems_amount >= 0),
  request_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT,
  UNIQUE(player_id, request_key)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_created
  ON purchase_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_player_created
  ON purchase_requests(player_id, created_at DESC);
