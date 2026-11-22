-- Clash of Izzy 0029: equip one cosmetic set item per equipment slot.
-- Existing cosmetic ownership is preserved; every previously owned item remains unequipped.
ALTER TABLE kingdom_cosmetics
  ADD COLUMN equipped_slot TEXT
  CHECK (equipped_slot IS NULL OR equipped_slot IN ('head','body','weapon','relic','aura'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdom_cosmetics_equipped_slot
  ON kingdom_cosmetics (kingdom_id, equipped_slot)
  WHERE equipped_slot IS NOT NULL;
