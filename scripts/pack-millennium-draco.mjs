import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {measureBundledGlbs, projectGlbAddition} from "./millennium-art-budget.mjs";

const models = ["caro_farmstead", "caro_market", "caro_storehouse"];
const textures = ["caro_struct.png", "caro_struct_norm.png"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const [sourceDir, candidateDir] = process.argv.slice(2);
if (!sourceDir || !candidateDir) throw Error("Expected source and Draco candidate directories");

for (const texture of textures) {
  const source = await readFile(path.join(sourceDir, texture));
  const candidate = await readFile(path.join(candidateDir, texture));
  if (!source.equals(candidate)) throw Error("Draco candidate changed texture " + texture);
}

const results = [];
for (const name of models) {
  const document = JSON.parse(await readFile(path.join(candidateDir, name + ".gltf"), "utf8"));
  const buffer = document.buffers?.[0];
  if (document.buffers?.length !== 1 || buffer.uri !== name + ".bin" ||
      !document.extensionsRequired?.includes("KHR_draco_mesh_compression") ||
      !document.images?.length || document.images.some(image => !textures.includes(image.uri))) {
    throw Error("Unexpected Draco container: " + name);
  }
  const binary = await readFile(path.join(candidateDir, buffer.uri));
  if (binary.length !== buffer.byteLength) throw Error("Invalid Draco binary length: " + name);
  delete buffer.uri;

  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binaryLength = Math.ceil(binary.length / 4) * 4;
  const glb = Buffer.alloc(28 + jsonLength + binaryLength);
  glb.write("glTF", 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonLength, 12);
  glb.write("JSON", 16);
  glb.fill(0x20, 20, 20 + jsonLength);
  json.copy(glb, 20);
  glb.writeUInt32LE(binaryLength, 20 + jsonLength);
  glb.write("BIN\0", 24 + jsonLength);
  binary.copy(glb, 28 + jsonLength);
  await writeFile(path.join(candidateDir, name + ".glb"), glb);
  results.push({name, bytes:glb.length, sha256:sha256(glb)});
}

const manifest = JSON.parse(await readFile("assets/3d/manifest.json", "utf8"));
const currentBytes = await measureBundledGlbs(manifest);
const budget = projectGlbAddition(currentBytes, results.reduce((sum, model) => sum + model.bytes, 0));
const report = JSON.stringify({compression:"Draco with quantization", results, budget}, null, 2) + "\n";
await writeFile(path.join(candidateDir, "draco-budget.json"), report);
console.log(report);
if (!budget.allowed) process.exitCode = 1;
