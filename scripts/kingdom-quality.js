// Perfis gráficos conservadores baseados em capacidade do dispositivo.
// A largura CSS afeta o custo de sombras, não define a capacidade da GPU.
export function selectKingdomQualityProfile({
  deviceMemory = 0,
  hardwareConcurrency = 4,
  viewportWidth = 720,
  maxTextureSize = 4096,
  saveData = false,
  prefersReducedMotion = false,
  preferredTier = "auto",
} = {}) {
  const memory = Number.isFinite(Number(deviceMemory)) ? Number(deviceMemory) : 0;
  const cores = Number.isFinite(Number(hardwareConcurrency)) ? Number(hardwareConcurrency) : 4;
  const width = Math.max(1, Number(viewportWidth) || 1);
  const textureLimit = Math.max(0, Number(maxTextureSize) || 0);
  const dataSaver = saveData === true;

  // A tela de 360–430 px é comum em Android e não deve rebaixar um aparelho capaz.
  const low = dataSaver
    || (memory > 0 && memory <= 4)
    || (cores > 0 && cores <= 4)
    || (textureLimit > 0 && textureLimit < 4096);
  const high = !low && memory >= 8 && cores >= 8 && textureLimit >= 8192;
  // Manual choices never bypass Data Saver or hard hardware limits.
  const severeLimits = (memory > 0 && memory <= 2)
    || (cores > 0 && cores <= 2)
    || (textureLimit > 0 && textureLimit < 2048);
  const requested = ["low", "balanced", "high"].includes(preferredTier) ? preferredTier : null;
  const highUnsafe = (memory > 0 && memory < 6)
    || (cores > 0 && cores < 6)
    || (textureLimit > 0 && textureLimit < 8192);
  const tier = dataSaver || severeLimits ? "low"
    : requested === "high" && highUnsafe ? "balanced"
    : requested || (low ? "low" : high ? "high" : "balanced");

  return Object.freeze({
    tier,
    pixelRatioCap: tier === "low" ? 1 : tier === "high" ? 1.5 : 1.25,
    shadows: !dataSaver && (tier === "high" || (tier === "balanced" && width > 1024)),
    shadowMapSize: tier === "high" ? 1536 : tier === "balanced" ? 1024 : 512,
    anisotropy: tier === "high" ? 8 : tier === "balanced" ? 4 : 2,
    surfaceTextureSize: tier === "high" ? 512 : tier === "balanced" ? 256 : 128,
    pbrMaps: tier !== "low",
    maxBuildings: tier === "low" ? 8 : tier === "balanced" ? 12 : 16,
    maxPixelCount: tier === "low" ? 1200000 : tier === "high" ? 4200000 : 2400000,
    loadOptionalAssets: !dataSaver && tier !== "low",
    prefersReducedMotion: prefersReducedMotion === true,
  });
}

// Limita o buffer de desenho pelo número total de pixels, não só pelo DPR.
export function calculateKingdomPixelRatio({ width, height, devicePixelRatio = 1, profile } = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const requested = Math.max(0.1, Number(devicePixelRatio) || 1);
  const cap = Math.max(0.1, Number(profile?.pixelRatioCap) || 1);
  const budget = Math.max(250000, Number(profile?.maxPixelCount) || 1200000);
  const pixelBudgetCap = Math.sqrt(budget / (safeWidth * safeHeight));
  return Math.min(requested, cap, pixelBudgetCap);
}

// Mede intervalos entre callbacks requestAnimationFrame. Não representa tempo
// de GPU nem garante FPS sustentado; a memória do sampler é limitada.
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

// Ajuste conservador de resolucao para animacoes do reino em modo Automatico.
// Usa intervalos entre frames (proxy para fluidez, nao tempo de GPU) e evita
// oscilacoes frequentes de tamanho do framebuffer em aparelhos Android.
export function createAdaptivePixelScaleController({
  sampleWindow = 90,
  minScale = 0.7,
  downStep = 0.1,
  upStep = 0.05,
  recoveryWindows = 3
} = {}) {
  const windowSize = Math.max(30, Math.min(240, Math.floor(sampleWindow) || 90));
  const floor = Math.max(0.5, Math.min(0.95, Number(minScale) || 0.7));
  const down = Math.max(0.01, Math.min(0.2, Number(downStep) || 0.1));
  const up = Math.max(0.01, Math.min(0.15, Number(upStep) || 0.05));
  const recovery = Math.max(2, Math.min(8, Math.floor(recoveryWindows) || 3));
  const samples = [];
  let scale = 1;
  let quickWindows = 0;
  return Object.freeze({
    get scale() { return scale; },
    reset() { samples.length = 0; quickWindows = 0; },
    observe(intervalMs) {
      const ms = Number(intervalMs);
      // Atrasos de aba suspensa, depuracao ou navegador em segundo plano
      // nao representam carga de GPU e nunca devem degradar a imagem.
      if (!Number.isFinite(ms) || ms <= 0 || ms > 250) {
        samples.length = 0;
        quickWindows = 0;
        return false;
      }
      samples.push(ms);
      if (samples.length < windowSize) return false;
      const sorted = samples.sort((a, b) => a - b);
      const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
      const p50 = percentile(0.5), p95 = percentile(0.95);
      samples.length = 0;
      if (p50 > 21 && p95 > 28) {
        quickWindows = 0;
        const next = Math.max(floor, Number((scale - down).toFixed(2)));
        if (next === scale) return false;
        scale = next;
        return true;
      }
      if (p50 < 17.5 && p95 < 19) {
        quickWindows += 1;
        if (quickWindows < recovery) return false;
        quickWindows = 0;
        const next = Math.min(1, Number((scale + up).toFixed(2)));
        if (next === scale) return false;
        scale = next;
        return true;
      }
      quickWindows = 0;
      return false;
    }
  });
}
