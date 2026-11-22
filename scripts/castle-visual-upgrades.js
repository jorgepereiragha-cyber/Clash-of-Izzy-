// Ornamentos de progressao do castelo: apenas meshes proprios, sem alterar
// materiais/texturas compartilhados ou as skins adquiridas do jogador.
import * as THREE from "three";

const OWNED_MARKER = "coiCastlePrestigeVisual";

export function clearCastleVisualUpgrades(castleMesh) {
  if (!castleMesh?.children) return;
  for (const decoration of [...castleMesh.children]) {
    if (decoration.userData?.[OWNED_MARKER] !== true) continue;
    castleMesh.remove(decoration);
    const geometries = new Set();
    const materials = new Set();
    decoration.traverse(node => {
      if (!node.isMesh) return;
      if (node.geometry) geometries.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        if (mat) materials.add(mat);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
}

export function applyCastleVisualUpgrades(castleMesh, castleLevel, { qualityTier = "balanced" } = {}) {
  clearCastleVisualUpgrades(castleMesh);
  if (!castleMesh?.isObject3D) return null;
  const numericLevel = Number(castleLevel);
  const level = Number.isFinite(numericLevel) ? Math.max(0, Math.floor(numericLevel)) : 0;
  if (level < 20) return null;

  const lowGraphics = qualityTier === "low";
  const decoration = new THREE.Group();
  decoration.name = "castle-prestige-ornaments";
  decoration.userData[OWNED_MARKER] = true;
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe3b953, emissive: 0x785111,
    emissiveIntensity: lowGraphics ? 0.08 : 0.26,
    metalness: 0.65, roughness: 0.3
  });
  const crimson = new THREE.MeshStandardMaterial({
    color: 0x742b30, metalness: 0.12, roughness: 0.72
  });

  // Trono decorativo no topo do castelo; nao e o Trono do mapa mundial.
  const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.33), gold);
  throneSeat.position.set(0, 2.91, 0.02);
  const throneBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.47, 0.1), crimson);
  throneBack.position.set(0, 3.14, -0.1);
  decoration.add(throneSeat, throneBack);

  if (level >= 25) {
    // As duas asas dividem uma geometria e um material, sem animacao ou texturas.
    const silhouette = new THREE.Shape();
    silhouette.moveTo(0, 0);
    silhouette.lineTo(0.34, 0.18);
    silhouette.lineTo(0.87, 0.77);
    silhouette.lineTo(0.58, 0.64);
    silhouette.lineTo(0.48, 0.94);
    silhouette.lineTo(0.21, 0.62);
    silhouette.lineTo(0, 0.5);
    silhouette.closePath();
    const wingGeometry = new THREE.ShapeGeometry(silhouette);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0xe7bb64, side: THREE.DoubleSide, metalness: 0.38,
      roughness: 0.55, emissive: 0x59350a,
      emissiveIntensity: lowGraphics ? 0 : 0.17
    });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.position.set(side * 0.77, 2.12, 0.16);
      wing.scale.x = side;
      decoration.add(wing);
    }
  }

  if (level >= 30) {
    // Realce dourado adicional: a skin equipada continua sendo a fonte da cor
    // base; nao clonar nem substituir materiais de GLB ou outros castelos.
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 5, 12), gold);
    crown.rotation.x = Math.PI / 2;
    crown.position.set(0, 3.37, 0);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), gold);
    gem.position.set(0, 3.47, 0);
    decoration.add(crown, gem);
  }

  castleMesh.add(decoration);
  return decoration;
}
