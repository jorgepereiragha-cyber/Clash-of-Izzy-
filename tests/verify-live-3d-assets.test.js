import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { getExpectedVisualPaths, verifyLive3dAssets } from "../scripts/verify-live-3d-assets.mjs";

const TOWER = "/assets/3d/kenney/castle-kit/Models/GLB format/tower-square.glb";
const WALL = "/assets/3d/kenney/castle-kit/Models/GLB format/wall.glb";
const TREE = "/assets/3d/kenney/mini-forest/Models/GLB format/tree-high.glb";

function manifest() {
  return {
    version: 2,
    models: [
      { id: "kenney-castle-watchtower", enabled: true, src: TOWER },
      { id: "kenney-castle-wall", enabled: true, src: WALL },
    ],
    props: [{ id: "kenney-tree-high", enabled: true, src: TREE }],
    units: [],
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "coi-live-3d-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = new Map([
    ["/assets/3d/manifest.json", Buffer.from(JSON.stringify(manifest()))],
    ["/scripts/kingdom-3d.js", Buffer.from("function createCastleGlbGroup() { return true; }")],
    [TOWER, Buffer.from("glTF TOWER contents")],
    [WALL, Buffer.from("glTF WALL contents")],
    [TREE, Buffer.from("glTF TREE contents")],
  ]);
  for (const [path, bytes] of files) {
    const location = resolve(root, "." + path);
    await mkdir(dirname(location), { recursive: true });
    await writeFile(location, bytes);
  }
  return { root, files };
}

test("comprova por SHA-256 o manifesto, renderer e GLBs publicados sem alterar dados", async t => {
  const { root, files } = await fixture(t);
  const calls = [];
  const result = await verifyLive3dAssets({
    rootDir: root,
    baseUrl: "https://clash-of-izzy.example.workers.dev/",
    fetchImpl: async (url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      const path = decodeURIComponent(new URL(url).pathname);
      calls.push(path);
      return new Response(files.get(path) || "not found", { status: files.has(path) ? 200 : 404 });
    },
  });
  assert.equal(result.filesChecked, 5);
  assert.equal(result.glbFiles, 3);
  assert.equal(result.sha256Matched, true);
  assert.deepEqual(calls, [...files.keys()].sort((a, b) => {
    const ordered = getExpectedVisualPaths(manifest());
    return ordered.indexOf(a) - ordered.indexOf(b);
  }));
});

test("bloqueia deploy quando o castelo servido difere do commit aprovado", async t => {
  const { root, files } = await fixture(t);
  const fetchImpl = async url => {
    const path = decodeURIComponent(new URL(url).pathname);
    const bytes = path === TOWER ? Buffer.from("glTF TOWER corrupted") : files.get(path);
    return new Response(bytes, { status: 200 });
  };
  await assert.rejects(
    verifyLive3dAssets({ rootDir: root, baseUrl: "https://example.workers.dev/", fetchImpl }),
    /Asset visual divergente.*tower-square\.glb/
  );
});

test("bloqueia GLB faltante, renderer atrasado e origem HTTP", async t => {
  const { root, files } = await fixture(t);
  const missing = async url => {
    const path = decodeURIComponent(new URL(url).pathname);
    return new Response(files.get(path) || "not found", { status: path === TREE ? 404 : 200 });
  };
  await assert.rejects(
    verifyLive3dAssets({ rootDir: root, baseUrl: "https://example.workers.dev/", fetchImpl: missing }),
    /Asset visual não publicado.*tree-high\.glb/
  );
  const old = async url => {
    const path = decodeURIComponent(new URL(url).pathname);
    const bytes = path === "/scripts/kingdom-3d.js" ? "old renderer" : files.get(path);
    return new Response(bytes, { status: 200 });
  };
  await assert.rejects(
    verifyLive3dAssets({ rootDir: root, baseUrl: "https://example.workers.dev/", fetchImpl: old }),
    /Asset visual divergente.*kingdom-3d\.js/
  );
  await assert.rejects(
    verifyLive3dAssets({ rootDir: root, baseUrl: "http://example.workers.dev/", fetchImpl: missing }),
    /Origem HTTPS/
  );
});

test("rejeita manifesto sem castelo ou árvore obrigatórios e tentativas de travessia", () => {
  const noTree = manifest();
  noTree.props = [];
  assert.throws(() => getExpectedVisualPaths(noTree), /kenney-tree-high/);
  const malicious = manifest();
  malicious.models[0].src = "/assets/3d/../private.glb";
  assert.throws(() => getExpectedVisualPaths(malicious), /Caminho de GLB inválido/);
  assert.throws(() => getExpectedVisualPaths({ ...manifest(), version: 1 }), /v2 obrigatório/);
});

test("workflow protegido inclui atestação visual e o script não é asset público", async () => {
  const flow = await readFile(new URL("../.github/workflows/deploy-worker-only.yml", import.meta.url), "utf8");
  const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
  assert.match(flow, /node scripts\/verify-live-3d-assets\.mjs/);
  assert.match(flow, /npx wrangler --config wrangler\.jsonc deploy/);
  assert.doesNotMatch(flow, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.match(ignore, /^scripts\/\*\.mjs$/m);
});
