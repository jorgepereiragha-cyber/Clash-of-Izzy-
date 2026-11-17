import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFile(path.join(ROOT, relative), "utf8");

test("Three.js runtime is vendored from the exact pinned npm version", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const manifest = JSON.parse(await read("vendor/three/asset-manifest.json"));
  assert.equal(packageJson.devDependencies.three, "0.187.0");
  assert.equal(manifest.threeVersion, packageJson.devDependencies.three);

  const required = [
    "/vendor/three/build/three.module.js",
    "/vendor/three/examples/jsm/loaders/GLTFLoader.js",
    "/vendor/three/examples/jsm/loaders/DRACOLoader.js",
    "/vendor/three/examples/jsm/loaders/KTX2Loader.js",
    "/vendor/three/examples/jsm/libs/meshopt_decoder.module.js",
    "/vendor/three/examples/jsm/libs/draco/draco_decoder.wasm",
    "/vendor/three/examples/jsm/libs/draco/draco_wasm_wrapper.js",
    "/vendor/three/examples/jsm/libs/basis/basis_transcoder.wasm",
    "/vendor/three/examples/jsm/libs/basis/basis_transcoder.js"
  ];
  for (const url of required) {
    assert.ok(manifest.assets.includes(url), "asset ausente no manifesto local: " + url);
    const file = path.join(ROOT, url.slice(1));
    assert.ok((await stat(file)).size > 0, "asset local vazio: " + url);
  }
});

test("3D entry points and page import maps no longer depend on a Three.js CDN", async () => {
  const [kingdom, world, postProcessing, kingdomHtml, worldHtml, arenaHtml] = await Promise.all([
    read("scripts/kingdom-3d.js"),
    read("world-map-3d.js"),
    read("scripts/post-processing.js"),
    read("kingdom.html"),
    read("world.html"),
    read("arena.html")
  ]);
  for (const source of [kingdom, world, postProcessing, kingdomHtml, worldHtml, arenaHtml]) {
    assert.doesNotMatch(source, /cdn\.jsdelivr\.net\/npm\/three/i);
  }
  for (const html of [kingdomHtml, worldHtml, arenaHtml]) {
    assert.match(html, /"three":"\/vendor\/three\/build\/three\.module\.js"/);
    assert.match(html, /"three\/addons\/":"\/vendor\/three\/examples\/jsm\//);
  }
  assert.match(kingdom, /from "three"/);
  assert.match(kingdom, /from "three\/addons\/loaders\/DRACOLoader\.js"/);
  assert.match(kingdom, /setDecoderPath\("\/vendor\/three\/examples\/jsm\/libs\/draco\/gltf\/"/);
  assert.match(kingdom, /setTranscoderPath\("\/vendor\/three\/examples\/jsm\/libs\/basis\/"/);
  assert.match(world, /from "three"/);
  assert.match(postProcessing, /from "three\/addons\/postprocessing\/EffectComposer\.js"/);
});

test("the Service Worker precaches all vendored Three.js modules and decoder binaries", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /vendor\/three\/asset-manifest\.json/);
  assert.match(sw, /manifest\.assets/);
  assert.match(sw, /clash-of-izzy-shell-v32/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});
