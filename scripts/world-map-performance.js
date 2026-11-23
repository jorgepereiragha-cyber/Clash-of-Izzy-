// Small and testable: no WebGL import and no persistence of device information.
export function shouldForceWorld2D({deviceMemory, hardwareConcurrency} = {}) {
  const memory = Number(deviceMemory);
  const cores = Number(hardwareConcurrency);
  if (!Number.isFinite(memory) || memory <= 0) return false;
  if (memory <= 2) return true;
  return memory <= 3 && Number.isFinite(cores) && cores > 0 && cores <= 4;
}

// Count only consecutive active animation frames. Suspended/background frames
// must never trigger a spurious downgrade after returning from another tab.
export function createWorldFpsMonitor({windowMs = 3000, minSamples = 20, threshold = 22} = {}) {
  let previous = 0;
  let started = 0;
  let samples = [];
  return {
    reset() { previous = 0; started = 0; samples = []; },
    sample(timestamp) {
      if (!Number.isFinite(timestamp) || timestamp < 0) return null;
      if (!previous) { previous = timestamp; started = timestamp; return null; }
      const delta = timestamp - previous;
      previous = timestamp;
      if (delta > 250) { started = timestamp; samples = []; return null; }
      if (delta >= 5) {
        samples.push(Math.min(120, 1000 / delta));
        if (samples.length > 60) samples.shift();
      }
      if (timestamp - started < windowMs) return null;
      const avg = samples.length >= minSamples
        ? samples.reduce((sum, fps) => sum + fps, 0) / samples.length : null;
      started = timestamp;
      samples = [];
      return avg !== null && avg < threshold ? avg : null;
    }
  };
}
