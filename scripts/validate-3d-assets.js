import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const BUILDING_TYPES = new Set(["castle","barracks","farm","quarry","lumber_mill","iron_mine","market","academy","wall","hospital","watchtower","stable","archery_range","siege_workshop","embassy","warehouse"]);
const MAX_MODELS = 32, MAX_MODEL_BYTES = 12 * 1024 * 1024, MAX_TOTAL_BYTES = 48 * 1024 * 1024;
function fail(message) { throw new Error("Manifesto 3D inválido: " + message); }
export async function validateAssetManifest(root = process.cwd()) {
  const manifestPath = path.join(root, "assets", "3d", "manifest.json");
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); }
  catch (error) { fail("não foi possível ler assets/3d/manifest.json (" + error.message + ")"); }
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.models)) fail("esperado { version: 1, models: [] }.");
  if (manifest.models.length > MAX_MODELS) fail("máximo de " + MAX_MODELS + " modelos por manifesto.");
  const types = new Set(), sources = new Set(); let totalBytes = 0;
  for (const [index, model] of manifest.models.entries()) {
    const label = "models[" + index + "]";
    if (!model || typeof model !== "object" || Array.isArray(model)) fail(label + " deve ser um objeto.");
    if (!BUILDING_TYPES.has(model.type)) fail(label + ".type não corresponde a um edifício suportado.");
    if (types.has(model.type)) fail("tipo duplicado: " + model.type + ".");
    types.add(model.type);
    if (typeof model.enabled !== "boolean") fail(label + ".enabled deve ser booleano.");
    if (model.enabled !== true) continue;
    if (typeof model.src !== "string" || !model.src.startsWith("/assets/3d/") || model.src.includes("\\") || model.src.includes("?") || model.src.includes("#")) fail(label + ".src deve apontar para um GLB local em /assets/3d/.");
    if (model.src.split("/").some(part => part === "." || part === "..") || !model.src.toLowerCase().endsWith(".glb")) fail(label + ".src contém caminho inválido ou não termina em .glb.");
    if (sources.has(model.src)) fail("arquivo GLB duplicado: " + model.src + ".");
    sources.add(model.src);
    const absolutePath = path.resolve(root, "." + model.src);
    const assetsRoot = path.resolve(root, "assets", "3d") + path.sep;
    if (!absolutePath.startsWith(assetsRoot)) fail(label + ".src escapa do diretório de assets.");
    let bytes; try { bytes = await readFile(absolutePath); } catch { fail("arquivo não encontrado: " + model.src + "."); }
    if (bytes.length < 20) fail(model.src + " é menor que o cabeçalho GLB mínimo.");
    if (bytes.length > MAX_MODEL_BYTES) fail(model.src + " excede 12 MiB.");
    if (bytes.toString("ascii", 0, 4) !== "glTF") fail(model.src + " não possui assinatura GLB.");
    if (bytes.readUInt32LE(4) !== 2) fail(model.src + " não está no formato GLB 2.0.");
    if (bytes.readUInt32LE(8) !== bytes.length) fail(model.src + " declara tamanho GLB inconsistente.");
    totalBytes += bytes.length;
  }
  if (totalBytes > MAX_TOTAL_BYTES) fail("o conjunto de GLBs habilitados excede 48 MiB.");
  return { models: manifest.models.length, enabled: sources.size, bytes: totalBytes };
}
const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  try { const result = await validateAssetManifest(); console.log("Manifesto 3D válido: " + result.enabled + " GLB(s) habilitado(s), " + result.bytes + " bytes."); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
