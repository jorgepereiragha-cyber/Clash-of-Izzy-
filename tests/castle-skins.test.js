import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getCastleSkinStyle } from "../castle-skin-styles.js";

test("six launch skins have distinct visual identities", () => {
  const names = [
    "Fortaleza do Dragão Dourado",
    "Fortaleza do Dragão Imperial",
    "Fortaleza do Dragão Ancestral",
    "Fortaleza do Dragão Místico",
    "Fortaleza do Dragão Lunar",
    "Fortaleza do Dragão Solar",
  ];
  const styles = names.map(name => getCastleSkinStyle(name));
  assert.ok(styles.every(Boolean));
  assert.equal(new Set(styles.map(style => style.wall)).size, 6);
  assert.equal(new Set(styles.map(style => style.roof)).size, 6);
});

test("legacy owned skins receive a deterministic appearance without a second inventory", () => {
  assert.ok(getCastleSkinStyle("Skin antiga sem nome no mapa", 37));
  assert.equal(getCastleSkinStyle("", 0), null);
});

test("skin selection migration stores only the selected reference and preserves existing ownership", async () => {
  const migration = await readFile(new URL("../migrations/0027_equipped_castle_skins.sql", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN equipped_skin_id INTEGER REFERENCES skins\(id\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM (players|kingdoms|player_skins)/i);
  assert.match(worker, /JOIN player_skins ps JOIN players p ON p.id=ps.player_id/);
  assert.match(worker, /UPDATE kingdoms SET equipped_skin_id=/);
  assert.match(worker, /Você não possui esta skin/);
});
