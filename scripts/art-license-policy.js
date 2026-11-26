// Shared browser/CI policy; only explicitly approved commercial art.
export const ART_LICENSES = Object.freeze(["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0"]);
export function isApprovedArtLicense(value) { return ART_LICENSES.includes(value); }
export function approvedManifestEntry(asset, files) {
  if (!asset || typeof asset.src !== "string" || !asset.src.startsWith("/assets/3d/") || !asset.src.endsWith(".glb") || !Object.hasOwn(files || {}, asset.src)) return false;
  const file = files[asset.src];
  if (!file || !isApprovedArtLicense(asset.license) || file.license !== asset.license || file.source !== asset.source || file.sourceUrl !== asset.sourceUrl || typeof file.attribution !== "string" || !file.attribution.trim() || !/^[a-f0-9]{64}$/.test(file.sha256)) return false;
  try { return new URL(file.sourceUrl).protocol === "https:"; } catch { return false; }
}
