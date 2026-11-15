import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const files = [
  "../navigation.js",
  "../world-map.js",
  "../equipment-system.js",
  "../scripts/kingdom-3d.js",
  "../scripts/kingdom-quality.js",
  "../engine/asset-loader.js",
  "../engine/resource-disposal.js",
  "../engine/texture-manager.js"
];

test("browser game modules parse before deployment", () => {
  for (const relative of files) {
    const path = fileURLToPath(new URL(relative, import.meta.url));
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, relative + " syntax error:\n" + result.stderr + result.stdout);
  }
});
