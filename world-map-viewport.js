export function clampMapViewport({ zoom = 1, panX = 0, panY = 0, width = 0, height = 0 } = {}) {
  const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const safeZoom = Math.max(1, Math.min(3, finite(zoom, 1)));
  const safeWidth = Math.max(0, finite(width));
  const safeHeight = Math.max(0, finite(height));
  const maxX = safeWidth * (safeZoom - 1) / 2;
  const maxY = safeHeight * (safeZoom - 1) / 2;
  return {
    zoom: safeZoom,
    panX: normalizeZero(Math.max(-maxX, Math.min(maxX, finite(panX)))),
    panY: normalizeZero(Math.max(-maxY, Math.min(maxY, finite(panY))),
  };
}

export function nextMapZoom(currentZoom, delta) {
  const current = Number.isFinite(Number(currentZoom)) ? Number(currentZoom) : 1;
  const change = Number.isFinite(Number(delta)) ? Number(delta) : 0;
  return Math.max(1, Math.min(3, current + change));
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}
export function mapViewportTransform({ zoom = 1, panX = 0, panY = 0 } = {}) {
  const safeCoordinate = value => {
    const number = Number(value);
    return normalizeZero(Number.isFinite(number) ? Math.round(number * 100) / 100 : 0);
  };
  const rawZoom = Number(zoom);
  const safeZoom = Number.isFinite(rawZoom) ? Math.max(1, Math.min(3, rawZoom)) : 1;
  return "translate3d(" + safeCoordinate(panX) + "px, " + safeCoordinate(panY) + "px, 0) scale(" + safeZoom + ")";
}
