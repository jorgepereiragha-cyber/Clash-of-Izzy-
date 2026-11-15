import * as THREE from 'three';

const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();
const disposedTextures = new WeakSet();
const disposedBitmaps = new WeakSet();
let supportedAnisotropy = 1;
let textureGeneration = 0;

const DEFAULTS = Object.freeze({
  colorSpace: THREE.SRGBColorSpace,
  magFilter: THREE.LinearFilter,
  minFilter: THREE.LinearMipmapLinearFilter,
  generateMipmaps: true
});

function disposeTexture(texture) {
  if (!texture || disposedTextures.has(texture)) return;
  disposedTextures.add(texture);
  texture.dispose();
  const image = texture.source?.data || texture.image;
  if (image && typeof image.close === 'function' && !disposedBitmaps.has(image)) {
    disposedBitmaps.add(image);
    image.close();
  }
}

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

  const generation = textureGeneration;
  const entry = { url, texture: null, promise: null };
  entry.promise = textureLoader.loadAsync(url).then(texture => {
    // Do not resurrect GPU resources after a scene has been disposed.
    if (generation !== textureGeneration) {
      disposeTexture(texture);
      throw new Error('O carregamento da textura foi cancelado porque a cena foi encerrada.');
    }
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
  textureGeneration += 1;
  for (const entry of textureCache.values()) {
    if (entry.texture) disposeTexture(entry.texture);
    // Pending requests observe the generation change and dispose on arrival.
  }
  textureCache.clear();
}
