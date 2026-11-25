-- Individual dragon progress, additive; preserve the last equipped dragon's recorded progress.
-- No new ownership is granted. Previously unequipped dragons have no attributable history.
ALTER TABLE kingdom_dragons ADD COLUMN level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 100 AND typeof(level)='integer');
ALTER TABLE kingdom_dragons ADD COLUMN experience INTEGER NOT NULL DEFAULT 0 CHECK(experience>=0 AND typeof(experience)='integer');
ALTER TABLE kingdom_dragons ADD COLUMN bond INTEGER NOT NULL DEFAULT 1 CHECK(bond BETWEEN 1 AND 100 AND typeof(bond)='integer');
UPDATE kingdom_dragons
 SET level=(SELECT d.level FROM dragons d WHERE d.kingdom_id=kingdom_dragons.kingdom_id AND d.dragon_key=kingdom_dragons.dragon_key),
 experience=(SELECT MAX(0,CAST(d.experience AS INTEGER)) FROM dragons d WHERE d.kingdom_id=kingdom_dragons.kingdom_id AND d.dragon_key=kingdom_dragons.dragon_key),
 bond=(SELECT MAX(1,MIN(100,CAST(d.bond AS INTEGER))) FROM dragons d WHERE d.kingdom_id=kingdom_dragons.kingdom_id AND d.dragon_key=kingdom_dragons.dragon_key)
 WHERE EXISTS(SELECT 1 FROM dragons d WHERE d.kingdom_id=kingdom_dragons.kingdom_id AND d.dragon_key=kingdom_dragons.dragon_key);
-- Normalize only invalid legacy values; retain the active combat mirror.
UPDATE dragons SET experience=MAX(0,CAST(experience AS INTEGER)),bond=MAX(1,MIN(100,CAST(bond AS INTEGER)))
 WHERE experience<0 OR bond<1 OR bond>100;
