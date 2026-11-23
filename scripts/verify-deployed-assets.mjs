// Read-only release verification: prove Cloudflare serves the exact bytes
// checked out by the protected workflow. This never writes to D1 or game APIs.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const TARGETS = Object.freeze({
  portal: {
    origin: "https://clash-of-izzy-portal.jorgepereiragha.workers.dev",
    assets: [
      ["public-portal/portal.html", "/portal.html"],
      ["public-portal/styles/coi-theme.css", "/styles/coi-theme.css"],
      ["public-portal/assets/brand/royal-king.webp", "/assets/brand/royal-king.webp"],
    ],
  },
  worker: {
    origin: "https://clash-of-izzy.jorgepereiragha.workers.dev",
    assets: [
      ["scripts/kingdom-3d.js", "/scripts/kingdom-3d.js"],
      ["assets/3d/manifest.json", "/assets/3d/manifest.json"],
    ],
  },
});

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyDeployedAssets({
  target,
  fetchImpl = fetch,
  readLocal = path => readFile(new URL("../" + path, import.meta.url)),
  revision = process.env.GITHUB_SHA || "manual",
} = {}) {
  const config = Object.hasOwn(TARGETS, target) && TARGETS[target];
  if (!config) throw new Error("Target inválido: use portal ou worker.");
  const files = [...config.assets];

  if (target === "worker") {
    const manifest = JSON.parse((await readLocal("assets/3d/manifest.json")).toString("utf8"));
    for (const entry of [...(manifest.models || []), ...(manifest.props || []), ...(manifest.units || [])]) {
      if (entry.enabled === false) continue;
      const src = entry.src;
      if (typeof src !== "string" || !src.startsWith("/assets/3d/") ||
          src.includes("\\") || src.includes("?") || src.includes("#") ||
          src.split("/").includes("..") || src.split("/").includes(".")) {
        throw new Error("Asset GLB contém caminho inseguro.");
      }
      files.push([src.slice(1), src]);
    }
  }

  for (const [localPath, remotePath] of files) {
    const expectedBytes = await readLocal(localPath);
    const url = new URL(remotePath, config.origin);
    url.searchParams.set("coi_revision", String(revision).slice(0, 40));
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: target === "portal" && remotePath === "/portal.html" ? "follow" : "error",
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "*/*", "Cache-Control": "no-cache" },
    });
    if (!response || response.status !== 200 || response.redirected && remotePath !== "/portal.html") {
      throw new Error("Deploy incompleto: " + remotePath + " HTTP " + (response?.status ?? "sem resposta"));
    }
    if (response.url && new URL(response.url).origin !== config.origin) {
      throw new Error("Deploy redirecionou asset para outro domínio: " + remotePath);
    }
    const actualBytes = Buffer.from(await response.arrayBuffer());
    if (digest(actualBytes) !== digest(expectedBytes)) {
      throw new Error("Versão antiga ou asset divergente em " + remotePath);
    }
    console.log("Asset publicado confirmado: " + remotePath + " (" + actualBytes.length + " bytes)");
  }
  return { target, checked: files.length, exactBytes: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDeployedAssets({ target: process.argv[2] }).then(result => {
    console.log("Cloudflare asset release verificada: " + JSON.stringify(result));
  }).catch(error => {
    console.error("Cloudflare asset release não comprovada: " + String(error?.message || error));
    process.exitCode = 1;
  });
}
