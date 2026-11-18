-- Clash of Izzy 0028: balanced combat modifiers for paid castle skins.
-- Every launch castle skin gets an individual, deterministic attack/defense profile.
-- Values are capped at 2.34% per attribute and 2.5% by application logic.
ALTER TABLE skins ADD COLUMN attack_bonus_percent REAL NOT NULL DEFAULT 0
  CHECK (attack_bonus_percent >= 0 AND attack_bonus_percent <= 2.5);
ALTER TABLE skins ADD COLUMN defense_bonus_percent REAL NOT NULL DEFAULT 0
  CHECK (defense_bonus_percent >= 0 AND defense_bonus_percent <= 2.5);

-- The 37 and 73 multipliers are coprime with 200: the 200 launch skins
-- receive unique attack and defense percentages from 0.35% to 2.34%.
UPDATE skins
SET attack_bonus_percent = ROUND(0.35 + ((id * 37) % 200) / 100.0, 2),
    defense_bonus_percent = ROUND(0.35 + ((id * 73 + 19) % 200) / 100.0, 2);
