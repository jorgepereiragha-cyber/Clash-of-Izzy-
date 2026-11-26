// Shared browser/CI policy; only explicitly approved commercial art.
export const ART_LICENSES = Object.freeze(["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-3.0"]);
export function isApprovedArtLicense(value) { return ART_LICENSES.includes(value); }
// Share-alike applies to the individual adapted art file, not a silent relicensing.
export function hasShareAlikeProvenance(file) {
  if (file?.license !== "CC-BY-SA-3.0") return true;
  return file.licenseUrl === "https://creativecommons.org/licenses/by-sa/3.0/" &&
    file.adaptedArtLicense === file.license &&
    typeof file.modifications === "string" && !!file.modifications.trim() &&
    typeof file.licenseFile === "string" && /^licenses\/[a-zA-Z0-9._-]+\.txt$/.test(file.licenseFile);
}
export function approvedManifestEntry(asset, files) {
  if (!asset || typeof asset.src !== "string" || !asset.src.startsWith("/assets/3d/") || !asset.src.endsWith(".glb") || !Object.hasOwn(files || {}, asset.src)) return false;
  const file = files[asset.src];
  if (!file || !hasShareAlikeProvenance(file) || !isApprovedArtLicense(asset.license) || file.license !== asset.license || file.source !== asset.source || file.sourceUrl !== asset.sourceUrl || typeof file.attribution !== "string" || !file.attribution.trim() || !/^[a-f0-9]{64}$/.test(file.sha256)) return false;
  try { return new URL(file.sourceUrl).protocol === "https:"; } catch { return false; }
}
