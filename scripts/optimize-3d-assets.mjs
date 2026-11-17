import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "assets", "3d", "manifest.json");
const OUTPUT_DIR = path.join(ROOT, "node_modules", ".cache", "clash-of-izzy", "3d-optimization");

function runTransform(args, label) {
  const result = spawnSync("gltf-transform", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw new Error(label + ": " + result.error.message);
  if (result.status !== 0) throw new Error(label + " terminou com código " + result.status + ".");
}

function safeAssetSource(src) {
  if (typeof src !== "string" || !src.startsWith("/assets/3d/") || !src.toLowerCase().endsWith(".glb")) {
    throw new Error("Origem GLB inválida no manifesto: " + String(src));
  }
  const absolute = path.resolve(ROOT, "." + src);
  const root = path.resolve(ROOT, "assets", "3d") + path.sep;
  if (!absolute.startsWith(root)) throw new Error("Caminho de asset fora de assets/3d: " + src);
  return absolute;
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(1) + " KiB";
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const entries = ["models", "props", "units"]
    .flatMap(category => Array.isArray(manifest[category]) ? manifest[category] : [])
    .filter(asset => asset?.enabled === true);

  if (!entries.length) throw new Error("O manifesto não possui GLBs habilitados.");
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const report = [];
  const seen = new Set();
  for (const asset of entries) {
    if (seen.has(asset.src)) continue;
    seen.add(asset.src);
    const input = safeAssetSource(asset.src);
    const inputStat = await stat(input);
    const id = String(asset.id || path.basename(input, ".glb"));
    if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(id)) throw new Error("ID de asset inválido: " + id);

    const variants = {};
    for (const format of ["draco", "meshopt"]) {
      const output = path.join(OUTPUT_DIR, id + "." + format + ".glb");
      const args = format === "draco"
        ? ["draco", input, output, "--method", "edgebreaker"]
        : ["meshopt", input, output, "--level", "medium"];

      runTransform(args, asset.id + " (" + format + ")");
      runTransform(["validate", output], asset.id + " validação (" + format + ")");
      const outputStat = await stat(output);
      variants[format] = {
        path: path.relative(ROOT, output).split(path.sep).join("/"),
        bytes: outputStat.size,
        deltaPercent: Number(((1 - outputStat.size / inputStat.size) * 100).toFixed(2))
      };
    }

    report.push({
      id,
      source: asset.src,
      originalBytes: inputStat.size,
      variants
    });
    console.log(
      asset.id + ": original " + formatBytes(inputStat.size) +
      " | Draco " + formatBytes(variants.draco.bytes) + " (" + variants.draco.deltaPercent + "%) " +
      "| Meshopt " + formatBytes(variants.meshopt.bytes) + " (" + variants.meshopt.deltaPercent + "%)"
    );
  }

  const summary = {
    format: 1,
    sourceManifestVersion: manifest.version,
    note: "A/B comparison only. Original manifest paths are unchanged; generated variants are not used by the game.",
    assets: report
  };
  await writeFile(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(summary, null, 2) + "\n");
  const markdown = [
    "# 3D asset compression report",
    "",
    "Generated from the enabled GLBs in assets/3d/manifest.json.",
    "Original models and runtime manifest were not modified.",
    "",
    "| Asset | Original | Draco | Draco reduction | Meshopt | Meshopt reduction |",
    "|---|---:|---:|---:|---:|---:|",
    ...report.map(item =>
      "| " + item.id + " | " + item.originalBytes + " B | " + item.variants.draco.bytes +
      " B | " + item.variants.draco.deltaPercent + "% | " + item.variants.meshopt.bytes +
      " B | " + item.variants.meshopt.deltaPercent + "% |"
    ),
    "",
    "Compression variants must pass a visual and device benchmark before the runtime manifest is changed."
  ].join("\n") + "\n";
  await writeFile(path.join(OUTPUT_DIR, "report.md"), markdown);
  console.log("Comparação concluída. Relatórios: node_modules/.cache/clash-of-izzy/3d-optimization/report.{json,md}");
}

main().catch(error => {
  console.error("[assets:optimize] " + error.message);
  process.exitCode = 1;
});
