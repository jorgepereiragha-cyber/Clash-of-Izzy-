import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ignore = (await readFile(new URL("../.assetsignore", import.meta.url), "utf8"))
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("#"));

test("public static assets exclude server-only code, tests and local secrets", () => {
  for (const pattern of [
    "worker.js",
    "api-rate-limit.js",
    "game-adapter.js",
    "tests/**",
    "migrations/**",
    ".dev.vars",
    ".dev.vars.*",
    ".env",
    ".env.*",
    ".wrangler/**",
    "*.pem",
    "*.key",
  ]) {
    assert.ok(ignore.includes(pattern), `missing static-asset exclusion: ${pattern}`);
  }
});

test("public client modules and game assets remain eligible for delivery", () => {
  for (const publicPath of [
    "equipment-engine.js",
    "equipment-lab.js",
    "scripts/kingdom-3d.js",
    "scripts/kingdom-quality.js",
    "engine/asset-loader.js",
    "engine/texture-manager.js",
    "assets/3d/manifest.json",
  ]) {
    assert.ok(
      !ignore.some(pattern => publicPath === pattern || publicPath.startsWith(pattern.replace(/\*\*$/, ""))),
      `public client asset must not be excluded: ${publicPath}`
    );
  }
});
