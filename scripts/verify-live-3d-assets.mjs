// Read-only attestation that the deployed 3D files are byte-for-byte identical
// to the approved GitHub Actions checkout. No account, D1 or payment writes.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PRODUCTION_BASE_URL = "https://clash-of-izzy.jorgepereiragha.workers.dev";
const MAX_ASSETS = 16;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeGlbPath(src) {
  if (typeof src !== "string" || !src.startsWith("/assets/3d/") ||
      !src.endsWith(".glb") || src.includes("\\") || src.includes("%") ||
      src.includes("?") || src.includes("#") ||
      src.split("/").some(part => part === "." || part === "..")) {
    throw new Error("Caminho de GLB inválido no manifesto: " + String(src));
  }
  return src;
}

export function getExpectedVisualPaths(manifest) {
  if (!manifest || manifest.version !== 2) {
    throw new Error("Manifesto 3D v2 obrigatório para esta publicação.");
  }
  const required = [
    ["models", "kenney-castle-watchtower"],
    ["models", "kenney-castle-wall"],
    ["props", "kenney-tree-high"],
  ];
  for (const [section, id] of required) {
    if (!Array.isArray(manifest[section]) ||
        !manifest[section].some(entry => entry?.id === id && entry.enabled === true)) {
      throw new Error("GLB essencial não habilitado: " + id);
    }
  }
  const paths = new Set();
  for (const section of ["models", "props", "units"]) {
    if (!Array.isArray(manifest[section])) throw new Error("Seção ausente do manifesto: " + section);
    for (const entry of manifest[section]) {
      if (entry?.enabled === true) paths.add(safeGlbPath(entry.src));
    }
  }
  if (paths.size < 3 || paths.size > MAX_ASSETS) {
    throw new Error("Quantidade de GLBs habilitados fora do limite.");
  }
  return [
    "/scripts/kingdom-3d.js",
    "/assets/3d/manifest.json",
    ...paths,
  ];
}

export async function verifyLive3dAssets({
  baseUrl = PRODUCTION_BASE_URL,
  rootDir = PROJECT_ROOT,
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Origem HTTPS de publicação inválida.");
  }

  const manifestBytes = await readFile(resolve(rootDir, "assets/3d/manifest.json"));
  const paths = getExpectedVisualPaths(JSON.parse(manifestBytes.toString("utf8")));

  // Build expected hashes before requesting any public URL. A missing local
  // file must fail even if the remote version happens to be healthy.
  const expected = new Map();
  for (const path of paths) {
    const bytes = await readFile(resolve(rootDir, "." + path));
    if (!bytes.byteLength || bytes.byteLength > MAX_ASSET_BYTES) {
      throw new Error("Arquivo local ausente ou acima do limite: " + path);
    }
    expected.set(path, { size: bytes.byteLength, digest: hash(bytes) });
  }

  for (const path of paths) {
    const response = await fetchImpl(new URL(path, base).toString(), {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Accept": "*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 200) {
      throw new Error("Asset visual não publicado: " + path + " (HTTP " + response.status + ")");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const reference = expected.get(path);
    if (bytes.byteLength !== reference.size || hash(bytes) !== reference.digest) {
      throw new Error("Asset visual divergente da versão aprovada: " + path);
    }
  }

  return { origin: base.origin, filesChecked: paths.length, glbFiles: paths.length - 2, sha256Matched: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyLive3dAssets().then(result => {
    console.log("Visual release attested (read-only): " + JSON.stringify(result));
  }).catch(error => {
    console.error("Visual release NOT attested: " + String(error?.message || error));
    process.exitCode = 1;
  });
}
