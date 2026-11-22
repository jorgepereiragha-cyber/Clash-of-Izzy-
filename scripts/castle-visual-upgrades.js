// Acessórios de castelo isolados: nunca alterar materiais/geometrias de GLB
// compartilhados ou criar objetos novos a cada frame da animação.
import * as THREE from "three";

const ownedRoots = new WeakMap();
const validLevel = value => Number.isFinite(Number(value)) ? Math.max(1, Math.min(80, Math.floor(Number(value)))) : 1;

export function disposeCastleVisualUpgrades(castle) {
  const extras = ownedRoots.get(castle);
  if (!extras) return;
  castle.remove(extras);
  const geometries = new Set(), materials = new Set();
  extras.traverse(object => {
    if (!object.isMesh) return;
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  extras.clear();
  ownedRoots.delete(castle);
}

export function applyCastleVisualUpgrades(castle, castleLevel, castleVipLevel = 0) {
  if (!castle?.isObject3D) return;
  disposeCastleVisualUpgrades(castle);
  const level = validLevel(castleLevel);
  const vip = validLevel(castleVipLevel);
  if (level < 20 && vip < 8) return;

  const bounds = new THREE.Box3().setFromObject(castle);
  const dimensions = bounds.getSize(new THREE.Vector3());
  const scale = Math.max(0.65, Math.min(1.8, Math.max(dimensions.x, dimensions.z) / 1.6 || 1));
  const top = Number.isFinite(bounds.max.y) ? bounds.max.y - castle.position.y : 2.5;
  const extras = new THREE.Group();
  extras.name = "coi-castle-visual-upgrades";
  extras.position.set(0, Math.max(1.5, top), 0.02);
  extras.scale.setScalar(scale);

  const gold = new THREE.MeshStandardMaterial({
    color: 0xf8ce63, emissive: 0x7a4c08, emissiveIntensity: 0.24,
    metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide
  });
  const royal = new THREE.MeshStandardMaterial({
    color: 0x741d26, metalness: 0.35, roughness: 0.65
  });
  const addMesh = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    extras.add(mesh);
    return mesh;
  };

  if (level >= 20) {
    // Trono cerimonial no castelo (não altera a mecânica da Guerra do Trono).
    addMesh(new THREE.BoxGeometry(0.43, 0.12, 0.33), gold, 0, 0.08, 0.1);
    addMesh(new THREE.BoxGeometry(0.36, 0.48, 0.09), royal, 0, 0.34, -0.01);
    addMesh(new THREE.BoxGeometry(0.45, 0.08, 0.12), gold, 0, 0.59, -0.01);
  }
  if (level >= 25) {
    // Duas silhuetas douradas de asa; duas draw calls em vez de partículas.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.25, 0.40);
    shape.lineTo(0.65, 0.78);
    shape.lineTo(0.48, 0.28);
    shape.lineTo(0.90, 0.44);
    shape.lineTo(0.54, -0.13);
    shape.lineTo(0.08, -0.22);
    shape.closePath();
    const wingGeometry = new THREE.ShapeGeometry(shape, 5);
    for (const side of [-1, 1]) {
      const wing = addMesh(wingGeometry, gold, side * 0.35, -0.32, 0.18);
      wing.scale.x = side;
    }
  }
  if (level >= 30 || vip >= 8) {
    // Coroa dourada independente da skin equipada e dos materiais GLB.
    const crown = addMesh(new THREE.TorusGeometry(0.64, 0.045, 5, 20), gold, 0, 0.06, 0);
    crown.rotation.x = Math.PI / 2;
  }
  castle.add(extras);
  ownedRoots.set(castle, extras);
}
