-- Adiciona a classe de magos mantendo as tropas existentes.
PRAGMA foreign_keys = OFF;
CREATE TABLE army_units_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 unit_type TEXT NOT NULL CHECK (unit_type IN ('militia','swordsman','spearman','archer','cavalry','knight','mage','crossbowman','catapult','ram','trebuchet')),
 tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 10),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
 wounded INTEGER NOT NULL DEFAULT 0 CHECK (wounded >= 0),
 UNIQUE (kingdom_id, unit_type, tier)
);
INSERT INTO army_units_new(id,kingdom_id,unit_type,tier,quantity,wounded) SELECT id,kingdom_id,unit_type,tier,quantity,wounded FROM army_units;
DROP TABLE army_units;
ALTER TABLE army_units_new RENAME TO army_units;
CREATE INDEX IF NOT EXISTS idx_units_kingdom ON army_units(kingdom_id);
PRAGMA foreign_keys = ON;
