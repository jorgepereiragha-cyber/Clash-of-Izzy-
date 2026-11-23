import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TARGETS, verifyDeployedAssets } from "../scripts/verify-deployed-assets.mjs";

const fixture = new Map([
  ["public-portal/portal.html", Buffer.from("<html>portal atualizado</html>")],
  ["public-portal/styles/coi-theme.css", Buffer.from("body{color:gold}")],
  ["public-portal/assets/brand/royal-king.webp", Buffer.from([0x52,0x49,0x46,0x46])],
  ["scripts/kingdom-3d.js", Buffer.from("function createCastleGlbGroup() {}")],
  ["assets/3d/manifest.json", Buffer.from(JSON.stringify({
    models: [{ src: "/assets/3d/castle/tower-square.glb", enabled: true }],
    props: [{ src: "/assets/3d/forest/tree high.glb", enabled: true }],
    units: [{ src: "/assets/3d/disabled.glb", enabled: false }]
  }))],
  ["assets/3d/castle/tower-square.glb", Buffer.from("glTF-test-tower")],
  ["assets/3d/forest/tree high.glb", Buffer.from("glTF-test-tree")],
]);
const readLocal = async path => {
  if (!fixture.has(path)) throw Error("Fixture ausente: " + path);
  return fixture.get(path);
};
function createFetch({replace, status = 200} = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), ...options });
    const pathname = decodeURIComponent(url.pathname);
    let localPath;
    if (url.origin === TARGETS.portal.origin) localPath = "public-portal" + pathname;
    if (url.origin === TARGETS.worker.origin) localPath = pathname.slice(1);
    const actual = replace?.(pathname, fixture.get(localPath)) ?? fixture.get(localPath);
    return new Response(actual ?? "not found", { status: actual ? status : 404 });
  };
  return { fetchImpl, requests };
}

test("portal: verifies exact HTML, CSS and brand image with read-only GET", async () => {
  const { fetchImpl, requests } = createFetch();
  const report = await verifyDeployedAssets({ target: "portal", readLocal, fetchImpl, revision: "abcdef123" });
  assert.deepEqual(report, { target: "portal", checked: 3, exactBytes: true });
  assert.equal(requests.length, 3);
  assert(requests.every(x => x.method === "GET" && x.url.includes("coi_revision=abcdef123")));
  assert(requests.every(x => x.url.startsWith(TARGETS.portal.origin)));
});

test("worker: verifies renderer, manifest and each enabled GLB", async () => {
  const { fetchImpl, requests } = createFetch();
  const result = await verifyDeployedAssets({ target: "worker", readLocal, fetchImpl });
  assert.equal(result.checked, 4);
  assert(requests.some(x => x.url.includes("tree%20high.glb")));
  assert(!requests.some(x => x.url.includes("disabled.glb")));
});

test("fails closed on stale portal bytes", async () => {
  const { fetchImpl } = createFetch({ replace: pathname => pathname === "/portal.html" ? Buffer.from("old HTML") : undefined });
  await assert.rejects(verifyDeployedAssets({ target: "portal", readLocal, fetchImpl }), /asset divergente/);
});

test("fails closed on stale Worker GLB", async () => {
  const { fetchImpl } = createFetch({replace: pathname => pathname === "/assets/3d/castle/tower-square.glb" ? Buffer.alloc(0) : undefined});
  await assert.rejects(verifyDeployedAssets({ target: "worker", readLocal, fetchImpl }), /asset divergente/);
});

test("rejects untrusted manifest traversal", async () => {
  const readTampered = async path => path === "assets/3d/manifest.json" ? Buffer.from('{"models":[{"src":"/assets/3d/../../private"}]}') : readLocal(path);
  await assert.rejects(verifyDeployedAssets({ target: "worker", readLocal: readTampered, fetchImpl: () => { throw Error("Must not fetch"); } }), /caminho inseguro/);
});

test("workflows pin SHA and verify deployed assets without D1 writes", async () => {
  const portal = await readFile(new URL("../.github/workflows/publicar-portal-cloudflare.yml", import.meta.url), "utf8");
  const worker = await readFile(new URL("../.github/workflows/deploy-worker-only.yml", import.meta.url), "utf8");
  assert.match(portal, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(portal, /verify-deployed-assets\.mjs portal/);
  assert.match(worker, /verify-deployed-assets\.mjs worker/);
  assert.match(portal, /confirm_portal_publish:/);
  assert.match(worker, /confirm_worker_publish:/);
  assert.doesNotMatch(worker, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.doesNotMatch(portal, /d1 migrations apply clash-of-izzy-db --remote/);
});

test("release workflows retry briefly, but fail closed if Cloudflare never serves approved bytes", async () => {
  for (const filename of [
    ".github/workflows/publicar-portal-cloudflare.yml",
    ".github/workflows/deploy-worker-only.yml",
  ]) {
    const workflow = await readFile(new URL("../" + filename, import.meta.url), "utf8");
    assert.match(workflow, /for attempt in 1 2 3 4 5; do/);
    assert.match(workflow, /if \[\[ "\$attempt" -lt 5 \]\]; then sleep 6; fi/);
    assert.match(workflow, /echo "::error::Assets /);
    assert.match(workflow, /\n          exit 1(?:\n|$)/);
    assert.match(workflow, /environment:\s*\n\s+name: production/);
  }
});
