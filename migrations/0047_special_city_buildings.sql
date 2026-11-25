-- Separate special landmarks: do not rebuild kingdom_buildings or change its CHECK.
CREATE TABLE city_special_buildings(
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 building_type TEXT NOT NULL CHECK(building_type IN ('dragon_nest','summon_altar')),
 grid_x INTEGER NOT NULL CHECK(typeof(grid_x)='integer' AND grid_x BETWEEN -25 AND 22),
 grid_z INTEGER NOT NULL CHECK(typeof(grid_z)='integer' AND grid_z BETWEEN -25 AND 22),
 width INTEGER NOT NULL DEFAULT 3 CHECK(width=3),
 height INTEGER NOT NULL DEFAULT 3 CHECK(height=3),
 PRIMARY KEY(kingdom_id,building_type)
);
