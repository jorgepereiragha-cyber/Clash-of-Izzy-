import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isApprovedArtLicense } from "./art-license-policy.js";

const MAX_ASSETS = 64;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const JSON_CHUNK = 0x4e4f534a;

function fail(message) {
  throw new Error("Manifesto 3D inválido: " + message);
}

function decodePath(value, label) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("?") || value.includes("#") || value.includes("\0")) {
    fail(label + " contém um caminho inválido.");
  }
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    fail(label + " contém codificação de URL inválida.");
  }
  if (decoded.includes("\\") || decoded.includes("\0")) fail(label + " contém separador ou caractere inválido.");
  const segments = decoded.split("/");
  if (segments.some(part => part === "." || part === "..")) fail(label + " contém traversal de diretório.");
  return decoded;
}

async function resolveLocalFile(rootReal, relativePath, label) {
  const decoded = decodePath(relativePath, label);
  if (decoded.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(decoded)) fail(label + " deve ser um caminho local relativo.");
  const absolute = path.resolve(rootReal, decoded);
  if (!absolute.startsWith(rootReal + path.sep)) fail(label + " escapa da pasta de assets.");
  let actual;
  try {
    actual = await realpath(absolute);
  } catch {
    fail(label + " aponta para arquivo ausente.");
  }
  if (!actual.startsWith(rootReal + path.sep)) fail(label + " aponta para fora da pasta de assets por link simbólico.");
  return actual;
}

function parseGlb(bytes, src) {
  if (bytes.length < 20) fail(src + " é menor que um GLB mínimo.");
  if (bytes.toString("ascii", 0, 4) !== "glTF") fail(src + " não possui assinatura GLB.");
  if (bytes.readUInt32LE(4) !== 2) fail(src + " não é GLB 2.0.");
  if (bytes.readUInt32LE(8) !== bytes.length) fail(src + " declara um tamanho diferente do arquivo real.");

  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== JSON_CHUNK || jsonLength < 2 || jsonLength % 4 !== 0 || 20 + jsonLength > bytes.length) {
    fail(src + " possui chunk JSON inválido.");
  }
  let document;
  try {
    document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
  } catch {
    fail(src + " contém JSON glTF inválido.");
  }
  if (document?.asset?.version !== "2.0") fail(src + " não declara glTF 2.0.");
  return document;
}

function validateManifestEntry(asset, category, index) {
  const label = category + "[" + index + "]";
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) fail(label + " deve ser um objeto.");
  if (typeof asset.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(asset.id)) fail(label + ".id é inválido.");
  if (typeof asset.enabled !== "boolean") fail(label + ".enabled deve ser booleano.");
  if (typeof asset.src !== "string" || !asset.src.startsWith("/assets/3d/") || !asset.src.toLowerCase().endsWith(".glb")) {
    fail(label + ".src deve apontar para um GLB em /assets/3d/.");
  }
  if (typeof asset.source !== "string" || !asset.source.trim()) fail(label + ".source deve identificar a origem.");
  if (typeof asset.sourceUrl !== "string" || !/^https:\/\//i.test(asset.sourceUrl)) fail(label + ".sourceUrl deve usar HTTPS.");
  if (!isApprovedArtLicense(asset.license)) fail(label + ".license deve informar uma licença comercial aprovada.");
  if (category === "models" && (typeof asset.type !== "string" || !asset.type.trim())) fail(label + ".type é obrigatório.");
  if (category === "units" && (typeof asset.unit_type !== "string" || !asset.unit_type.trim())) fail(label + ".unit_type é obrigatório.");
  if (category === "props" && (!Array.isArray(asset.positions) || asset.positions.some(position =>
    !Array.isArray(position) || position.length !== 3 || position.some(value => !Number.isFinite(Number(value)))
  ))) fail(label + ".positions deve conter coordenadas [x, y, z].");
}

export async function validateAssetManifest(root = process.cwd()) {
  const assetsPath = path.resolve(root, "assets", "3d");
  let rootReal;
  try {
    rootReal = await realpath(assetsPath);
  } catch {
    fail("diretório assets/3d não encontrado.");
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(rootReal, "manifest.json"), "utf8"));
  } catch {
    fail("não foi possível ler assets/3d/manifest.json.");
  }
  if (!manifest || manifest.version !== 2) fail("esperada a versão 2 do manifesto.");
  const categories = ["models", "props", "units"];
  for (const category of categories) {
    if (!Array.isArray(manifest[category])) fail(category + " deve ser uma lista.");
  }

  const entries = categories.flatMap(category => manifest[category].map((asset, index) => ({ asset, category, index })));
  if (entries.length > MAX_ASSETS) fail("máximo de " + MAX_ASSETS + " assets no manifesto.");
  const ids = new Set();
  const sources = new Set();
  let totalBytes = 0;
  let enabled = 0;

  for (const { asset, category, index } of entries) {
    validateManifestEntry(asset, category, index);
    const label = category + "[" + index + "]";
    if (ids.has(asset.id)) fail("id duplicado: " + asset.id + ".");
    ids.add(asset.id);
    if (!asset.enabled) continue;

    const decodedSrc = decodePath(asset.src, label + ".src");
    if (!decodedSrc.startsWith("/assets/3d/")) fail(label + ".src não está dentro de /assets/3d/.");
    const relativeSrc = decodedSrc.slice("/assets/3d/".length);
    if (sources.has(relativeSrc)) fail("arquivo GLB duplicado: " + asset.src + ".");
    sources.add(relativeSrc);

    const filePath = await resolveLocalFile(rootReal, relativeSrc, label + ".src");
    const bytes = await readFile(filePath);
    if (bytes.length > MAX_FILE_BYTES) fail(asset.src + " excede 12 MiB.");
    const gltf = parseGlb(bytes, asset.src);
    totalBytes += bytes.length;
    enabled++;

    for (const [kind, records] of [["images", gltf.images || []], ["buffers", gltf.buffers || []]]) {
      if (!Array.isArray(records)) fail(asset.src + " possui " + kind + " inválidos.");
      for (const [resourceIndex, resource] of records.entries()) {
        if (!resource || typeof resource !== "object") fail(asset.src + " possui recurso " + kind + " inválido.");
        if (resource.uri === undefined) continue;
        if (typeof resource.uri !== "string" || /^https?:/i.test(resource.uri) || resource.uri.startsWith("//")) {
          fail(asset.src + " referencia recurso remoto em " + kind + "[" + resourceIndex + "].");
        }
        if (resource.uri.startsWith("data:")) continue;
        const glbDirectory = path.posix.dirname(relativeSrc);
        const resolvedUri = path.posix.normalize(path.posix.join(glbDirectory, resource.uri));
        const texturePath = await resolveLocalFile(rootReal, resolvedUri, asset.src + " -> " + kind + "[" + resourceIndex + "]");
        const stat = await readFile(texturePath);
        if (!stat.length) fail(asset.src + " referencia arquivo vazio: " + resource.uri + ".");
      }
    }
  }

  if (totalBytes > MAX_TOTAL_BYTES) fail("GLBs habilitados excedem o orçamento total de 48 MiB.");
  return { version: manifest.version, assets: entries.length, enabled, bytes: totalBytes };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  try {
    const result = await validateAssetManifest();
    console.log("Manifesto 3D válido: " + result.enabled + "/" + result.assets + " assets habilitados; " + result.bytes + " bytes de GLB.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
