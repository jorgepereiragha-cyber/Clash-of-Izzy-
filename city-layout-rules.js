/**
 * Grid de construção da cidade. Usa kingdom_buildings.position_x/position_z
 * (já persistidos no D1) para não introduzir uma segunda fonte de verdade.
 * Posições legadas em meio tile continuam válidas até o jogador movê-las.
 */
export const CITY_GRID_MIN = -25;
export const CITY_GRID_MAX = 25; // limite exclusivo (50x50 tiles)

export const CITY_FOOTPRINTS = Object.freeze({
  castle: Object.freeze({ width: 5, height: 5 }),
  barracks: Object.freeze({ width: 3, height: 3 }),
  farm: Object.freeze({ width: 2, height: 2 }),
  quarry: Object.freeze({ width: 2, height: 2 }),
  lumber_mill: Object.freeze({ width: 2, height: 2 }),
  iron_mine: Object.freeze({ width: 2, height: 2 }),
  market: Object.freeze({ width: 3, height: 3 }),
  academy: Object.freeze({ width: 3, height: 3 }),
  wall: Object.freeze({ width: 3, height: 2 }),
  hospital: Object.freeze({ width: 3, height: 2 }),
  watchtower: Object.freeze({ width: 2, height: 2 }),
  stable: Object.freeze({ width: 3, height: 2 }),
  archery_range: Object.freeze({ width: 3, height: 2 }),
  siege_workshop: Object.freeze({ width: 3, height: 3 }),
  embassy: Object.freeze({ width: 2, height: 2 }),
  warehouse: Object.freeze({ width: 3, height: 2 })
});

export function cityLayoutConfig() {
  return { min: CITY_GRID_MIN, max: CITY_GRID_MAX, footprints: CITY_FOOTPRINTS };
}

function overlaps(aX, aZ, aW, aH, bX, bZ, bW, bH) {
  return aX < bX + bW && aX + aW > bX && aZ < bZ + bH && aZ + aH > bZ;
}

/** Validação para prévia e teste; o UPDATE SQL repete o teste atomicamente. */
export function validateCityPlacement(buildings, type, x, z) {
  const footprint = Object.hasOwn(CITY_FOOTPRINTS, type) ? CITY_FOOTPRINTS[type] : null;
  if (!footprint || !Number.isSafeInteger(x) || !Number.isSafeInteger(z)) return false;
  if (x < CITY_GRID_MIN || z < CITY_GRID_MIN || x + footprint.width > CITY_GRID_MAX || z + footprint.height > CITY_GRID_MAX) return false;
  return (Array.isArray(buildings) ? buildings : []).every(other => {
    if (other.building_type === type) return true;
    const size = CITY_FOOTPRINTS[other.building_type];
    const ox = Number(other.position_x), oz = Number(other.position_z);
    if (!size || !Number.isFinite(ox) || !Number.isFinite(oz)) return false;
    return !overlaps(x, z, footprint.width, footprint.height, ox, oz, size.width, size.height);
  });
}

function sizeCase(column) {
  // Todas as partes do SQL são literais confiáveis desta configuração, nunca input.
  const dimension = column === "width" ? "width" : "height";
  return "CASE other.building_type " +
    Object.entries(CITY_FOOTPRINTS).map(([type, size]) => "WHEN '" + type + "' THEN " + size[dimension]).join(" ") +
    " ELSE 5 END";
}

const ATOMIC_MOVE_SQL =
  "UPDATE kingdom_buildings SET position_x=?,position_z=? " +
  "WHERE kingdom_id=? AND building_type=? AND position_x=? AND position_z=? " +
  "AND NOT EXISTS (SELECT 1 FROM kingdom_buildings other " +
  "WHERE other.kingdom_id=? AND other.building_type<>? " +
  "AND other.position_x<? AND other.position_x+(" + sizeCase("width") + ")>? " +
  "AND other.position_z<? AND other.position_z+(" + sizeCase("height") + ")>?)" +
  " AND NOT EXISTS(SELECT 1 FROM city_structures addition WHERE addition.kingdom_id=?"+
  " AND addition.grid_x<? AND addition.grid_x+addition.width>?"+
  " AND addition.grid_y<? AND addition.grid_y+addition.height>?)";

/**
 * Reposicionamento com ownership no kingdom_id autenticado, CAS e colisões
 * verificadas dentro de um único UPDATE do SQLite/D1 (sem TOCTOU).
 * Não altera produção, custos, tropas nem níveis.
 */
export async function moveCityBuilding(env, kingdomId, body) {
  const type = typeof body?.building === "string" ? body.building : "";
  const x = body?.gridX, z = body?.gridZ;
  const fromX = body?.fromX, fromZ = body?.fromZ;
  if (!Object.hasOwn(CITY_FOOTPRINTS, type) ||
    !Number.isSafeInteger(x) || !Number.isSafeInteger(z) ||
    typeof fromX !== "number" || !Number.isFinite(fromX) ||
    typeof fromZ !== "number" || !Number.isFinite(fromZ)) {
    return { ok: false, status: 400, error: "Edifício ou coordenadas inválidos." };
  }
  const footprint = CITY_FOOTPRINTS[type];
  if (x < CITY_GRID_MIN || z < CITY_GRID_MIN ||
    x + footprint.width > CITY_GRID_MAX || z + footprint.height > CITY_GRID_MAX) {
    return { ok: false, status: 400, error: "Construção fora dos limites da cidade." };
  }
  const update = await env.DB.prepare(ATOMIC_MOVE_SQL)
    .bind(x, z, kingdomId, type, fromX, fromZ, kingdomId, type,
      x + footprint.width, x, z + footprint.height, z,
      kingdomId,x+footprint.width+25,x+25,z+footprint.height+25,z+25).run();
  if (Number(update?.meta?.changes) !== 1) {
    return { ok: false, status: 409, error: "Posição ocupada ou cidade desatualizada. Sincronize e tente novamente." };
  }
  return { ok: true, building: type, gridX: x, gridZ: z };
}
