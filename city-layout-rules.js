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
export function validateCityPlacement(buildings, type, x, z, defenses = []) {
  const footprint = Object.hasOwn(CITY_FOOTPRINTS, type) ? CITY_FOOTPRINTS[type] : null;
  if (!footprint || !Number.isSafeInteger(x) || !Number.isSafeInteger(z)) return false;
  if (x < CITY_GRID_MIN || z < CITY_GRID_MIN || x + footprint.width > CITY_GRID_MAX || z + footprint.height > CITY_GRID_MAX) return false;
  const clearBuildings = (Array.isArray(buildings) ? buildings : []).every(other => {
    if (other.building_type === type) return true; // próprio edifício em reposicionamento
    const size = CITY_FOOTPRINTS[other.building_type];
    const ox = Number(other.position_x), oz = Number(other.position_z);
    if (!size || !Number.isFinite(ox) || !Number.isFinite(oz)) return false;
    return !overlaps(x, z, footprint.width, footprint.height, ox, oz, size.width, size.height);
  });
  return clearBuildings && (Array.isArray(defenses) ? defenses : []).every(d =>
    !overlaps(x,z,footprint.width,footprint.height,Number(d.grid_x),Number(d.grid_z),Number(d.width),Number(d.height))
  );
}

function sizeCase(column) {
  // Todas as partes do SQL são literais confiáveis desta configuração, nunca input.
  const dimension = column === "width" ? "width" : "height";
  return "CASE other.building_type " +
    Object.entries(CITY_FOOTPRINTS).map(([type, size]) => "WHEN '" + type + "' THEN " + size[dimension]).join(" ") +
    " ELSE 5 END";
}

export const specialCityEnabled=env=>env.GAME_4X_SYSTEMS_ENABLED==="true"&&(["beta","production","preview"].includes(env.ENVIRONMENT));
export const SPECIAL_CITY_CLEAR="NOT EXISTS(SELECT 1 FROM city_special_buildings s WHERE s.kingdom_id=? AND s.grid_x<? AND s.grid_x+s.width>? AND s.grid_z<? AND s.grid_z+s.height>?)";
const ATOMIC_MOVE_SQL =
  "UPDATE kingdom_buildings SET position_x=?,position_z=? " +
  "WHERE kingdom_id=? AND building_type=? AND position_x=? AND position_z=? " +
  "AND NOT EXISTS (SELECT 1 FROM kingdom_buildings other " +
  "WHERE other.kingdom_id=? AND other.building_type<>? " +
  "AND other.position_x<? AND other.position_x+(" + sizeCase("width") + ")>? " +
  "AND other.position_z<? AND other.position_z+(" + sizeCase("height") + ")>?)";

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
  const advanced = env.GAME_4X_SYSTEMS_ENABLED === "true";
  const defenseGuard = advanced
    ? " AND NOT EXISTS(SELECT 1 FROM city_defenses d WHERE d.kingdom_id=? "+
      "AND d.grid_x<? AND d.grid_x+d.width>? AND d.grid_z<? AND d.grid_z+d.height>?)"
    : "";
  const binds=[x,z,kingdomId,type,fromX,fromZ,kingdomId,type,
    x+footprint.width,x,z+footprint.height,z];
  if(advanced)binds.push(kingdomId,x+footprint.width,x,z+footprint.height,z);
  const specialGuard=specialCityEnabled(env)?" AND "+SPECIAL_CITY_CLEAR:"";
  if(specialGuard)binds.push(kingdomId,x+footprint.width,x,z+footprint.height,z);
  const update=await env.DB.prepare(ATOMIC_MOVE_SQL+defenseGuard+specialGuard).bind(...binds).run();
  if (Number(update?.meta?.changes) !== 1) {
    return { ok: false, status: 409, error: "Posição ocupada ou cidade desatualizada. Sincronize e tente novamente." };
  }
  return { ok: true, building: type, gridX: x, gridZ: z };
}
