// Conservative, capability-based quality tiers for the WebGL kingdom renderer.
// Optional browser hints are treated as hints only; missing APIs never block rendering.
export function selectKingdomQualityProfile({
  deviceMemory = 0,
  hardwareConcurrency = 4,
  viewportWidth = 720,
  maxTextureSize = 4096,
  saveData = false,
  prefersReducedMotion = false,
} = {}) {
  const memory = Number.isFinite(Number(deviceMemory)) ? Number(deviceMemory) : 0;
  const cores = Number.isFinite(Number(hardwareConcurrency)) ? Number(hardwareConcurrency) : 4;
  const width = Math.max(1, Number(viewportWidth) || 1);
  const textureLimit = Math.max(0, Number(maxTextureSize) || 0);
  const dataSaver = saveData === true;

  const low = dataSaver
    || (memory > 0 && memory <= 4)
    || (cores > 0 && cores <= 4)
    || width < 520
    || (textureLimit > 0 && textureLimit < 4096);
  const high = !low && memory >= 8 && cores >= 8 && width >= 900 && textureLimit >= 8192;
  const tier = low ? "low" : high ? "high" : "balanced";

  return Object.freeze({
    tier,
    pixelRatioCap: tier === "low" ? 1 : tier === "high" ? 1.5 : 1.25,
    shadows: !dataSaver && (tier === "high" || (tier === "balanced" && width > 1024)),
    shadowMapSize: tier === "high" ? 1536 : tier === "balanced" ? 1024 : 512,
    anisotropy: tier === "high" ? 8 : tier === "balanced" ? 4 : 2,
    maxBuildings: tier === "low" ? 8 : tier === "balanced" ? 12 : 16,
    maxPixelCount: tier === "low" ? 1200000 : tier === "high" ? 4200000 : 2400000,
    loadOptionalAssets: !dataSaver,
    prefersReducedMotion: prefersReducedMotion === true,
  });
}

// Bound the drawing buffer by physical pixel count, not only devicePixelRatio.
// This prevents tall/high-density mobile screens from multiplying GPU work.
export function calculateKingdomPixelRatio({ width, height, devicePixelRatio = 1, profile } = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const requested = Math.max(0.1, Number(devicePixelRatio) || 1);
  const cap = Math.max(0.1, Number(profile?.pixelRatioCap) || 1);
  const budget = Math.max(250000, Number(profile?.maxPixelCount) || 1200000);
  const pixelBudgetCap = Math.sqrt(budget / (safeWidth * safeHeight));
  // Do not impose a 0.5 floor: on extreme high-density viewports it can break the pixel budget.
  return Math.min(requested, cap, pixelBudgetCap);
}
