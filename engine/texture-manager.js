import * as THREE from 'three';

const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();
let supportedAnisotropy = 1;

const DEFAULTS = Object.freeze({
  colorSpace: THREE.SRGBColorSpace,
  magFilter: THREE.LinearFilter,
  minFilter: THREE.LinearMipmapLinearFilter,
  generateMipmaps: true
});

export function initTextureManager(renderer) {
  supportedAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
}

/**
 * Loads a shared texture. Concurrent requests for the same name/URL share
 * one promise, preventing duplicate downloads and GPU texture allocations.
 */
export async function loadTexture(name, url, options = {}) {
  if (!name || !url) throw new TypeError('loadTexture requer name e url.');

  const cacheKey = String(name);
  const existing = textureCache.get(cacheKey);
  if (existing) {
    if (existing.url !== url) {
      throw new Error(`A textura "${cacheKey}" já está associada a outra URL.`);
    }
    return existing.promise;
  }

  const entry = { url, texture: null, promise: null };
  entry.promise = textureLoader.loadAsync(url).then(texture => {
    texture.colorSpace = options.colorSpace || DEFAULTS.colorSpace;
    texture.magFilter = options.magFilter || DEFAULTS.magFilter;
    texture.minFilter = options.minFilter || DEFAULTS.minFilter;
    texture.generateMipmaps = options.generateMipmaps ?? DEFAULTS.generateMipmaps;
    texture.anisotropy = Math.min(options.anisotropy ?? 4, supportedAnisotropy);
    texture.needsUpdate = true;
    entry.texture = texture;
    return texture;
  }).catch(error => {
    if (textureCache.get(cacheKey) === entry) textureCache.delete(cacheKey);
    console.warn(`[COI texture] Não foi possível carregar "${cacheKey}" (${url}).`, error);
    throw error;
  });

  textureCache.set(cacheKey, entry);
  return entry.promise;
}

export async function preloadTextures(items = []) {
  const results = await Promise.allSettled(
    items.map(item => loadTexture(item.name, item.url, item.options))
  );
  return {
    results,
    failed: results.filter(result => result.status === 'rejected').length
  };
}

export function getTexture(name) {
  return textureCache.get(String(name))?.texture || null;
}

export function disposeTextures() {
  for (const entry of textureCache.values()) entry.texture?.dispose();
  textureCache.clear();
}
