import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../assets/3d/manifest.json", import.meta.url), "utf8"));
const toUrl = path => new URL("../" + path.replace(/^\/+/, ""), import.meta.url);

test("bundled Kenney assets keep CC0 provenance and a bounded local footprint", () => {
  assert.equal(manifest.version, 2);
  assert.ok(manifest.models.length >= 2);
  assert.ok(manifest.props.length >= 2);
  assert.ok(manifest.units.some(item => item.unit_type === "archer"));
  for (const asset of [...manifest.models, ...manifest.props, ...manifest.units]) {
    assert.equal(asset.enabled, true);
    assert.equal(asset.license, "CC0-1.0");
    assert.match(asset.sourceUrl, /^https:\/\/kenney\.nl\/assets\//);
    assert.ok(asset.src.startsWith("/assets/3d/"));
    assert.ok(asset.src.endsWith(".glb"));
  }
});

test("every bundled GLB is valid glTF 2.0 and its referenced textures are local", async () => {
  let totalBytes = 0;
  for (const asset of [...manifest.models, ...manifest.props, ...manifest.units]) {
    const relativePath = asset.src.replace(/^\//, "");
    const data = await readFile(toUrl(relativePath));
    totalBytes += data.byteLength;
    assert.equal(data.toString("ascii", 0, 4), "glTF", asset.id);
    assert.equal(data.readUInt32LE(4), 2, asset.id);
    assert.equal(data.readUInt32LE(8), data.byteLength, asset.id);

    const jsonLength = data.readUInt32LE(12);
    const document = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8").trim());
    assert.equal(document.asset?.version, "2.0", asset.id);
    for (const image of document.images || []) {
      assert.ok(image.uri, asset.id + " should use a readable local texture URI");
      assert.ok(!/^https?:/i.test(image.uri), asset.id + " must not request a third-party texture");
      const texturePath = relativePath.slice(0, relativePath.lastIndexOf("/") + 1) + image.uri;
      const texture = await readFile(toUrl(texturePath));
      assert.ok(texture.byteLength > 0, texturePath);
    }
  }
  assert.ok(totalBytes < 1_000_000, "optional 3D downloads must remain under 1 MB");
});

test("archer asset includes the idle clip and both original CC0 license files are preserved", async () => {
  const archer = manifest.units.find(item => item.unit_type === "archer");
  assert.ok(archer);
  const data = await readFile(toUrl(archer.src));
  const jsonLength = data.readUInt32LE(12);
  const document = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8").trim());
  assert.ok(document.animations?.some(animation => animation.name.toLowerCase() === "idle"));

  const castleLicense = await readFile(new URL("../assets/3d/licenses/Kenney-Castle-Kit.txt", import.meta.url), "utf8");
  const forestLicense = await readFile(new URL("../assets/3d/licenses/Kenney-Mini-Forest.txt", import.meta.url), "utf8");
  assert.match(castleLicense, /Creative Commons Zero, CC0/i);
  assert.match(forestLicense, /Creative Commons Zero, CC0/i);
});
