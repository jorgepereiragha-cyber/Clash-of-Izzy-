import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../assets/3d/manifest.json", import.meta.url), "utf8"));
const toUrl = path => new URL("../" + path.replace(/^\/+/, ""), import.meta.url);

test("bundled Kenney, KayKit and Quaternius assets keep CC0 provenance and a bounded local footprint", () => {
  assert.equal(manifest.version, 2);
  assert.ok(manifest.models.length >= 2);
  assert.ok(manifest.props.length >= 2);
  assert.ok(manifest.units.some(item => item.unit_type === "archer"));
  for (const asset of [...manifest.models, ...manifest.props, ...manifest.units]) {
    assert.equal(asset.enabled, !["kaykit-blue-iron-mine", "kenney-castle-watchtower", "kenney-castle-wall"].includes(asset.id), asset.id);
    assert.equal(asset.license, "CC0-1.0");
    assert.match(asset.sourceUrl, /^https:\/\/(?:kenney\.nl\/assets\/|quaternius\.com\/packs\/|poly\.pizza\/m\/|github\.com\/KayKit-Game-Assets\/(?:KayKit-Medieval-Hexagon-Pack-1\.0|KayKit-Character-Pack-Adventures-1\.0)\/tree\/[a-f0-9]{40}$)/);
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
      if(image.uri===undefined){assert.ok(Number.isInteger(image.bufferView),asset.id+" embedded image");continue;}
      assert.ok(image.uri, asset.id + " should use a readable local texture URI");
      assert.ok(!/^https?:/i.test(image.uri), asset.id + " must not request a third-party texture");
      const texturePath = relativePath.slice(0, relativePath.lastIndexOf("/") + 1) + image.uri;
      const texture = await readFile(toUrl(texturePath));
      assert.ok(texture.byteLength > 0, texturePath);
    }
  }
  assert.ok(totalBytes < 4_600_000, "bundled GLBs must remain under 4.6 MB (including siege workshop)");
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

test("KayKit civic models share the local atlas and preserve the original license", async () => {
  const assets = manifest.models.filter(asset => asset.id.startsWith("kaykit-blue-"));
  assert.deepEqual(assets.map(asset => asset.type).sort(), ["barracks", "iron_mine", "market"]);
  assert.deepEqual(assets.filter(asset => asset.enabled).map(asset=>asset.type).sort(), ["barracks", "market"]);
  assert.match(await readFile(toUrl("/assets/3d/licenses/KayKit-Medieval-Hexagon.txt"), "utf8"), /Creative Commons Zero, CC0/);
  for (const asset of assets) {
    const data = await readFile(toUrl(asset.src));
    const length = data.readUInt32LE(12);
    const gltf = JSON.parse(data.subarray(20,20+length).toString("utf8").trim());
    assert.equal(gltf.buffers[0].uri, undefined);
    assert.ok(gltf.images.length > 0);
    assert.ok(gltf.images.every(image => image.uri === "hexagons_medieval.png"));
    assert.equal(data.readUInt32LE(24+length), 0x004e4942);
    assert.ok(gltf.buffers[0].byteLength <= data.readUInt32LE(20+length));
  }
});

test("Quaternius imports preserve local provenance and real GLB models",()=>{
 for(const type of ["archery_range","academy","warehouse","embassy","swordsman","farm","lumber_mill","stable"]){
 const a=[...manifest.models,...manifest.units].find(x=>x.id==="quaternius-"+type.replace("_","-"));assert.ok(a?.enabled);assert.equal(manifest.files[a.src].license,"CC0-1.0");assert.match(manifest.files[a.src].sha256,/^[a-f0-9]{64}$/);
 }
});

test("equipped dragon GLB is local, rigged and has a flight clip", async()=>{
 const a=manifest.units.find(x=>x.unit_type==="equipped_dragon");
 assert.ok(a?.enabled); assert.equal(a.maxInstances,1); assert.equal(a.animation,"Flying_Idle");
 const b=await readFile(toUrl(a.src)); const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString("utf8").trim());
 assert.ok(g.skins.length); assert.ok(g.animations.some(x=>x.name===a.animation));
 assert.ok([...(g.images||[]),...(g.buffers||[])].every(x=>x.uri===undefined));
 assert.equal(manifest.files[a.src].license,"CC0-1.0");
});

test("KayKit militia and mage contain local rigged idle and locomotion animations",async()=>{
 for(const type of ["militia","mage"]){const a=manifest.units.find(x=>x.unit_type===type);assert.ok(a?.enabled);assert.equal(a.animation,"Idle");assert.equal(a.maxInstances,2);const b=await readFile(toUrl(a.src));const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString("utf8").trim());assert.ok(g.skins.length);for(const clip of ["Idle","Running_A","Walking_A"])assert.ok(g.animations.some(x=>x.name===clip));assert.ok([...(g.images||[]),...(g.buffers||[])].every(x=>x.uri===undefined));}
 assert.match(await readFile(toUrl("/assets/3d/licenses/KayKit-Adventurers.txt"),"utf8"),/Creative Commons Zero, CC0/);
});

test("fortified castle gate uses embedded stone, wood and heraldry materials",async()=>{
 const a=manifest.models.find(x=>x.type==="castle_gate");assert.ok(a?.enabled);assert.equal(a.id,"quaternius-castle-gate");assert.ok(a.targetFootprint<=1.45);
 const b=await readFile(toUrl(a.src));const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString("utf8").trim());
 for(const name of ["Stone","Stone_Light","Wood","Main"])assert.ok(g.materials.some(x=>x.name===name));assert.ok(!g.images?.length);assert.equal(manifest.files[a.src].license,"CC0-1.0");
});

test("catapult and ram use existing licensed castle kit texture without duplicate files",async()=>{
 for(const type of ["catapult","ram"]){const a=manifest.units.find(x=>x.unit_type===type);assert.ok(a?.enabled);assert.equal(a.maxInstances,2);const b=await readFile(toUrl(a.src));const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString("utf8").trim());assert.ok(g.meshes.length>=6);assert.deepEqual(g.images.map(x=>x.uri),["Textures/colormap.png"]);assert.equal(manifest.files[a.src].license,"CC0-1.0");}
});

test("photo-scanned stone and timber are audited local CC0 maps with a mobile budget",async()=>{
 const {CITY_SCANNED_MATERIALS,scannedMaterialResolution,neutralizeScanColor}=await import("../scripts/city-scanned-materials.js");
 assert.deepEqual(CITY_SCANNED_MATERIALS,manifest.scannedMaterials);
 let total=0;for(const paths of Object.values(CITY_SCANNED_MATERIALS))for(const src of Object.values(paths)){const b=await readFile(toUrl(src));assert.equal(b.readUInt16BE(0),0xffd8);assert.equal(b.readUInt16BE(b.length-2),0xffd9);assert.equal(manifest.files[src].bytes,b.length);assert.equal(manifest.files[src].license,"CC0-1.0");total+=b.length;}
 assert.ok(total<=2100000);
 assert.equal(scannedMaterialResolution({tier:"low",loadOptionalAssets:false,pbrMaps:false}),0);
 assert.equal(scannedMaterialResolution({tier:"balanced",loadOptionalAssets:true,pbrMaps:true}),256);
 assert.equal(scannedMaterialResolution({tier:"high",loadOptionalAssets:true,pbrMaps:true}),512);
 const p=neutralizeScanColor(Uint8ClampedArray.from([10,20,30,255,90,100,110,255]));assert.ok(p[0]===p[1]&&p[1]===p[2]&&p[0]<p[4]&&p[3]===255);
});


test("siege workshop uses distinct local CC0 art without external dependencies", async () => {
  const asset = manifest.models.find(a => a.type === "siege_workshop");
  assert.equal(asset?.id, "quaternius-siege-workshop");
  assert.equal(asset.enabled, true);
  const provenance = manifest.files[asset.src];
  assert.equal(provenance.license, "CC0-1.0");
  const b = await readFile(toUrl(asset.src));
  assert.equal(b.length, 670832);
  const g = JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString("utf8").trim());
  assert.ok(g.meshes.length > 0);
  assert.ok(g.materials.some(m => m.name === "RoofTiles_Red"));
  assert.ok([...(g.images || []), ...(g.buffers || [])].every(x => x.uri === undefined));
  assert.equal(Object.values(manifest.files).filter(x => x.sha256 === provenance.sha256).length, 1);
});
