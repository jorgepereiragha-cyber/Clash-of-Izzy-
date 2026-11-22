import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { applyCastleVisualUpgrades, clearCastleVisualUpgrades } from "../scripts/castle-visual-upgrades.js";

function makeCastle() {
  const castle = new THREE.Group();
  const originalMaterial = new THREE.MeshStandardMaterial({ color: 0x123456 });
  const originalGeometry = new THREE.BoxGeometry(1, 1, 1);
  const original = new THREE.Mesh(originalGeometry, originalMaterial);
  castle.add(original);
  return { castle, original, originalMaterial, originalGeometry };
}

function ownedDecorations(castle) {
  return castle.children.filter(child => child.userData.coiCastlePrestigeVisual === true);
}

test("ornamentos sao puramente visuais e nao alteram skins ou materiais do castelo", () => {
  const { castle, original, originalMaterial, originalGeometry } = makeCastle();
  assert.equal(applyCastleVisualUpgrades(castle, 19), null);
  assert.equal(ownedDecorations(castle).length, 0);

  const decoration = applyCastleVisualUpgrades(castle, 30, { qualityTier: "low" });
  assert.equal(ownedDecorations(castle).length, 1);
  assert.equal(decoration.children.filter(child => child.isMesh).length, 6);
  assert.equal(original.material, originalMaterial);
  assert.equal(original.material.color.getHex(), 0x123456);
  assert.equal(original.geometry, originalGeometry);

  const wings = decoration.children.filter(child => child.scale.x < 0 || child.position.x > 0.7);
  assert.equal(wings.length, 2);
  assert.equal(wings[0].geometry, wings[1].geometry);
  assert.equal(wings[0].material, wings[1].material);
});

test("limpeza libera apenas geometrias e materiais criados pelos ornamentos", () => {
  const { castle, original, originalMaterial, originalGeometry } = makeCastle();
  let baseDisposals = 0;
  originalMaterial.addEventListener("dispose", () => { baseDisposals++; });
  originalGeometry.addEventListener("dispose", () => { baseDisposals++; });

  const first = applyCastleVisualUpgrades(castle, 30);
  const geometries = new Set();
  const materials = new Set();
  first.traverse(node => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    materials.add(node.material);
  });
  let disposed = 0;
  for (const resource of [...geometries, ...materials]) {
    resource.addEventListener("dispose", () => { disposed++; });
  }

  applyCastleVisualUpgrades(castle, 25);
  assert.equal(disposed, geometries.size + materials.size);
  assert.equal(ownedDecorations(castle).length, 1);
  clearCastleVisualUpgrades(castle);
  assert.equal(ownedDecorations(castle).length, 0);
  assert.equal(castle.children[0], original);
  assert.equal(baseDisposals, 0);
});

test("niveis invalidos e castelos sem cena nao derrubam o motor", () => {
  assert.equal(applyCastleVisualUpgrades(null, 30), null);
  const { castle } = makeCastle();
  for (const level of [NaN, -1, "invalido", Infinity]) {
    assert.equal(applyCastleVisualUpgrades(castle, level), null);
  }
  assert.equal(ownedDecorations(castle).length, 0);
});
