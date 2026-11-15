import fs from "node:fs";
import vm from "node:vm";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
if (manifest.display !== "standalone") throw new Error("PWA must use standalone display mode");
if (!manifest.start_url || !fs.existsSync(manifest.start_url.replace(/^\//, ""))) throw new Error("PWA start_url does not exist");
if (!fs.existsSync("sw.js")) throw new Error("Service worker is missing");
const sw = fs.readFileSync("sw.js", "utf8");
const match = sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
if (!match) throw new Error("Service worker core asset list is missing");
const assets = [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
for (const asset of assets) {
  const localPath = asset === "/" ? "index.html" : asset.replace(/^\//, "");
  if (!fs.existsSync(localPath)) throw new Error("PWA offline asset missing: " + asset);
}
for (const icon of manifest.icons || []) {
  const path = icon.src.replace(/^\//, "");
  if (!fs.existsSync(path)) throw new Error("PWA icon missing: " + icon.src);
}
if (!fs.existsSync("offline.html")) throw new Error("Offline fallback is missing");
console.log("PWA validation passed: manifest, start URL, icons, offline page and cached shell assets.");

for (const file of ["index.html", "command-center.html"]) {
  const html = fs.readFileSync(file, "utf8");
  const inlineScripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)];
  for (const [index, match] of inlineScripts.entries()) {
    if (match[1].trim()) new vm.Script(match[1], { filename: file + "#inline-" + index });
  }
}
console.log("Inline PWA scripts parsed successfully.");
