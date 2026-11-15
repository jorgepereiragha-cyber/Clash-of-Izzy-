-- Reconcile the progression schema with the earlier persistent-equipment table.
-- SQLite ALTER TABLE only accepts constant defaults, so backfill existing rows and
-- use a trigger for future inserts that do not explicitly provide acquired_at.
ALTER TABLE kingdom_equipment ADD COLUMN acquired_at TEXT NOT NULL DEFAULT '';

UPDATE kingdom_equipment
SET acquired_at = CURRENT_TIMESTAMP
WHERE acquired_at = '';

CREATE TRIGGER IF NOT EXISTS trg_kingdom_equipment_acquired_at
AFTER INSERT ON kingdom_equipment
FOR EACH ROW
WHEN NEW.acquired_at = ''
BEGIN
  UPDATE kingdom_equipment
  SET acquired_at = CURRENT_TIMESTAMP
  WHERE kingdom_id = NEW.kingdom_id AND item_key = NEW.item_key;
END;
