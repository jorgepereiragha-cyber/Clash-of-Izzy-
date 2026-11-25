-- Additive: preserve all existing item levels and ownership.
ALTER TABLE kingdom_equipment ADD COLUMN enhancement INTEGER NOT NULL DEFAULT 0 CHECK(enhancement BETWEEN 0 AND 10 AND typeof(enhancement)='integer');
CREATE TABLE equipment_fragments (
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 rarity TEXT NOT NULL CHECK(rarity IN ('comum','raro','epico','lendario')),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0 AND typeof(quantity)='integer'),
 PRIMARY KEY(kingdom_id,rarity)
);
