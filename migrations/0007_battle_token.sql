-- Token CAS para impedir que duas batalhas PvE consumam o mesmo exército.
ALTER TABLE kingdoms ADD COLUMN battle_token TEXT;
