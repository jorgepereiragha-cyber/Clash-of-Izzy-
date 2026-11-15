// Resource cleanup shared by Three.js scenes and GLTF asset caches.
// It deliberately uses duck typing so the lifecycle can be tested without a WebGL context.
const disposed = new WeakSet();

export function createResourceRegistry() {
  return {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
    imageBitmaps: new Set(),
  };
}

function collectTexture(value, resources) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectTexture(item, resources);
    return;
  }
  if (!value.isTexture) return;
  resources.textures.add(value);
  const image = value.source?.data || value.image;
  if (typeof image?.close === "function") resources.imageBitmaps.add(image);
}

function collectMaterial(material, resources) {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  for (const item of list) {
    if (!item) continue;
    resources.materials.add(item);
    for (const value of Object.values(item)) collectTexture(value, resources);
    for (const uniform of Object.values(item.uniforms || {})) collectTexture(uniform?.value, resources);
  }
}

export function collectObject3DResources(root, resources = createResourceRegistry()) {
  if (!root?.traverse) return resources;
  root.traverse(node => {
    if (node.geometry) resources.geometries.add(node.geometry);
    collectMaterial(node.material, resources);
    collectTexture(node.skeleton?.boneTexture, resources);
  });
  return resources;
}

export function collectGLTFResources(gltf, resources = createResourceRegistry()) {
  const scenes = Array.isArray(gltf?.scenes) && gltf.scenes.length
    ? gltf.scenes
    : [gltf?.scene];
  for (const scene of scenes) collectObject3DResources(scene, resources);
  return resources;
}

function disposeOnce(resource, method) {
  if (!resource || (typeof resource !== "object" && typeof resource !== "function")) return;
  if (disposed.has(resource) || typeof resource[method] !== "function") return;
  disposed.add(resource);
  resource[method]();
}

export function disposeResourceRegistry(resources) {
  for (const geometry of resources.geometries) disposeOnce(geometry, "dispose");
  for (const texture of resources.textures) disposeOnce(texture, "dispose");
  for (const material of resources.materials) disposeOnce(material, "dispose");
  for (const bitmap of resources.imageBitmaps) disposeOnce(bitmap, "close");
}

export function disposeObject3DResources(root) {
  return disposeResourceRegistry(collectObject3DResources(root));
}

export function disposeGLTFResources(gltf) {
  return disposeResourceRegistry(collectGLTFResources(gltf));
}
