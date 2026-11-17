import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { disposeGLTFResources } from './resource-disposal.js';

const modelPromises = new Map();
const mixers = new Set();
const activeInstances = new Set();
let gltfLoader = null;
let dracoLoader = null;
let ktx2Loader = null;
let loaderGeneration = 0;
let disposed = true;

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/';

function validateModelUrl(url) {
  const parsed = new URL(String(url), window.location.href);
  if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith('/assets/models/') || !/\.glb$/i.test(parsed.pathname)) {
    throw new TypeError('Modelos devem ser arquivos GLB locais em /assets/models/.');
  }
  return parsed.href;
}

export function initAssetLoader(renderer, options = {}) {
  if (!renderer) throw new TypeError('initAssetLoader requer o WebGLRenderer existente.');
  if (gltfLoader && !disposed) return gltfLoader;

  loaderGeneration += 1;
  disposed = false;
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(options.dracoPath || `${THREE_CDN}draco/gltf/`);

  ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(options.basisPath || `${THREE_CDN}basis/`);
  ktx2Loader.detectSupport(renderer);

  gltfLoader = new GLTFLoader();
  gltfLoader.setCrossOrigin('anonymous');
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  return gltfLoader;
}

export function loadModel(name, url) {
  if (!gltfLoader || disposed) throw new Error('Inicialize o carregador após criar o renderer.');
  if (!name || !url) return Promise.reject(new TypeError('loadModel requer name e url.'));

  const safeUrl = validateModelUrl(url);
  const cacheKey = safeUrl;
  if (modelPromises.has(cacheKey)) return modelPromises.get(cacheKey);

  const loader = gltfLoader;
  const generation = loaderGeneration;
  let promise;
  promise = loader.loadAsync(safeUrl).then(gltf => {
    // A resposta pode chegar depois de uma troca de cena/contexto. Nunca manter
    // recursos GPU pertencentes a uma geração de loader já encerrada.
    if (disposed || generation !== loaderGeneration) {
      disposeGLTFResources(gltf);
      throw new Error('O carregamento do modelo foi cancelado porque a cena foi encerrada.');
    }
    if (gltf.scene) gltf.scene.name ||= String(name);
    return gltf;
  }).catch(error => {
    if (modelPromises.get(cacheKey) === promise) modelPromises.delete(cacheKey);
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
  const generation = loaderGeneration;
  const gltf = await loadModel(name, url);
  if (disposed || generation !== loaderGeneration) {
    throw new Error('A cena foi encerrada antes de o modelo ser anexado.');
  }
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

  let instanceDisposed = false;
  const instance = {
    root,
    gltf,
    mixer,
    play(animationName) {
      if (instanceDisposed || !mixer) return null;
      const clip = gltf.animations.find(item => item.name === animationName);
      if (!clip) return null;
      mixer.stopAllAction();
      const action = mixer.clipAction(clip);
      action.reset().play();
      return action;
    },
    dispose() {
      if (instanceDisposed) return;
      instanceDisposed = true;
      if (mixer) {
        mixer.stopAllAction();
        mixers.delete(mixer);
      }
      root.removeFromParent();
      activeInstances.delete(instance);
      // Geometry/material/texture are shared with the cached GLTF template.
      // The global loader disposal owns their final release.
    }
  };
  activeInstances.add(instance);
  return instance;
}

export function updateAssetAnimations(deltaSeconds) {
  for (const mixer of mixers) mixer.update(deltaSeconds);
}

export function disposeAssetLoader() {
  if (disposed && !gltfLoader && !dracoLoader && !ktx2Loader && !modelPromises.size && !activeInstances.size) return;
  disposed = true;
  loaderGeneration += 1;

  for (const instance of [...activeInstances]) instance.dispose();
  for (const mixer of mixers) mixer.stopAllAction();
  mixers.clear();

  // Cached models and in-flight loads share this cleanup path. A pending load
  // also checks loaderGeneration before it can return a usable GLTF object.
  for (const promise of modelPromises.values()) {
    promise.then(disposeGLTFResources).catch(() => {});
  }
  modelPromises.clear();

  dracoLoader?.dispose();
  ktx2Loader?.dispose();
  gltfLoader = dracoLoader = ktx2Loader = null;
}
