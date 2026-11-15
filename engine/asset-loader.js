import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const modelPromises = new Map();
const mixers = new Set();
let gltfLoader = null;
let dracoLoader = null;
let ktx2Loader = null;

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/';

export function initAssetLoader(renderer, options = {}) {
  if (!renderer) throw new TypeError('initAssetLoader requer o WebGLRenderer existente.');
  if (gltfLoader) return gltfLoader;

  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(options.dracoPath || `${THREE_CDN}draco/gltf/`);
  dracoLoader.setDecoderConfig({ type: 'js' });

  ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(options.basisPath || `${THREE_CDN}basis/`);
  ktx2Loader.detectSupport(renderer);

  gltfLoader = new GLTFLoader();
  gltfLoader.setCrossOrigin('anonymous');
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);
  return gltfLoader;
}

export function loadModel(name, url) {
  if (!gltfLoader) throw new Error('Inicialize o carregador após criar o renderer.');
  if (!name || !url) return Promise.reject(new TypeError('loadModel requer name e url.'));

  const cacheKey = String(url);
  if (modelPromises.has(cacheKey)) return modelPromises.get(cacheKey);

  const promise = gltfLoader.loadAsync(url).then(gltf => {
    gltf.scene.name ||= String(name);
    return gltf;
  }).catch(error => {
    modelPromises.delete(cacheKey);
    console.warn(`[COI assets] Falha ao carregar modelo "${name}" (${url}).`, error);
    throw error;
  });

  modelPromises.set(cacheKey, promise);
  return promise;
}

/** Loads and attaches an independent scene instance; geometry/materials remain shared. */
export async function addModel(scene, name, url, options = {}) {
  if (!scene?.isScene && !scene?.isObject3D) {
    throw new TypeError('addModel requer uma THREE.Scene ou Object3D.');
  }
  const gltf = await loadModel(name, url);
  const root = cloneSkinned(gltf.scene);
  root.name = options.instanceName || String(name);

  if (Array.isArray(options.position)) root.position.fromArray(options.position);
  if (Array.isArray(options.rotation)) root.rotation.set(...options.rotation);
  if (Array.isArray(options.scale)) root.scale.fromArray(options.scale);
  else if (Number.isFinite(options.scale)) root.scale.setScalar(options.scale);

  scene.add(root);

  let mixer = null;
  if (gltf.animations?.length) {
    mixer = new AnimationMixer(root);
    mixers.add(mixer);
    if (options.animation) {
      const clip = gltf.animations.find(item => item.name === options.animation) || gltf.animations[0];
      mixer.clipAction(clip).play();
    }
  }

  let disposed = false;
  return {
    root,
    gltf,
    mixer,
    play(animationName) {
      if (!mixer) return null;
      const clip = gltf.animations.find(item => item.name === animationName);
      if (!clip) return null;
      mixer.stopAllAction();
      const action = mixer.clipAction(clip);
      action.reset().play();
      return action;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (mixer) {
        mixer.stopAllAction();
        mixers.delete(mixer);
      }
      root.removeFromParent();
      // Do not dispose geometry/materials here: they are shared by cached GLTF instances.
    }
  };
}

export function updateAssetAnimations(deltaSeconds) {
  for (const mixer of mixers) mixer.update(deltaSeconds);
}

export function disposeAssetLoader() {
  for (const mixer of mixers) mixer.stopAllAction();
  mixers.clear();
  dracoLoader?.dispose();
  ktx2Loader?.dispose();
  modelPromises.clear();
  gltfLoader = dracoLoader = ktx2Loader = null;
}
