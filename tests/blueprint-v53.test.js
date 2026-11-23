import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("castle upgrades não mutam materiais compartilhados nem permanecem em clones removidos", async () => {
  const [module, renderer, view] = await Promise.all([
    read("scripts/castle-visual-upgrades.js"),
    read("scripts/kingdom-3d.js"),
    read("kingdom.html")
  ]);
  assert.match(module, /WeakMap\(\)/);
  assert.match(module, /disposeCastleVisualUpgrades/);
  assert.doesNotMatch(module, /child\.material\s*=|castle\.traverse\(/);
  assert.match(renderer, /disposeCastleVisualUpgrades\(item\)/);
  assert.match(renderer, /applyCastleVisualUpgrades\(group, b\.level, latestCastleVipLevel\)/);
  assert.match(view, /castleVipLevel:window\.__coiKingdomCastleVipLevel/);
});

test("service worker mantém shell essencial e trata falha de recursos opcionais", async () => {
  const sw = await read("sw.js");
  assert.ok(Number(sw.match(/clash-of-izzy-shell-v(\d+)/)?.[1]) >= 54, "PWA cache must include kingdom session recovery");
  assert.doesNotMatch(sw, /cache\\.addAll\\(required\\)/);
  assert.match(sw, /if \\(!canStoreResponse\\(response\\)\\) throw new Error/);
  assert.match(sw, /credentials: "omit"/);
  assert.match(sw, /Promise\.allSettled/);
  assert.match(sw, /canStoreResponse\(response\)/);
  assert.match(sw, /new Response\("Sem conexão/);
});
