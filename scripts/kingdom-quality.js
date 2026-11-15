// Conservative, capability-based quality tiers for the WebGL kingdom renderer.
// This deliberately avoids guessing Android thermal state from unsupported web APIs.
export function selectKingdomQualityProfile({
  deviceMemory = 0,
  hardwareConcurrency = 4,
  viewportWidth = 720,
  maxTextureSize = 4096,
} = {}) {
  const memory = Number.isFinite(Number(deviceMemory)) ? Number(deviceMemory) : 0;
  const cores = Number.isFinite(Number(hardwareConcurrency)) ? Number(hardwareConcurrency) : 4;
  const width = Math.max(1, Number(viewportWidth) || 1);
  const textureLimit = Math.max(0, Number(maxTextureSize) || 0);

  const low = (memory > 0 && memory <= 4)
    || (cores > 0 && cores <= 4)
    || width < 520
    || (textureLimit > 0 && textureLimit < 4096);
  const high = !low && memory >= 8 && cores >= 8 && width >= 900 && textureLimit >= 8192;
  const tier = low ? "low" : high ? "high" : "balanced";

  return Object.freeze({
    tier,
    pixelRatioCap: tier === "low" ? 1 : tier === "high" ? 1.5 : 1.25,
    shadows: tier !== "low" && width > 680,
    shadowMapSize: tier === "high" ? 1536 : tier === "balanced" ? 1024 : 512,
    anisotropy: tier === "high" ? 8 : tier === "balanced" ? 4 : 2,
    maxBuildings: 16,
  });
}
