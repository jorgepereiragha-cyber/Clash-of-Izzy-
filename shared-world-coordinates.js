// All player castles belong to one shared world (Eldoria).
// Coordinates expand in 20 columns; map_region stays at 1 and is retained
// only for compatibility with the existing D1 schema.
export function getSharedWorldCoordinates(kingdomId) {
  const id = Number(kingdomId);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new RangeError("kingdomId must be a positive safe integer");
  }

  const slot = id - 1;
  return {
    mapX: ((slot % 20) - 10) * 5,
    mapZ: (Math.floor(slot / 20) - 10) * 5,
    mapRegion: 1,
  };
}
