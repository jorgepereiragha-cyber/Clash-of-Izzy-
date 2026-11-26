import { readFile, readdir, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { approvedManifestEntry, isApprovedArtLicense, hasShareAlikeProvenance } from "../scripts/art-license-policy.js";

const media = /\.(?:glb|gltf|bin|png|jpe?g|webp|ktx2|exr|hdr|ogg|mp3|wav)$/i;
function requireCondition(condition, message) { if (!condition) throw new Error(message); }
async function walk(dir, prefix) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix + "/" + item.name;
    requireCondition(!item.isSymbolicLink(), "Link simbólico não permitido: " + rel);
    if (item.isDirectory()) result.push(...await walk(path.join(dir,item.name),rel));
    else if (item.isFile() && media.test(item.name)) result.push(rel);
  }
  return result;
}
export async function auditArt(root = process.cwd()) {
  const manifest = JSON.parse(await readFile(path.join(root,"assets/3d/manifest.json"),"utf8"));
  const files = manifest.files;
  requireCondition(files && typeof files === "object" && !Array.isArray(files),"Registro de proveniência ausente");
  const actual = await walk(path.join(root,"assets/3d"),"/assets/3d");
  actual.push(...await walk(path.join(root,"assets/models"),"/assets/models"));
  const expected = Object.keys(files);
  requireCondition(actual.length === expected.length && actual.every(p=>Object.hasOwn(files,p)), "Arquivo de arte não registrado ou registro órfão");
  for (const p of actual) {
    const f = files[p];
    requireCondition(isApprovedArtLicense(f?.license) && typeof f.source === "string" && f.source.trim() && typeof f.attribution === "string" && f.attribution.trim(), "Licença ou autoria inválida: " + p);
    requireCondition(hasShareAlikeProvenance(f), "Proveniência share-alike incompleta: " + p);
    requireCondition(new URL(f.sourceUrl).protocol === "https:", "Fonte inválida: " + p);
    requireCondition(typeof f.licenseFile === "string" && /^licenses\/[a-zA-Z0-9._-]+\.txt$/.test(f.licenseFile), "Evidência de licença inválida: " + p);
    const evidence = path.join(root,"assets/3d",f.licenseFile);
    requireCondition((await lstat(evidence)).isFile() && (await readFile(evidence,"utf8")).trim().length > 0,"Evidência de licença ausente: " + p);
    const bytes = await readFile(path.join(root,p.slice(1)));
    requireCondition(bytes.length === f.bytes && createHash("sha256").update(bytes).digest("hex") === f.sha256, "Integridade SHA-256 inválida: " + p);
  }
  for (const category of ["models","props","units"]) for (const asset of manifest[category]) {
    requireCondition(approvedManifestEntry(asset,files),"Modelo sem licença aprovada: " + asset.id);
  }
  return { files: actual.length, models: actual.filter(p=>p.endsWith(".glb")).length };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { console.log("Auditoria de arte:", await auditArt()); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
