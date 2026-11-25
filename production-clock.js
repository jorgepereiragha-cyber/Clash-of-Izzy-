// Keep fractional seconds across resource settlement; cap offline catch-up at seven days.
export function productionWindow(now, last) {
  const delta = Number.isFinite(last) ? Math.max(0, now - last) : 0;
  const elapsed = Math.min(7 * 24 * 3600, Math.floor(delta / 1000));
  return { elapsed, timestamp: new Date(now - delta % 1000).toISOString() };
}
