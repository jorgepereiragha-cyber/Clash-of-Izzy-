-- Persist construction, troop training and research timers.
-- Rebuild the troop table to align its CHECK constraint with the existing
-- server catalog, which already exposes the mage unit.
CREATE TABLE army_units_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('militia','swordsman','spearman','archer','cavalry','knight','crossbowman','mage','catapult','ram','trebuchet')),
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 10),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  wounded INTEGER NOT NULL DEFAULT 0 CHECK (wounded >= 0),
  UNIQUE (kingdom_id, unit_type, tier)
);
INSERT INTO army_units_v2(id,kingdom_id,unit_type,tier,quantity,wounded)
SELECT id,kingdom_id,unit_type,tier,quantity,wounded FROM army_units;
DROP TABLE army_units;
ALTER TABLE army_units_v2 RENAME TO army_units;
CREATE INDEX idx_units_kingdom ON army_units(kingdom_id);

CREATE TABLE kingdom_queues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  queue_type TEXT NOT NULL CHECK (queue_type IN ('construction','training','research')),
  target_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 100),
  from_level INTEGER NOT NULL DEFAULT 0 CHECK (from_level >= 0),
  to_level INTEGER NOT NULL DEFAULT 0 CHECK (to_level >= 0),
  reward_item TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','cancelled')),
  started_at TEXT NOT NULL,
  completes_at TEXT NOT NULL,
  completed_at TEXT,
  completion_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (completes_at > started_at)
);

-- One active lane of each strategic activity per kingdom. A completed project
-- releases its lane without deleting its audit history.
CREATE UNIQUE INDEX idx_kingdom_queues_one_active_lane
  ON kingdom_queues(kingdom_id,queue_type)
  WHERE status='running';
CREATE INDEX idx_kingdom_queues_due
  ON kingdom_queues(status,completes_at,id);
CREATE INDEX idx_kingdom_queues_history
  ON kingdom_queues(kingdom_id,id DESC);
