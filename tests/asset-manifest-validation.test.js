import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAssetManifest } from "../scripts/validate-3d-assets.js";

async function fixture({ models = [], props = [], units = [], files = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "coi-assets-v2-"));
  await mkdir(path.join(root, "assets", "3d", "models"), { recursive: true });
  await writeFile(path.join(root, "assets", "3d", "manifest.json"), JSON.stringify({ version: 2, models, props, units }));
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(root, "assets", "3d", name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return root;
}

function glb(document = { asset: { version: "2.0" }, scenes: [{ nodes: [] }] }) {
  const json = Buffer.from(JSON.stringify(document).padEnd(Math.ceil(JSON.stringify(document).length / 4) * 4, " "), "utf8");
  const result = Buffer.alloc(20 + json.length);
  result.write("glTF", 0, "ascii");
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  json.copy(result, 20);
  return result;
}
const baseAsset = (id, src, enabled = true) => ({
  id, src, enabled, source: "Teste local", sourceUrl: "https://example.com/source", license: "CC0-1.0", type: "watchtower",
});

test("validates the current version-2 manifest and every enabled GLB", async () => {
  const result = await validateAssetManifest(process.cwd());
  assert.equal(result.version, 2);
  assert.ok(result.enabled >= 5);
  assert.ok(result.bytes > 0 && result.bytes < 48 * 1024 * 1024);
});

test("accepts model, prop and unit entries with local GLB files", async () => {
  const root = await fixture({
    models: [baseAsset("model-tower", "/assets/3d/models/tower.glb")],
    props: [{ ...baseAsset("prop-tree", "/assets/3d/models/tree.glb"), positions: [[0, 0, 0]] }],
    units: [{ ...baseAsset("unit-archer", "/assets/3d/models/archer.glb"), unit_type: "archer" }],
    files: { "models/tower.glb": glb(), "models/tree.glb": glb(), "models/archer.glb": glb() },
  });
  try {
    const result = await validateAssetManifest(root);
    assert.equal(result.enabled, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects duplicate ids and duplicate GLB source paths across categories", async () => {
  const duplicateId = await fixture({
    models: [baseAsset("same-id", "/assets/3d/models/a.glb")],
    units: [{ ...baseAsset("same-id", "/assets/3d/models/b.glb"), unit_type: "archer" }],
    files: { "models/a.glb": glb(), "models/b.glb": glb() },
  });
  try { await assert.rejects(validateAssetManifest(duplicateId), /id duplicado/); }
  finally { await rm(duplicateId, { recursive: true, force: true }); }

  const duplicateSrc = await fixture({
    models: [baseAsset("model-one", "/assets/3d/models/a.glb")],
    props: [{ ...baseAsset("prop-two", "/assets/3d/models/a.glb"), positions: [[0, 0, 0]] }],
    files: { "models/a.glb": glb() },
  });
  try { await assert.rejects(validateAssetManifest(duplicateSrc), /arquivo GLB duplicado/); }
  finally { await rm(duplicateSrc, { recursive: true, force: true }); }
});

test("rejects traversal, remote URLs and encoded traversal before opening files", async () => {
  for (const src of [
    "https://example.com/model.glb",
    "/assets/3d/../secret.glb",
    "/assets/3d/%2e%2e/secret.glb",
    "/assets/3d/models/model.gltf",
  ]) {
    const root = await fixture({ models: [baseAsset("model-one", src)] });
    try { await assert.rejects(validateAssetManifest(root)); }
    finally { await rm(root, { recursive: true, force: true }); }
  }
});

test("rejects missing, malformed or non-v2 GLB files", async () => {
  const missing = await fixture({ models: [baseAsset("missing", "/assets/3d/models/missing.glb")] });
  try { await assert.rejects(validateAssetManifest(missing), /ausente/); }
  finally { await rm(missing, { recursive: true, force: true }); }

  const malformedBytes = Buffer.alloc(24);
  const malformed = await fixture({
    models: [baseAsset("malformed", "/assets/3d/models/bad.glb")],
    files: { "models/bad.glb": malformedBytes },
  });
  try { await assert.rejects(validateAssetManifest(malformed), /assinatura GLB/); }
  finally { await rm(malformed, { recursive: true, force: true }); }

  const versionOne = glb({ asset: { version: "1.0" } });
  const old = await fixture({
    models: [baseAsset("old", "/assets/3d/models/old.glb")],
    files: { "models/old.glb": versionOne },
  });
  try { await assert.rejects(validateAssetManifest(old), /glTF 2.0/); }
  finally { await rm(old, { recursive: true, force: true }); }
});

test("rejects remote glTF textures and symbolic links escaping the asset folder", async () => {
  const remote = await fixture({
    models: [baseAsset("remote", "/assets/3d/models/remote.glb")],
    files: { "models/remote.glb": glb({ asset: { version: "2.0" }, images: [{ uri: "https://example.com/image.png" }] }) },
  });
  try { await assert.rejects(validateAssetManifest(remote), /recurso remoto/); }
  finally { await rm(remote, { recursive: true, force: true }); }

  const root = await fixture({ models: [baseAsset("linked", "/assets/3d/models/linked.glb")] });
  const outside = path.join(root, "outside.glb");
  await writeFile(outside, glb());
  await symlink(outside, path.join(root, "assets", "3d", "models", "linked.glb"));
  try { await assert.rejects(validateAssetManifest(root), /link simbólico/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test("enforces per-model and total model budgets", async () => {
  const oversized = await fixture({
    models: [baseAsset("oversized", "/assets/3d/models/big.glb")],
    files: { "models/big.glb": Buffer.concat([glb(), Buffer.alloc(12 * 1024 * 1024)]) },
  });
  try { await assert.rejects(validateAssetManifest(oversized), /12 MiB/); }
  finally { await rm(oversized, { recursive: true, force: true }); }
});

test("rejects an enabled GLB whose external texture or buffer path escapes the asset directory", async () => {
  const escaping = await fixture({
    models: [baseAsset("escape", "/assets/3d/models/escape.glb")],
    files: { "models/escape.glb": glb({ asset: { version: "2.0" }, images: [{ uri: "../../outside.png" }] }) },
  });
  try { await assert.rejects(validateAssetManifest(escaping), /traversal|escapa/); }
  finally { await rm(escaping, { recursive: true, force: true }); }
});

test("kingdom scene manifest expands defensive props and supports per-instance orientation", async () => {
  const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(
    new URL("../assets/3d/manifest.json", import.meta.url), "utf8"
  ));
  const renderer = await (await import("node:fs/promises")).readFile(
    new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8"
  );
  const trebuchet = manifest.props.find(item => item.id === "kenney-siege-trebuchet");
  const trees = manifest.props.find(item => item.id === "kenney-tree-high");
  assert.equal(trebuchet.positions.length, 2);
  assert.equal(trebuchet.rotations.length, 2);
  assert.equal(trees.positions.length, 6);
  assert.match(renderer, /asset\.rotations\?\.\[index\]/);
  assert.match(renderer, /instanceRotation\.every\(value => Number\.isFinite\(Number\(value\)\)\)/);
});
