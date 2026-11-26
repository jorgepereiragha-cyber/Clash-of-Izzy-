// Pure visual selection: the server owns building levels and coordinates.
export const MODEL_LIMITS = Object.freeze({models:96, props:16, units:16, total:128});
export function modelMinLevel(asset) { return asset.minLevel ?? 1; }
export function selectBuildingAsset(assets, type, level, tier = "balanced") {
  const safeLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
  const preferred = tier === "high" ? 0 : tier === "low" ? 2 : 1;
  return (Array.isArray(assets) ? assets : []).filter(a => a?.enabled === true
    && a.type === type && Number.isSafeInteger(modelMinLevel(a))
    && modelMinLevel(a) >= 1 && modelMinLevel(a) <= safeLevel
    && (a.lod === undefined || [0,1,2].includes(a.lod)))
    .sort((a,b) => modelMinLevel(b)-modelMinLevel(a)
      || Math.abs((a.lod ?? 1)-preferred)-Math.abs((b.lod ?? 1)-preferred)
      || (b.lod ?? 1)-(a.lod ?? 1))[0] ?? null;
}

// Architectural stages are visual only; never modify the authoritative level.
export function castleArchitectureTier(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return 1;
  return n >= 30 ? 5 : n >= 25 ? 4 : n >= 20 ? 3 : n >= 10 ? 2 : 1;
}
