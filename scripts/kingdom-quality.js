// Conservative, capability-based quality tiers for the WebGL kingdom renderer.
// This deliberately avoids guessing Android thermal state from unsupported web APIs.
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
  const textureLimit = Math.max(0, Number(maxTextureSize) || 0);
  const width = Math.max(1, Number(viewportWidth) || 1); // usado só no custo de sombras, nunca no tier
  const dataSaver = saveData === true;

  // CSS viewport width is a layout measurement, not a reliable GPU capability signal.
  // A narrow Android viewport must not downgrade a device with capable memory/GPU.
  const low = dataSaver
    || (memory > 0 && memory <= 4)
    || (cores > 0 && cores <= 4)
    || (textureLimit > 0 && textureLimit < 4096);
  const high = !low && memory >= 8 && cores >= 8 && textureLimit >= 8192;
  const tier = low ? "low" : high ? "high" : "balanced";

  return Object.freeze({
    tier,
    pixelRatioCap: tier === "low" ? 1 : tier === "high" ? 1.5 : 1.25,
    shadows: !dataSaver && (tier === "high" || (tier === "balanced" && width > 1024)),
    shadowMapSize: tier === "high" ? 1536 : tier === "balanced" ? 1024 : 512,
    anisotropy: tier === "high" ? 8 : tier === "balanced" ? 4 : 2,
    surfaceTextureSize: tier === "high" ? 512 : tier === "balanced" ? 256 : 128,
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


// A bounded sampler for requestAnimationFrame cadence. Values describe callback
// intervals only; they are not GPU execution time or a sustained-FPS guarantee.
export function createFrameTimingSampler(maxSamples = 120) {
  const limit = Math.max(1, Math.min(600, Math.floor(Number(maxSamples) || 120)));
  const samples = [];

  return Object.freeze({
    record(intervalMs) {
      const value = Number(intervalMs);
      if (!Number.isFinite(value) || value <= 0) return;
      samples.push(value);
      if (samples.length > limit) samples.shift();
    },
    reset() {
      samples.length = 0;
    },
    snapshot() {
      if (!samples.length) return { sampleCount: 0, p50Ms: null, p95Ms: null };
      const sorted = [...samples].sort((a, b) => a - b);
      const at = percentile => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)];
      return {
        sampleCount: sorted.length,
        p50Ms: Number(at(0.5).toFixed(2)),
        p95Ms: Number(at(0.95).toFixed(2))
      };
    }
  });
}
