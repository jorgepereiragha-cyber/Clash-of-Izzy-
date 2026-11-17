import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THREE_ROOT = path.join(ROOT, "node_modules", "three");
const VENDOR_ROOT = path.join(ROOT, "vendor", "three");
const EXPECTED_THREE_VERSION = "0.187.0";

const ENTRYPOINTS = [
  "build/three.module.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/loaders/DRACOLoader.js",
  "examples/jsm/loaders/KTX2Loader.js",
  "examples/jsm/libs/meshopt_decoder.module.js",
  "examples/jsm/utils/SkeletonUtils.js",
  "examples/jsm/postprocessing/EffectComposer.js",
  "examples/jsm/postprocessing/RenderPass.js",
  "examples/jsm/postprocessing/ShaderPass.js",
  "examples/jsm/postprocessing/UnrealBloomPass.js",
  "examples/jsm/shaders/FXAAShader.js"
];

const RUNTIME_FILES = [
  "examples/jsm/libs/draco/draco_decoder.js",
  "examples/jsm/libs/draco/draco_decoder.wasm",
  "examples/jsm/libs/draco/draco_wasm_wrapper.js",
  "examples/jsm/libs/basis/basis_transcoder.js",
  "examples/jsm/libs/basis/basis_transcoder.wasm"
];


const copied = new Set();
const pending = [];
const importPattern = /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

function packagePath(relativePath) {
  const resolved = path.resolve(THREE_ROOT, relativePath);
  const relative = path.relative(THREE_ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho fora do pacote Three.js: " + relativePath);
  }
  return resolved;
}

async function copyFileIntoVendor(relativePath) {
  if (copied.has(relativePath)) return;
  const sourcePath = packagePath(relativePath);
  const destinationPath = path.join(VENDOR_ROOT, relativePath);
  let source;
  try {
    source = await readFile(sourcePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Arquivo necessário não encontrado em three@" + EXPECTED_THREE_VERSION + ": " + relativePath);
    }
    throw error;
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  copied.add(relativePath);

  if (!relativePath.endsWith(".js")) return;
  importPattern.lastIndex = 0;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), specifier));
    if (!dependency.endsWith(".js")) continue;
    pending.push(dependency);
  }
}

async function copyRuntimeFile(relativePath, optional = false) {
  const sourcePath = packagePath(relativePath);
  const destinationPath = path.join(VENDOR_ROOT, relativePath);
  try {
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    copied.add(relativePath);
  } catch (error) {
    if (optional && error.code === "ENOENT") return;
    throw new Error("Não foi possível copiar o recurso runtime " + relativePath + ": " + error.message);
  }
}

async function main() {
  let packageJson;
  try {
    packageJson = JSON.parse(await readFile(path.join(THREE_ROOT, "package.json"), "utf8"));
  } catch {
    throw new Error("Dependência three não instalada. Execute npm install antes de gerar os assets.");
  }
  if (packageJson.version !== EXPECTED_THREE_VERSION) {
    throw new Error("Versão Three.js divergente: esperada " + EXPECTED_THREE_VERSION + ", encontrada " + packageJson.version + ".");
  }

  await rm(VENDOR_ROOT, { recursive: true, force: true });
  await mkdir(VENDOR_ROOT, { recursive: true });

  for (const entry of ENTRYPOINTS) await copyFileIntoVendor(entry);
  while (pending.length) {
    const dependency = pending.pop();
    if (!copied.has(dependency)) await copyFileIntoVendor(dependency);
  }
  for (const file of RUNTIME_FILES) await copyRuntimeFile(file);

  await copyFile(path.join(THREE_ROOT, "LICENSE"), path.join(VENDOR_ROOT, "LICENSE"));
  const assets = [...copied].sort().map(file => "/vendor/three/" + file.replaceAll(path.sep, "/"));
  const manifest = {
    format: 1,
    threeVersion: packageJson.version,
    assets
  };
  await writeFile(
    path.join(VENDOR_ROOT, "asset-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  await writeFile(
    path.join(VENDOR_ROOT, "THIRD_PARTY_NOTICES.md"),
    [
      "# Third-party notices",
      "",
      "This directory is generated from the exact npm package version three@" + packageJson.version + ".",
      "The Three.js MIT license is included in LICENSE.",
      "Draco and Basis Universal decoder/transcoder files are copied from the Three.js package without modification.",
      "Their upstream notices, when supplied by the package, are retained alongside the files.",
      "Meshopt decoder code is copied from the same pinned Three.js package.",
      "",
      "Do not edit generated files here. Update the pinned dependency and regenerate with npm run vendor:three."
    ].join("\n") + "\n",
    "utf8"
  );

  console.log(
    "Three.js " + packageJson.version + " preparado localmente: " +
    assets.length + " arquivos runtime em /vendor/three."
  );
}

main().catch(error => {
  console.error("[vendor:three] " + error.message);
  process.exitCode = 1;
});
