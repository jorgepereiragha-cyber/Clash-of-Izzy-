import test from "node:test";
import assert from "node:assert/strict";
import { SKIN_SET_CATALOG, PANTHEON_SKIN_ITEMS, buildSkinSetGallery, getSkinSetBonuses } from "../skin-sets.js";

function ownedSetPieces(set, count = 5) {
  return set.items.slice(0, count).map(item => ({
    item_id: item.id,
    equipped_slot: item.slot
  }));
}

test("cada panteão oferece cinco peças em cinco espaços distintos", () => {
  assert.equal(SKIN_SET_CATALOG.length, 4);
  for (const set of SKIN_SET_CATALOG) {
    assert.equal(set.items.length, 5, set.name);
    assert.deepEqual(
      new Set(set.items.map(item => item.slot)).size,
      5,
      "espaços repetidos em " + set.name
    );
    for (const item of set.items) {
      assert.ok(PANTHEON_SKIN_ITEMS[item.id], "peça não está no catálogo de compra: " + item.id);
      assert.ok(item.price > 0);
    }
  }
});

test("o conjunto egípcio concede bônus progressivo somente por peças equipadas", () => {
  const egypt = SKIN_SET_CATALOG.find(set => set.id === "egyptian_solar_court");
  assert.ok(egypt);
  const two = getSkinSetBonuses(ownedSetPieces(egypt, 2));
  assert.equal(two.activeSets[0].requiredPieces, 2);
  assert.equal(two.attackPercent, 0);
  assert.equal(two.defensePercent, 0.5);

  const three = getSkinSetBonuses(ownedSetPieces(egypt, 3));
  assert.equal(three.activeSets[0].requiredPieces, 3);
  assert.equal(three.attackPercent, 0.75);
  assert.equal(three.defensePercent, 0.5);

  const five = getSkinSetBonuses(ownedSetPieces(egypt, 5));
  assert.equal(five.activeSets[0].requiredPieces, 5);
  assert.equal(five.attackPercent, 2);
  assert.equal(five.defensePercent, 1.5);
  assert.equal(five.healthPercent, 1);
  assert.equal(five.criticalChancePercent, 0.5);
});

test("possuir peças sem equipá-las não libera conjunto", () => {
  const egypt = SKIN_SET_CATALOG.find(set => set.id === "egyptian_solar_court");
  const rows = egypt.items.map(item => ({ item_id: item.id, equipped_slot: null }));
  const state = getSkinSetBonuses(rows);
  assert.equal(state.activeSets.length, 0);
  assert.equal(state.attackPercent, 0);
  assert.equal(state.defensePercent, 0);
});

test("bônus de diferentes conjuntos respeitam limites globais", () => {
  const rows = SKIN_SET_CATALOG.flatMap(set => ownedSetPieces(set, 5));
  const state = getSkinSetBonuses(rows);
  assert.equal(state.activeSets.length, 4);
  assert.equal(state.attackPercent, state.caps.attackPercent);
  assert.equal(state.defensePercent, state.caps.defensePercent);
  assert.equal(state.healthPercent, state.caps.healthPercent);
  assert.equal(state.criticalChancePercent, state.caps.criticalChancePercent);
});

test("galeria informa propriedade, espaço equipado e próximo marco", () => {
  const egypt = SKIN_SET_CATALOG.find(set => set.id === "egyptian_solar_court");
  const rows = [
    { item_id: egypt.items[0].id, equipped_slot: "head" },
    { item_id: egypt.items[1].id, equipped_slot: null }
  ];
  const gallery = buildSkinSetGallery(rows);
  const set = gallery.sets.find(item => item.id === egypt.id);
  assert.equal(set.items[0].owned, true);
  assert.equal(set.items[0].equipped, true);
  assert.equal(set.items[1].owned, true);
  assert.equal(set.items[1].equipped, false);
  assert.equal(set.equippedCount, 1);
  assert.equal(set.nextThreshold.pieces, 2);
});
