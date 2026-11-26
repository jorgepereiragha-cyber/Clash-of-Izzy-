/* Progressive Three.js kingdom renderer. Canvas art remains as offline/WebGL fallback. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { selectKingdomQualityProfile, calculateKingdomPixelRatio, createFrameTimingSampler, createAdaptivePixelScaleController } from "./kingdom-quality.js";
import { readGraphicsChoice, getGraphicsStorage } from "./kingdom-visual-preferences.js";
import { planArmyFigures, createProceduralUnit, troopAnimationPhase } from "./kingdom-army-visual.js";
import { readCityFootprint, cityModelAnchor, cityModelFit, CITY_TILE_WORLD, planCityStreetCells } from "./city-art-layout.js";
import { projectDragonVisual, makeDragonFigure, makeImportedDragonFigure, disposeImportedDragonFigure, poseDragon } from "./kingdom-dragon-visual.js";
import { derivePbrTextureData, forEachPeriodicSurfaceCell, cityContactShadowSize, CITY_DAYLIGHT } from "./kingdom-materials.js";
import { AdvancedShaders } from "./advanced-shaders.js";
import { applyCastleVisualUpgrades, disposeCastleVisualUpgrades } from "./castle-visual-upgrades.js";
import { planSpecialCityLandmarks } from "./kingdom-special-landmarks.js";
import { approvedManifestEntry } from "./art-license-policy.js";
import { CITY_SCANNED_MATERIALS, scannedMaterialResolution, neutralizeScanColor } from "./city-scanned-materials.js";

const host = document.getElementById("city");
if (host && "WebGLRenderingContext" in window) {
  let renderer, scene, camera, resizeObserver, sceneVisibilityObserver, visibilityChangeHandler, ktx2, draco, gltfLoader, resizeHandler, qualityProfile;
  let latestBuildings = [];
  let latestTroops = [];
  let latestCastleSkinId = 0;
  let latestCastleVipLevel = 0;
  let activeModels = [];
  let cityStreetMeshes = [], legacyRoadMeshes = [], cityStreetSignature = null;
  let activeDefenseModels = [];
  let defensePreviewMesh = null;
  let defensePreviewHandler = null;
  let latestDefenses = [];
  let latestHeroAssignments = [];
  let activeHeroFigures = [];
  let activeProps = [];
  let activeTroops = [];
  let activeDragon = null;
  let dragonTime = 0;
  let armyMixers = [];
  let animationFrame = 0;
  let lastAnimationTime = 0;
  let sceneInViewport = true;
  const animationFrameTiming = createFrameTimingSampler(120);
  const adaptivePixelScale = createAdaptivePixelScaleController();
  let automaticGraphics = false;
  const glbTemplates = new Map();
  const glbPropTemplates = new Map();
  const glbUnitTemplates = new Map();
  const glbLoadPromises = new Map();
  const glbLoadLanes = Array.from({ length: 3 }, () => Promise.resolve());
  let nextGlbLane = 0;
  let manifestAssets = [];
  let manifestProps = [];
  let manifestUnits = [];
  let manifestLoad = null;
  let optionalSceneRefreshes = 0;
  const material = (color, roughness = 0.92) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
  const mats = {
    grass: material("#577a49"), grassLight: material("#78945a"),
    road: material("#b8a57d"), roadEdge: material("#76664c"),
    stone: material("#9c9b8b"), darkStone: material("#555d5c"),
    wood: material("#745039"), roof: material("#24476B"),
    gold: material("#d5b16b", 0.55), window: new THREE.MeshStandardMaterial({ color: "#ffe0a0", emissive: "#c88b35", emissiveIntensity: 0.28, roughness: 0.48 }),
    leaf: material("#3d7043"), leafLight: material("#628a4d")
  };
  const palettes = {
    castle: ["#a69a80", "#24476B"], barracks: ["#92704f", "#31577D"],
    farm: ["#9b9a62", "#456B4E"], quarry: ["#929a9a", "#52677D"],
    lumber_mill: ["#795a3e", "#24476B"], iron_mine: ["#75818a", "#34475B"],
    market: ["#a78b61", "#31577D"], academy: ["#8c8ba2", "#24476B"],
    wall: ["#a1a69c", "#52677D"], hospital: ["#c9c2aa", "#31577D"],
    watchtower: ["#9c927b", "#24476B"], stable: ["#98734e", "#31577D"],
    archery_range: ["#a49a6c", "#456B4E"], siege_workshop: ["#827466", "#52677D"],
    embassy: ["#b0a18a", "#31577D"], warehouse: ["#9b886a", "#24476B"]
  };
  const castleSkinPalettes = {
    1:{wall:"#c7a86f",roof:"#9b6627",stone:"#ead5a3",accent:"#f1d078",banner:"#8d401f",seal:"#f6dc92"},
    2:{wall:"#d2d0c5",roof:"#264d77",stone:"#f1ead4",accent:"#e4bd68",banner:"#17385f",seal:"#dcecf5"},
    3:{wall:"#887767",roof:"#5a3828",stone:"#b69b75",accent:"#c6a15d",banner:"#5a2724",seal:"#d8b776"},
    4:{wall:"#aaa2c8",roof:"#5a4b8c",stone:"#d8cbed",accent:"#e2caef",banner:"#342d6f",seal:"#e8d7f4"},
    5:{wall:"#9fb8ca",roof:"#3e6b91",stone:"#d9e8ee",accent:"#c2e1ec",banner:"#264869",seal:"#edf8ff"},
    6:{wall:"#d29b65",roof:"#9e3d27",stone:"#f2c68a",accent:"#f5cf63",banner:"#7c241f",seal:"#ffe3a1"}
  };
  const sharedMaterials = new Set(Object.values(mats));
  const surfaceTextureCache = new Map();
  const surfaceMaterialCache = new Map();
  const scannedSurfaceMaps = new Map();
  let scannedMaterialsPending=false;
  let disposed = false;
  let kingdomRenderHandler = null;
  let kingdomZoomHandler = null;
  let cameraZoomFactor = 1;
  let cameraFocusCenter = true;
  let valhallaModeHandler = null;
  let developmentStatsBadge = null;
  let developmentStatsTimer = null;
  let cinematicCaptureActive = false;
  let cinematicApi = null;
  let valhallaModeActive = window.__COI_VALHALLA_ACTIVE === true;
  let valhallaAuroraLight = null;
  let kingdomHemisphereLight = null;
  let kingdomSunLight = null;
  let advancedShaders = null;
  let waterFeature = null;
  let contactShadowBatch = null;

  function setKingdomValhallaMode(active) {
    valhallaModeActive = Boolean(active);
    if (!scene) return;
    scene.background = valhallaModeActive ? new THREE.Color(0x0a0510) : null;
    scene.fog = valhallaModeActive ? new THREE.FogExp2(0x1a0f25, 0.035) : null;
    if (kingdomHemisphereLight) kingdomHemisphereLight.intensity = valhallaModeActive ? 0.95 : CITY_DAYLIGHT.hemisphere;
    if (kingdomSunLight) kingdomSunLight.intensity = valhallaModeActive ? 1.15 : CITY_DAYLIGHT.sun;
    if (valhallaAuroraLight) {
      scene.remove(valhallaAuroraLight);
      valhallaAuroraLight = null;
    }
    if (valhallaModeActive) {
      valhallaAuroraLight = new THREE.DirectionalLight(0x9b59b6, 0.7);
      valhallaAuroraLight.position.set(5, 14, -8);
      scene.add(valhallaAuroraLight);
    }
  }
  valhallaModeHandler = event => setKingdomValhallaMode(event.detail?.active === true);
  window.addEventListener("coi:valhalla-mode", valhallaModeHandler);

  // Métricas apenas no ambiente de desenvolvimento, sem render loop extra.
  function stopDevelopmentStats() {
    if (developmentStatsTimer !== null) clearInterval(developmentStatsTimer);
    developmentStatsTimer = null;
    developmentStatsBadge?.remove();
    developmentStatsBadge = null;
  }
  function startDevelopmentStats() {
    if (window.ENVIRONMENT !== "development" || developmentStatsBadge || !renderer) return;
    const output = document.createElement("output");
    output.setAttribute("aria-label", "Métricas do renderizador 3D");
    output.style.cssText = "position:absolute;left:6px;top:6px;z-index:4;" +
      "pointer-events:none;padding:4px 7px;border-radius:5px;" +
      "background:rgba(5,12,20,.8);color:#e9f1f5;font:11px monospace";
    output.textContent = "FPS — · draw calls —";
    host.appendChild(output);
    developmentStatsBadge = output;
    developmentStatsTimer = window.setInterval(() => {
      if (!renderer || disposed || document.hidden) return;
      const timing = animationFrameTiming.snapshot();
      // Cenas estáticas não produzem um FPS mensurável.
      const fps = animationFrame && timing.sampleCount >= 5 && timing.p50Ms > 0
        ? Math.round(1000 / timing.p50Ms) : null;
      output.textContent = (fps ?? "—") + " FPS · " +
        renderer.info.render.calls + " draw calls · " +
        renderer.info.memory.geometries + " geometrias";
    }, 1000);
  }

  // Explicitly release GPU-backed resources on WebGL context loss. Three.js
  // resources are not reclaimed by the browser's garbage collector.
  function disposeObject3D(root, resources) {
    if (!root) return;
    root.traverse(node => {
      if (node.isInstancedMesh) resources.instances.add(node);
      if (node.geometry) resources.geometries.add(node.geometry);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of materials) {
        if (!mat) continue;
        resources.materials.add(mat);
        for (const value of Object.values(mat)) {
          if (!value?.isTexture) continue;
          resources.textures.add(value);
          const bitmap = value.source?.data || value.image;
          if (typeof bitmap?.close === "function") resources.imageBitmaps.add(bitmap);
        }
      }
    });
  }
  function disposeResourceSet(resources) {
    // InstancedMesh owns GPU instance buffers independently of geometry/material.
    for (const instance of resources.instances) instance.dispose();
    for (const geometry of resources.geometries) geometry.dispose();
    for (const texture of resources.textures) texture.dispose();
    for (const mat of resources.materials) mat.dispose();
    for (const bitmap of resources.imageBitmaps) bitmap.close();
  }
  function disposeDetachedObject3D(root) {
    const resources = { geometries: new Set(), materials: new Set(), textures: new Set(), imageBitmaps: new Set(), instances: new Set() };
    disposeObject3D(root, resources);
    disposeResourceSet(resources);
  }
  function disposeSceneResources() {
    if (activeDragon?.figure.imported) {
      scene?.remove(activeDragon.figure.root);
      disposeImportedDragonFigure(activeDragon.figure);
    }
    const resources = { geometries: new Set(), materials: new Set(), textures: new Set(), imageBitmaps: new Set(), instances: new Set() };
    disposeObject3D(scene, resources);
    for (const template of glbTemplates.values()) disposeObject3D(template, resources);
    for (const template of glbPropTemplates.values()) disposeObject3D(template, resources);
    for (const entry of glbUnitTemplates.values()) disposeObject3D(entry.template, resources);
    for (const textureSet of surfaceTextureCache.values()) {
      for (const texture of Object.values(textureSet)) if (texture?.isTexture) resources.textures.add(texture);
    }
    for (const mat of Object.values(mats)) {
      if (!mat) continue;
      resources.materials.add(mat);
      if (mat.map) resources.textures.add(mat.map);
    }
    for(const mat of surfaceMaterialCache.values())resources.materials.add(mat);
    for(const maps of scannedSurfaceMaps.values())for(const texture of Object.values(maps))resources.textures.add(texture);
    disposeResourceSet(resources);
    scene?.clear();
    surfaceTextureCache.clear();
    surfaceMaterialCache.clear();
    scannedSurfaceMaps.clear();
    glbTemplates.clear();
    glbPropTemplates.clear();
    glbUnitTemplates.clear();
    activeModels = [];
    activeDefenseModels = [];
    activeHeroFigures = [];
    latestHeroAssignments = [];
    defensePreviewMesh = null;
    activeProps = [];
    activeTroops = [];
    activeDragon = null;
    dragonTime = 0;
    armyMixers = [];
    manifestAssets = [];
    manifestProps = [];
    manifestUnits = [];
    stopArmyAnimationLoop();
    advancedShaders?.dispose();
    advancedShaders = null;
    waterFeature = null;
    contactShadowBatch = null;
    cityStreetMeshes=[];legacyRoadMeshes=[];cityStreetSignature=null;
  }
  // Small, deterministic, tileable procedural albedo maps add material identity
  // without shipping large image files or creating per-building texture copies.
  function makeSurfaceTexture(base, kind, seed) {
    const canvas = document.createElement("canvas");
    const textureSize = qualityProfile?.surfaceTextureSize || 128;
    const detailScale = textureSize / 128;
    canvas.width = canvas.height = textureSize;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(detailScale, 0, 0, detailScale, 0, 0);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    let value = seed >>> 0;
    const rand = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
    if (kind === "wood") {
      for (let i = 0; i < 34; i++) {
        const y = rand() * 128;
        ctx.strokeStyle = rand() > .5 ? "rgba(35,20,12,.20)" : "rgba(238,190,125,.13)";
        ctx.lineWidth = 1 + rand() * 3;
        ctx.beginPath(); ctx.moveTo(0, y);
        ctx.bezierCurveTo(36, y - 5 + rand() * 10, 86, y - 5 + rand() * 10, 128, y);
        ctx.stroke();
      }
    } else if (kind === "stone") {
      forEachPeriodicSurfaceCell(kind, ({ positions, y, width, height }) => {
        const face = rand() > .5 ? "rgba(242,226,194,.13)" : "rgba(34,38,34,.12)";
        for (const x of positions) {
          ctx.fillStyle = face;
          ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
          ctx.fillStyle = "rgba(255,244,215,.20)";
          ctx.fillRect(x + 2, y + 2, width - 4, 1);
          ctx.strokeStyle = "rgba(35,39,37,.30)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
        }
      });
    } else if (kind === "roof") {
      forEachPeriodicSurfaceCell(kind, ({ positions, y, width, height }) => {
        const face = rand() > .5 ? "rgba(210,225,245,.20)" : "rgba(8,18,34,.22)";
        for (const x of positions) {
          ctx.fillStyle = "rgba(8,18,34,.24)";
          ctx.fillRect(x, y + 1, width, height - 1);
          ctx.fillStyle = face;
          ctx.fillRect(x + 1, y + 1, width - 2, height - 3);
          ctx.fillStyle = "rgba(210,225,245,.16)";
          ctx.fillRect(x + 2, y + 1, width - 4, 1);
        }
      });
    } else if (kind === "grass") {
      // Seamless deterministic turf variation within the existing texture budget.
      for (let i = 0; i < 24; i++) {
        const x = rand() * 128, y = rand() * 128, radius = 9 + rand() * 19;
        for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
          const gradient = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
          gradient.addColorStop(0, i % 2 ? "rgba(184,164,92,.16)" : "rgba(30,52,27,.20)");
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gradient;
          ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
        }
      }
      for (let i = 0; i < 700; i++) {
        ctx.strokeStyle = rand() > .5 ? "rgba(25,65,28,.20)" : "rgba(210,220,135,.16)";
        ctx.lineWidth = 1;
        const x = rand() * 128, y = rand() * 128;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand() * 3, y - 2 - rand() * 5); ctx.stroke();
      }
    } else if (kind === "road") {
      // Individual paving stones with alternating joints and weathered faces.
      forEachPeriodicSurfaceCell(kind, ({ positions, y, width, height }) => {
        const face = rand() > .5 ? "rgba(238,222,184,.28)" : "rgba(103,91,68,.16)";
        for (const x of positions) {
          ctx.fillStyle = "rgba(48,40,29,.22)";
          ctx.fillRect(x, y, width, height);
          ctx.fillStyle = face;
          ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
          ctx.fillStyle = "rgba(255,245,214,.16)";
          ctx.fillRect(x + 2, y + 2, width - 4, 1);
        }
      });
      for (let i = 0; i < 90; i++) {
        const x = rand() * 128, y = rand() * 128;
        ctx.fillStyle = rand() > .5 ? "rgba(45,39,29,.15)" : "rgba(255,245,215,.18)";
        ctx.fillRect(x, y, 2 + rand() * 8, 2 + rand() * 5);
      }
    }
    const grainCount = Math.round(1200 * detailScale * detailScale);
    // O grão é desenhado em pixels físicos para continuar fino em 256/512 px.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < grainCount; i++) {
      const alpha = .025 + rand() * .07;
      ctx.fillStyle = rand() > .5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(rand() * textureSize, rand() * textureSize, 1 + rand() * 2, 1 + rand() * 2);
    }
    const repeat = kind === "grass" ? 27 : 3;
    const repeatY = kind === "grass" ? 21 : 3;
    const anisotropy = Math.min(qualityProfile?.anisotropy || 2, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    const configureTexture = (texture, colorSpace = THREE.NoColorSpace) => {
      texture.colorSpace = colorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat, repeatY);
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
      return texture;
    };
    const textureSet = {
      map: configureTexture(new THREE.CanvasTexture(canvas), THREE.SRGBColorSpace),
      normalMap: null,
      roughnessMap: null
    };

    // Aparelhos de entrada mantem apenas o albedo e a rugosidade escalar.
    // Balanced/High recebem mapas PBR lineares para relevo e resposta de luz.
    if (qualityProfile?.pbrMaps) {
      const pixels = ctx.getImageData(0, 0, textureSize, textureSize).data;
      const luminance = new Uint8Array(textureSize * textureSize);
      const srgbToLinear = channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      for (let i = 0; i < luminance.length; i++) {
        const offset = i * 4;
        const red = srgbToLinear(pixels[offset]);
        const green = srgbToLinear(pixels[offset + 1]);
        const blue = srgbToLinear(pixels[offset + 2]);
        luminance[i] = Math.round((red * 0.2126 + green * 0.7152 + blue * 0.0722) * 255);
      }
      const derived = derivePbrTextureData({ luminance, width: textureSize, height: textureSize, kind });
      const createLinearMap = data => {
        const detailCanvas = document.createElement("canvas");
        detailCanvas.width = detailCanvas.height = textureSize;
        const detailContext = detailCanvas.getContext("2d");
        const imageData = detailContext.createImageData(textureSize, textureSize);
        imageData.data.set(data);
        detailContext.putImageData(imageData, 0, 0);
        return configureTexture(new THREE.CanvasTexture(detailCanvas));
      };
      textureSet.normalMap = createLinearMap(derived.normalData);
      textureSet.roughnessMap = createLinearMap(derived.roughnessData);
    }
    return textureSet;
  }
  function getSurfaceMaps(base, kind, seed) {
    const key = `${base}:${kind}:${seed}`;
    if (!surfaceTextureCache.has(key)) surfaceTextureCache.set(key, makeSurfaceTexture(base, kind, seed));
    return surfaceTextureCache.get(key);
  }
  function surfaceMaterial(base, kind, seed) {
    const key=`${base}:${kind}:${seed}`;
    if(surfaceMaterialCache.has(key))return surfaceMaterialCache.get(key);
    const maps = getSurfaceMaps(base, kind, seed);
    const mat=new THREE.MeshStandardMaterial({
      color: "#ffffff",
      ...maps,
      roughness: kind === "roof" ? .86 : .96,
      metalness: 0.01
    });
    // Evita recompilar materiais iguais após cada atualização de estado.
    applyScannedSurface(mat,kind,base);
    surfaceMaterialCache.set(key,mat);
    sharedMaterials.add(mat);
    return mat;
  }
  function applyScannedSurface(mat,kind,base,disposePrevious=false){
    const maps=scannedSurfaceMaps.get(kind);if(!maps)return;
    if(disposePrevious)for(const name of ["map","normalMap","roughnessMap"])if(mat[name]&&!Object.values(maps).includes(mat[name]))mat[name].dispose();
    mat.map=maps.map;mat.normalMap=maps.normalMap;mat.roughnessMap=null;
    mat.color.set(base);mat.roughness=.9;mat.normalScale.set(.72,.72);mat.needsUpdate=true;
  }
  async function loadScannedCityMaterials(){
    const resolution=scannedMaterialResolution(qualityProfile);
    if(!resolution)return;
    scannedMaterialsPending=true;
    const loader=new THREE.ImageLoader();
    await Promise.allSettled(Object.entries(CITY_SCANNED_MATERIALS).map(async ([kind,paths])=>{
      const [color,normal]=await Promise.all([loader.loadAsync(paths.color),loader.loadAsync(paths.normal)]);
      if(disposed||!renderer||!scene)return;
      const createMap=(image,isColor)=>{
        const canvas=document.createElement("canvas");canvas.width=resolution;
        canvas.height=Math.max(1,Math.round(resolution*image.height/image.width));
        const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas indisponível");
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        if(isColor){const data=ctx.getImageData(0,0,canvas.width,canvas.height);neutralizeScanColor(data.data);ctx.putImageData(data,0,0);}
        const map=new THREE.CanvasTexture(canvas);
        map.colorSpace=isColor?THREE.SRGBColorSpace:THREE.NoColorSpace;
        map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(1.5,1.5);
        map.anisotropy=Math.min(qualityProfile.anisotropy,renderer.capabilities.getMaxAnisotropy());
        return map;
      };
      let map,normalMap;
      try{map=createMap(color,true);normalMap=createMap(normal,false);}
      catch(error){map?.dispose();normalMap?.dispose();throw error;}
      scannedSurfaceMaps.set(kind,{map,normalMap});
      if(kind==="stone"){
        applyScannedSurface(mats.stone,kind,"#9c9b8b",true);
        applyScannedSurface(mats.darkStone,kind,"#555d5c",true);
      }else if(kind==="wood")applyScannedSurface(mats.wood,kind,"#a78a6b",true);
      for(const [key,mat] of surfaceMaterialCache){const [base,materialKind]=key.split(":");if(materialKind===kind)applyScannedSurface(mat,kind,base);}
    }));
    scannedMaterialsPending=false;
    if(!disposed&&renderer&&scene&&camera)renderer.render(scene,camera);
  }
  function applyProceduralSurfaceMaps() {
    const maps = [
      [mats.grass, "#577a49", "grass", 11],
      [mats.road, "#b8a57d", "road", 17],
      [mats.roadEdge, "#76664c", "stone", 23],
      [mats.stone, "#9c9b8b", "stone", 31],
      [mats.darkStone, "#555d5c", "stone", 37],
      [mats.wood, "#745039", "wood", 41],
      [mats.roof, "#24476B", "roof", 47]
    ];
    for (const [mat, base, kind, seed] of maps) {
      const textureSet = makeSurfaceTexture(base, kind, seed);
      mat.map = textureSet.map;
      mat.normalMap = textureSet.normalMap;
      mat.roughnessMap = textureSet.roughnessMap;
      mat.color.set("#ffffff");
      mat.needsUpdate = true;
    }
  }
  function box(parent, w, h, d, mat, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function addForestInstances() {
    const low=qualityProfile?.tier==="low";
    const count = 18;
    const trunkGeometry = new THREE.CylinderGeometry(.075, .14, .88, low?5:8);
    // Broadleaf crowns replace the toy-like cone silhouette on every profile.
    // Two shared foliage geometries and three draw calls, independent of tree count.
    const crownGeometry = new THREE.IcosahedronGeometry(.69, low?0:1);
    const crownTopGeometry = new THREE.IcosahedronGeometry(.48, low?0:1);
    const trunks = new THREE.InstancedMesh(trunkGeometry, mats.wood, count);
    const crowns = new THREE.InstancedMesh(crownGeometry, mats.leaf, count);
    const crownTops = new THREE.InstancedMesh(crownTopGeometry, mats.leafLight, count);
    trunks.castShadow = crowns.castShadow = crownTops.castShadow = true;
    trunks.receiveShadow = true;
    const dummy = new THREE.Object3D(), tint=new THREE.Color();
    let added = 0;
    for (let i = 0; i < count; i++) {
      const x = ((i * 37) % 125) / 10 - 6.2;
      const z = ((i * 23) % 95) / 10 - 4.7;
      if (Math.abs(x) < 5 && Math.abs(z) < 4) continue;
      const scale = .72 + (i % 4) * .12;
      const angle=i*2.399963;
      dummy.rotation.set(0,angle,0);
      dummy.position.set(x, .44 * scale, z);
      dummy.scale.setScalar(scale); dummy.updateMatrix(); trunks.setMatrixAt(added, dummy.matrix);
      dummy.position.set(x, 1.22 * scale, z);
      dummy.scale.set(scale*(.94+(i%3)*.1),scale*1.12,scale*.89);
      dummy.updateMatrix(); crowns.setMatrixAt(added, dummy.matrix);
      tint.setScalar(.77+(i%5)*.055);crowns.setColorAt(added,tint);
      dummy.position.set(x+Math.cos(angle)*.22*scale, 1.64 * scale, z+Math.sin(angle)*.22*scale);
      dummy.scale.set(scale*.90,scale*1.14,scale*.87);
      dummy.updateMatrix(); crownTops.setMatrixAt(added, dummy.matrix);
      tint.setScalar(.72+(i%4)*.075);crownTops.setColorAt(added,tint);
      added++;
    }
    for (const mesh of [trunks, crowns, crownTops]) {
      mesh.count = added;
      mesh.instanceMatrix.needsUpdate = true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }
  function addCylinder(parent, radiusTop, radiusBottom, height, mat, x, y, z, segments = 8) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function addBuildingWheel(parent, x, y, z, radius = .25) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(radius, .055, 6, 12), mats.wood);
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    wheel.rotation.y = Math.PI / 2;
    parent.add(wheel);
    addCylinder(parent, .055, .055, .18, mats.darkStone, x, y, z, 8).rotation.z = Math.PI / 2;
  }
  // Original Eldoria architecture. All dimensions remain inside the existing
  // visual footprint. These are owned procedural meshes, not shared GLB clones.
  const buildingProfiles = Object.freeze({
    barracks:[1.42,1.05,.99,.48],farm:[1.4,.78,1.0,.54],
    quarry:[1.18,.67,1.0,.25],lumber_mill:[1.46,.83,1.0,.48],
    iron_mine:[1.24,.74,1.02,.31],market:[1.44,.82,1.08,.35],
    academy:[1.38,1.24,1.02,.57],wall:[1.52,.68,.55,.05],
    hospital:[1.40,.93,1.04,.48],watchtower:[.72,1.67,.72,.48],
    stable:[1.48,.75,1.0,.47],archery_range:[1.32,.76,1.0,.42],
    siege_workshop:[1.48,.96,1.12,.55],embassy:[1.40,1.16,1.03,.54],
    warehouse:[1.46,.9,1.1,.52]
  });
  function addEldoriaCastle(group,level,skin,wall,roof,stone,accent){
    const tier=level>=30?4:level>=20?3:level>=10?2:1;
    const high=qualityProfile?.tier==="high",low=qualityProfile?.tier==="low";
    const keepHeight=1.66+(tier-1)*.23;
    const towerHeight=1.37+(tier-1)*.17;
    group.userData.coIArchitecture="eldoria-imperial-v1";
    group.userData.coIArchitectureTier=tier;
    box(group,1.75,.15,1.52,mats.darkStone,0,.075,0);
    box(group,1.60,.12,1.38,stone,0,.19,0);
    // The central inhabited keep remains visible even in balanced mode.
    box(group,.94,keepHeight, .85,wall,0,.25+keepHeight/2,-.12);
    box(group,1.04,.14,.95,stone,0,.25+keepHeight,-.12);
    const mainRoof=new THREE.Mesh(new THREE.ConeGeometry(.73,.68+(tier-1)*.07,4),roof);
    mainRoof.rotation.y=Math.PI/4;mainRoof.position.set(0,.32+keepHeight+(.68+(tier-1)*.07)/2,-.12);group.add(mainRoof);
    // Layered royal citadel silhouette: raised stone courses, a tall central
    // lantern and arched windows on both camera-facing sides. Remains in plot.
    const archShape=(w,h)=>{
      const sh=new THREE.Shape(),radius=w/2;
      sh.moveTo(-radius,0);sh.lineTo(radius,0);sh.lineTo(radius,h-radius);
      sh.absarc(0,h-radius,radius,0,Math.PI,false);sh.lineTo(-radius,0);
      return sh;
    };
    const archWindow=(x,y,z,angle,w,h)=>{
      const surround=new THREE.Mesh(new THREE.ShapeGeometry(archShape(w,h)),stone);
      surround.position.set(x,y,z);surround.rotation.y=angle;group.add(surround);
      const inset=new THREE.Mesh(new THREE.ShapeGeometry(archShape(w*.69,h*.77)),mats.darkStone);
      inset.position.set(x+Math.sin(angle)*.009,y+h*.085,z+Math.cos(angle)*.009);
      inset.rotation.y=angle;group.add(inset);
      if(!low){
        const glass=new THREE.Mesh(new THREE.ShapeGeometry(archShape(w*.43,h*.61)),mats.window);
        glass.position.set(x+Math.sin(angle)*.016,y+h*.13,z+Math.cos(angle)*.016);
        glass.rotation.y=angle;group.add(glass);
      }
    };
    if(!low){
      for(const y of [.51,.25+keepHeight*.5,.25+keepHeight-.12]){
        box(group,.99,.055,.90,stone,0,y,-.12);
      }
      for(const x of [-.43,.43])for(const z of [-.48,.24])
        box(group,.085,keepHeight*.83,.09,stone,x,.25+keepHeight*.42,z);
      for(const y of [.44,.25+keepHeight*.55]){
        for(const x of [-.26,0,.26])archWindow(x,y,.311,0,.145,.28);
        for(const z of [-.36,-.10,.16])archWindow(.479,y,z,Math.PI/2,.145,.28);
      }
      const lanternY=.32+keepHeight+(.68+(tier-1)*.07)*.68;
      addCylinder(group,.145,.19,.34,stone,0,lanternY,-.12,8);
      addCylinder(group,0,.19,.36,roof,0,lanternY+.32,-.12,8);
      addCylinder(group,.018,.025,.16,accent,0,lanternY+.55,-.12,6);
    }
    // Optional CC0 fortification facade. Clone owned geometries/materials so
    // normal castle teardown never disposes a cached GLB template.
    const gateTemplate=glbTemplates.get("castle_gate");
    if(gateTemplate&&!low){
      const gate=gateTemplate.clone(true);
      gate.traverse(node=>{
        if(!node.isMesh)return;
        node.geometry=node.geometry.clone();
        const recolor=original=>{
          const mat=original.clone();
          const name=original.name.toLowerCase();
          // Textured procedural materials use white tint; use the actual skin palette.
          if(name==="stone_light")mat.color.set(skin?.stone||"#9c9b8b");
          else if(name==="stone")mat.color.set(skin?.wall||"#a69a80");
          else if(name==="main")mat.color.set(skin?.banner||"#24476B");
          return mat;
        };
        node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
      });
      gate.position.set(0,.22,.71);
      group.add(gate);
      group.userData.coICastleGateAsset=gateTemplate.userData.coIAssetId;
    }else{
      // Full original entry survives missing downloads and low-end devices.
      box(group,.66,.72,.27,stone,0,.58,.54);
      box(group,.36,.49,.035,mats.darkStone,0,.50,.695);
      box(group,.30,.45,.045,mats.wood,0,.48,.72);
      box(group,.44,.075,.08,accent,0,.74,.725);
    }
    box(group,.66,.09,.24,stone,0,.09,.77);
    const towers=low?[[-.62,.46],[.62,.46]]:[[-.62,.46],[.62,.46],[-.62,-.44],[.62,-.44]];
    for(const [x,z] of towers){
      addCylinder(group,.22,.26,towerHeight,stone,x,.25+towerHeight/2,z,low?6:10);
      addCylinder(group,.29,.25,.13,stone,x,.25+towerHeight,z,low?6:10);
      addCylinder(group,0,.30,.47+(tier-1)*.035,roof,x,.25+towerHeight+.30,z,low?6:10);
      if(low)box(group,.09,.25,.04,mats.darkStone,x,.25+towerHeight*.65,z+.255);
      else{
        archWindow(x,.25+towerHeight*.52,z+.255,0,.14,.29);
        archWindow(x+.255,.25+towerHeight*.52,z,Math.PI/2,.14,.29);
        addCylinder(group,.245,.255,.045,wall,x,.25+towerHeight*.35,z,10);
        addCylinder(group,.26,.25,.045,stone,x,.25+towerHeight*.79,z,10);
      }
      if(!low)box(group,.11,.04,.06,accent,x,.25+towerHeight*.65-.14,z+.26);
    }
    for(const x of [-.47,.47])box(group,.32,.56,.18,wall,x,.48,.55);
    // Repeated crenellations add a recognizable fortified silhouette in one draw call.
    const battlementPositions=[];
    for(const x of [-.48,-.24,0,.24,.48])battlementPositions.push([x,.84,-.64]);
    if(!low)for(const z of [-.38,-.12,.14])for(const x of [-.72,.72])battlementPositions.push([x,.84,z]);
    const battlements=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.17,.13),stone,battlementPositions.length);
    const transform=new THREE.Object3D();
    battlementPositions.forEach(([x,y,z],i)=>{transform.position.set(x,y,z);transform.updateMatrix();battlements.setMatrixAt(i,transform.matrix);});
    battlements.instanceMatrix.needsUpdate=true;battlements.computeBoundingSphere();group.add(battlements);
    for(const z of [-.38,.23]){
      box(group,.14,.58,.54,wall,-.65,.45,z);
      box(group,.14,.58,.54,wall,.65,.45,z);
    }
    if(low)for(const x of [-.24,.24]){
      box(group,.12,.30,.045,mats.darkStone,x,.25+keepHeight*.65,.32);
      box(group,.075,.22,.055,mats.window,x,.25+keepHeight*.65,.35);
    }
    // Tier-dependent buttresses and royal ornaments; no effect on gameplay.
    if(tier>=2&&!low)for(const x of [-.43,.43])box(group,.12,.76,.14,stone,x,.63,.42);
    if(tier>=3){
      addCylinder(group,.028,.028,.42,accent,0,.90+keepHeight,-.12,6);
      const finial=new THREE.Mesh(new THREE.OctahedronGeometry(.10),accent);
      finial.position.set(0,1.13+keepHeight,-.12);group.add(finial);
    }
    if(high)for(const x of [-.48,-.24,0,.24,.48])box(group,.14,.16,.14,stone,x,.90,.51);
    if(!low){
      const bannerMaterial=material(skin?.banner||"#E7BD68",.82);
      // The heraldic seal keeps the original royal palette and respects owned skins.
      const seal=new THREE.Mesh(new THREE.CircleGeometry(.105,10),accent);
      seal.position.set(0,.25+keepHeight*.84,.323);group.add(seal);
      const sealCore=new THREE.Mesh(new THREE.CircleGeometry(.064,10),material(skin?.seal||"#24476B",.58));
      sealCore.position.set(0,.25+keepHeight*.84,.328);group.add(sealCore);
      for(const x of [-.40,.40])box(group,.13,.34,.035,bannerMaterial,x,.99,.65);
    }
  }
  // Resource plots have their own silhouette instead of the common civic house.
  // Local decor stays inside the 2x2 plot (1.06 scene units), never changing D1.
  const ruralTypes=new Set(["farm","quarry","lumber_mill","iron_mine"]);
  function addRuralBuilding(group,type,level,wall,roof){
    const high=qualityProfile?.tier==="high";
    const low=qualityProfile?.tier==="low";
    const stage=level>=20?3:level>=10?2:1;
    group.userData.coIArchitecture="eldoria-rural-v1";
    group.userData.coIArchitectureTier=stage;
    box(group,1.02,.08,1.02,mats.darkStone,0,.04,0);
    if(type==="farm"){
      const earth=material("#725033"),grain=material("#d4ad52");
      box(group,.98,.05,.98,earth,0,.10,0);
      // Barn and foreground crop field are separate readable volumes.
      box(group,.78,.46+.06*stage,.38,wall,0,.35+.03*stage,-.27);
      const barnRoof=new THREE.Mesh(new THREE.ConeGeometry(1,.3,4),roof);
      barnRoof.rotation.y=Math.PI/4;barnRoof.scale.set(.86/Math.SQRT2,1,.48/Math.SQRT2);
      barnRoof.position.set(0,.76+.06*stage,-.27);group.add(barnRoof);
      box(group,.21,.32,.035,mats.wood,0,.28,-.06);
      for(const x of [-.32,0,.32])box(group,.20,.035,.49,earth,x,.145,.23);
      const rows=low?2:high?5:3;
      const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.014,.022,.15,5),grain,rows*3);
      const dummy=new THREE.Object3D();
      let i=0;
      for(const x of [-.32,0,.32])for(let j=0;j<rows;j++){
        dummy.position.set(x,.23,.02+j*.42/(rows-1));
        dummy.scale.setScalar(1);dummy.updateMatrix();stems.setMatrixAt(i++,dummy.matrix);
      }
      stems.instanceMatrix.needsUpdate=true;stems.computeBoundingSphere();group.add(stems);
    }else if(type==="lumber_mill"){
      // Open timber shed with stacked logs, not a closed stone house.
      for(const x of [-.42,.42])for(const z of [-.42,-.02])
        box(group,.075,.62,.075,mats.wood,x,.39,z);
      box(group,.98,.10,.54,roof,0,.76,-.22);
      box(group,.80,.09,.40,mats.wood,0,.36,-.22);
      for(let i=0;i<3+stage;i++){
        const log=addCylinder(group,.055,.055,.72,mats.wood,0,.16+Math.floor(i/3)*.12,.07+(i%3)*.14,7);
        log.rotation.z=Math.PI/2;
      }
      const saw=new THREE.Mesh(new THREE.TorusGeometry(.14,.025,5,12),mats.gold);
      saw.position.set(.22,.51,-.02);group.add(saw);
    }else{
      // Excavated working area, distinct ore colors and a mine entrance.
      const oreMat=type==="iron_mine"?material("#788c9d",.38):mats.stone;
      box(group,.96,.09,.96,mats.roadEdge,0,.11,0);
      if(type==="iron_mine"){
        box(group,.80,.64+.06*stage,.48,mats.darkStone,0,.43,-.24);
        box(group,.37,.46,.035,mats.wood,0,.36,.012);
        box(group,.26,.37,.04,material("#242823"),0,.32,.035);
        for(const x of [-.21,.21])box(group,.07,.51,.08,mats.wood,x,.36,.045);
        box(group,.51,.08,.09,mats.wood,0,.64,.045);
        for(const x of [-.12,.12])box(group,.032,.03,.39,mats.gold,x,.18,.30);
      }else{
        box(group,.86,.30+.05*stage,.44,wall,0,.28,-.26);
        box(group,.65,.17,.32,mats.stone,0,.51+.05*stage,-.28);
      }
      for(let i=0;i<(low?3:5);i++){
        const size=.105+(i%3)*.025;
        const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(size,0),oreMat);
        rock.position.set(-.32+(i%3)*.32,.16+size*.55,.22+Math.floor(i/3)*.22);
        rock.rotation.set(.2,i*.7,.3);group.add(rock);
      }
    }
  }
  function createBuilding(type, level, x, z, castleSkinId = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.userData.coIType = type;
    group.userData.coIProcedural = true;
    const castleSkin=type==="castle"?(castleSkinPalettes[Number(castleSkinId)]||null):null;
    const colors = castleSkin ? [castleSkin.wall,castleSkin.roof] : (palettes[type] || palettes.warehouse);
    const seed = [...String(type)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const wall = surfaceMaterial(colors[0], "stone", seed);
    const roof = surfaceMaterial(colors[1], "roof", seed + 101);
    const castleStone=castleSkin?surfaceMaterial(castleSkin.stone,"stone",seed+207):mats.stone;
    const castleRoof=castleSkin?surfaceMaterial(castleSkin.roof,"roof",seed+309):mats.roof;
    const castleAccent=castleSkin?material(castleSkin.accent,.52):mats.gold;
    const safeLevel=Math.min(30,Math.max(1,Math.floor(Number(level)||1)));
    if(type==="castle"){
      addEldoriaCastle(group,safeLevel,castleSkin,wall,roof,castleStone,castleAccent);
      return group;
    }
    if(ruralTypes.has(type)){
      addRuralBuilding(group,type,safeLevel,wall,roof);
      return group;
    }
    if(type==="wall"||type==="watchtower"){
      // Original stone defenses: actual silhouettes, not isolated placeholder cubes.
      const height=(type==="watchtower"?1.24:.66)+safeLevel*.018;
      group.userData.coIArchitecture="eldoria-defenses-v1";
      if(type==="wall"){
        box(group,1.68,.13,.74,mats.darkStone,0,.065,0);
        box(group,1.52,height,.47,wall,0,.13+height/2,0);
        box(group,1.62,.12,.59,mats.stone,0,.13+height,0);
        for(const x of [-.62,-.31,0,.31,.62])box(group,.19,.21,.52,mats.stone,x,.29+height,0);
        for(const x of [-.68,.68])box(group,.23,height+.05,.64,mats.stone,x,.14+height/2,0);
        for(const x of [-.35,.35])box(group,.055,.20,.035,mats.darkStone,x,.16+height*.64,.25);
      }else{
        box(group,1.12,.14,1.12,mats.darkStone,0,.07,0);
        addCylinder(group,.36,.44,height,wall,0,.14+height/2,0,8);
        addCylinder(group,.49,.38,.16,mats.stone,0,.14+height,0,8);
        for(let i=0;i<8;i++){
          const a=i*Math.PI/4;
          const merlon=box(group,.20,.24,.19,mats.stone,.43*Math.cos(a),height+.31,.43*Math.sin(a));
          merlon.rotation.y=-a;
        }
        box(group,.09,.33,.055,mats.darkStone,0,.14+height*.65,.39);
        box(group,.21,.31,.06,mats.wood,0,.31,.44);
        addCylinder(group,.024,.024,.52,mats.wood,0,height+.48,0,6);
        box(group,.34,.19,.025,mats.gold,.17,height+.66,0);
      }
      return group;
    }
    const [bodyWidth,baseHeight,bodyDepth,roofHeight]=buildingProfiles[type]||buildingProfiles.warehouse;
    const height = baseHeight + safeLevel * .024;
    group.userData.coIArchitecture="eldoria-civic-v1";

    // Shared architectural language: visible stone footing, timber eaves and a
    // readable roof silhouette, while each building keeps its own landmark.
    box(group, 1.56, .14, 1.32, mats.darkStone, 0, .05, 0);
    box(group, bodyWidth, height, bodyDepth, wall, 0, height / 2, 0);
    box(group, bodyWidth+.08, .09, bodyDepth+.08, mats.wood, 0, height + .035, 0);
    if(type==="wall"||type==="quarry"||type==="iron_mine"){
      box(group,bodyWidth+.09,.12,bodyDepth+.09,mats.darkStone,0,height+.10,0);
    }else{
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1, roofHeight, 4), roof);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.scale.set((bodyWidth+.14)/Math.SQRT2,1,(bodyDepth+.14)/Math.SQRT2);
      roofMesh.position.y = height + .08 + roofHeight/2;
      roofMesh.castShadow = true;
      group.add(roofMesh);
    }

    // Warm emissive windows stay legible in the isometric view without adding
    // real-time point lights to every building.
    const facade=bodyDepth/2+.025;
    box(group, .23, Math.min(.48,height*.70), .04, mats.wood, 0, Math.min(.24,height*.35), facade);
    for (const wx of [-bodyWidth*.30, bodyWidth*.30]) {
      box(group, .18, .22, .045, mats.window, wx, height * .63, facade);
      box(group, .035, .25, .055, mats.wood, wx, height * .63, facade+.025);
      box(group, .2, .035, .055, mats.wood, wx, height * .63, facade+.025);
    }

    if (type === "watchtower") {
      box(group, .16, .95, .16, mats.wood, 0, height + .42, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(.48, .28), material("#A9433B"));
      flag.position.set(.25, height + .78, 0);
      flag.rotation.y = Math.PI / 2;
      group.add(flag);
      box(group, .48, .12, .48, mats.gold, 0, height + .82, 0);
    } else if (type === "barracks") {
      // Weapon rack and practice dummies make the military function obvious.
      box(group, .9, .08, .12, mats.wood, 0, .48, -.7);
      for (const sx of [-.32, 0, .32]) {
        addCylinder(group, .025, .025, .72, mats.gold, sx, .84, -.7, 6);
        box(group, .19, .055, .055, mats.wood, sx, 1.0, -.7);
      }
      for (const sx of [-.48, .48]) {
        addCylinder(group, .07, .09, .58, mats.wood, sx, .35, .72, 7);
        box(group, .3, .07, .07, mats.wood, sx, .62, .72);
      }
    } else if (type === "market") {
      // Blue-and-gold striped stall canopy and a timber counter.
      box(group, .92, .13, .42, mats.wood, 0, .78, .76);
      for (const sx of [-.48, -.16, .16, .48]) {
        addCylinder(group, .025, .025, .88, mats.wood, sx, .48, .76, 6);
      }
      for (let i = 0; i < 4; i++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.25, .42), new THREE.MeshStandardMaterial({
          color: i % 2 ? "#E7BD68" : "#24476B", side: THREE.DoubleSide, roughness: .9
        }));
        stripe.position.set(-.36 + i * .24, .84, .76);
        stripe.rotation.x = -.12;
        group.add(stripe);
      }
    } else if (type === "academy") {
      addCylinder(group, .26, .32, 1.05, mats.stone, .52, height + .48, -.25, 8);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(.34, .68, 6), mats.roof);
      spire.position.set(.52, height + 1.32, -.25);
      spire.castShadow = true;
      group.add(spire);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mats.gold);
      orb.position.set(.52, height + 1.7, -.25);
      group.add(orb);
    } else if (type === "wall") {
      for (let i = -2; i <= 2; i++) {
        box(group, .2, .24, .2, mats.stone, i * .24, height + .14, -.56);
        box(group, .2, .24, .2, mats.stone, i * .24, height + .14, .56);
      }
    } else if (type === "hospital") {
      box(group, .16, .56, .08, material("#A9433B"), 0, .82, .67);
      box(group, .48, .16, .08, material("#A9433B"), 0, .82, .67);
    } else if (type === "stable") {
      for (const sx of [-.52, .52]) box(group, .08, .55, .08, mats.wood, sx, .32, .76);
      for (const sy of [.2, .48]) box(group, 1.05, .07, .08, mats.wood, 0, sy, .76);
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .3, 7), material("#C9A75A"));
      hay.position.set(.42, .18, -.76);
      hay.rotation.z = Math.PI / 2;
      group.add(hay);
    } else if (type === "archery_range") {
      const targetBase = new THREE.Mesh(new THREE.CircleGeometry(.31, 16), mats.wood);
      targetBase.position.set(.5, .72, .68);
      group.add(targetBase);
      for (const [radius, tube, color, offset] of [
        [.23, .035, "#F5EDDA", .71], [.15, .028, "#A9433B", .72], [.07, .02, "#E7BD68", .73]
      ]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 16), material(color));
        ring.position.set(.5, .72, offset);
        group.add(ring);
      }
    } else if (type === "siege_workshop") {
      addBuildingWheel(group, -.55, .3, .72, .25);
      addBuildingWheel(group, .55, .3, .72, .25);
      box(group, .9, .12, .16, mats.wood, 0, .52, .72);
      addCylinder(group, .06, .06, .8, mats.gold, 0, .92, .72, 6);
    } else if (type === "embassy") {
      for (const sx of [-.48, 0, .48]) {
        addCylinder(group, .07, .09, .86, mats.stone, sx, .48, .75, 8);
        box(group, .18, .08, .18, mats.gold, sx, .92, .75);
      }
    } else if (type === "warehouse") {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        const crate = box(group, .32, .32, .32, mats.wood, -.34 + col * .68, .22 + row * .34, -.76);
        crate.rotation.y = (row + col) * .12;
        box(group, .34, .035, .035, mats.gold, -.34 + col * .68, .22 + row * .34, -.59);
      }
    }
    return group;
  }
  // A single instanced soft contact-shadow batch anchors every visible building,
  // even when expensive shadow maps are disabled on mobile.
  function createCityContactShadows() {
    const size=64,canvas=document.createElement("canvas");canvas.width=canvas.height=size;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const gradient=ctx.createRadialGradient(32,32,4,32,32,31);
    gradient.addColorStop(0,"rgba(0,0,0,0.66)");
    gradient.addColorStop(.55,"rgba(0,0,0,0.32)");
    gradient.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
    const texture=new THREE.CanvasTexture(canvas);
    const mat=new THREE.MeshBasicMaterial({color:0x30271e,map:texture,transparent:true,depthWrite:false,opacity:qualityProfile?.shadows ? .42 : .82});
    contactShadowBatch=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mat,24);
    contactShadowBatch.count=0;
    contactShadowBatch.renderOrder=1;
    scene.add(contactShadowBatch);
  }
  function updateCityContactShadows() {
    if(!contactShadowBatch)return;
    const transform=new THREE.Object3D(),bounds=new THREE.Box3(),size=new THREE.Vector3();
    transform.rotation.x=-Math.PI/2;
    const count=Math.min(24,activeModels.length);
    for(let i=0;i<count;i++){
      const model=activeModels[i];
      bounds.setFromObject(model);bounds.getSize(size);
      const footprint=cityContactShadowSize(size.x,size.z);
      transform.position.set(model.position.x,-.028,model.position.z);
      transform.scale.set(footprint.width,footprint.depth,1);
      transform.updateMatrix();contactShadowBatch.setMatrixAt(i,transform.matrix);
    }
    contactShadowBatch.count=count;
    contactShadowBatch.instanceMatrix.needsUpdate=true;
    if(count)contactShadowBatch.computeBoundingSphere();
  }
  function buildGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), mats.grass);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.08; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(32, 50, "#91a36d", "#91a36d");
    grid.position.y = -.055; grid.material.transparent = true; grid.material.opacity = .025;
    grid.material.depthWrite = false; scene.add(grid);
    // A winding stone road crosses the settlement.
    const points = [
      new THREE.Vector3(-6.4, .015, 4.2), new THREE.Vector3(-3.8, .015, 3.3),
      new THREE.Vector3(-1.5, .015, 2.5), new THREE.Vector3(.5, .015, .9),
      new THREE.Vector3(2.8, .015, -.8), new THREE.Vector3(5.8, .015, -3.7)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    // Ground-conforming paved ribbon instead of a raised tube.
    // Two bounded static meshes, shared materials and no per-frame work.
    const pathRibbon = (width, height, mat) => {
      const positions = [], uvs = [], indices = [];
      const segments = 36, arcLength = curve.getLength();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
        const length = Math.hypot(tangent.x, tangent.z) || 1;
        const nx = -tangent.z / length, nz = tangent.x / length;
        for (const side of [-1, 1]) {
          positions.push(p.x + nx * width * side, height, p.z + nz * width * side);
          uvs.push((side + 1) / 2, t * arcLength / 2);
        }
        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.receiveShadow = true; scene.add(mesh); legacyRoadMeshes.push(mesh);
    };
    pathRibbon(.46, -.06, mats.roadEdge);
    pathRibbon(.36, -.045, mats.road);
    // Forest is batched into three instanced draw calls instead of one per tree part.
    addForestInstances();
    createCityContactShadows();
  }
  // Rebuild only when the actual plot layout changes. Two batched draw calls,
  // shared terrain materials, no extra textures or animation work.
  function updateCityStreets(){
    const plots=activeModels.map(model=>{
      const fp=serverCityFootprint(model.userData.coIType);
      if(fp&&!model.userData.coISpecial){
        const w=fp.width*CITY_TILE_WORLD/2,h=fp.height*CITY_TILE_WORLD/2;
        return {minX:model.position.x-w,maxX:model.position.x+w,minZ:model.position.z-h,maxZ:model.position.z+h};
      }
      const bounds=new THREE.Box3().setFromObject(model);
      return {minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z};
    });
    const signature=JSON.stringify(plots.map(p=>Object.values(p).map(v=>Math.round(v*1000))));
    if(signature===cityStreetSignature)return;
    cityStreetSignature=signature;
    for(const mesh of cityStreetMeshes){scene.remove(mesh);mesh.geometry.dispose();}
    cityStreetMeshes=[];
    const cells=planCityStreetCells(plots);
    // Never show the old arbitrary road on a populated layout.
    for(const mesh of legacyRoadMeshes)mesh.visible=plots.length<2;
    if(!cells.length)return;
    const keys=new Set(cells.map(({x,z})=>x+","+z));
    const tile=CITY_TILE_WORLD;
    function streetMesh(mat,y,inset){
      const pos=[],uv=[],indices=[];
      const quad=(x0,z0,x1,z1)=>{
        const i=pos.length/3;
        for(const [x,z] of [[x0,z0],[x0,z1],[x1,z1],[x1,z0]]){
          pos.push(x,y,z);uv.push(x/1.2,z/1.2);
        }
        indices.push(i,i+1,i+2,i,i+2,i+3);
      };
      for(const {x,z} of cells){
        const x0=x*tile,z0=z*tile,x1=x0+tile,z1=z0+tile;
        quad(x0+inset,z0+inset,x1-inset,z1-inset);
        if(!inset)continue;
        if(keys.has((x-1)+","+z))quad(x0,z0+inset,x0+inset,z1-inset);
        if(keys.has((x+1)+","+z))quad(x1-inset,z0+inset,x1,z1-inset);
        if(keys.has(x+","+(z-1)))quad(x0+inset,z0,x1-inset,z0+inset);
        if(keys.has(x+","+(z+1)))quad(x0+inset,z1-inset,x1-inset,z1);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
      geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,mat);mesh.receiveShadow=true;
      scene.add(mesh);cityStreetMeshes.push(mesh);
    }
    streetMesh(mats.roadEdge,-.06,0);
    streetMesh(mats.road,-.045,.075);
  }
  function serverCityFootprint(type){
    return readCityFootprint(window.__coiCityLayoutState?.()?.cityLayout?.footprints,type);
  }
  function cityWorldPoint(building, index) {
    const x = Number(building?.position_x), z = Number(building?.position_z);
    if (building?.position_x != null && building?.position_z != null &&
        Number.isFinite(x) && Number.isFinite(z)) return cityModelAnchor(x,z,serverCityFootprint(building.building_type));
    // Only legacy buildings without stored coordinates use this preview grid.
    // Keep the familiar 3x3 arrangement for compact cities, and arrange
    // larger settlements in four columns without changing persisted layout.
    const columns = latestBuildings.length > 9 ? 4 : 3;
    const spacingX = columns === 4 ? 3.35 : 4.15;
    const spacingZ = columns === 4 ? 3.0 : 3.15;
    const rows = Math.ceil(Math.min(16, latestBuildings.length) / columns);
    return {
      x: (index % columns - (columns - 1) / 2) * spacingX,
      z: (Math.floor(index / columns) - (rows - 1) / 2) * spacingZ
    };
  }
  function currentSpecialLandmarks(){return planSpecialCityLandmarks(window.__coiKingdomSpecialBuildings);}
  function createSpecialLandmark(type){
    const group=new THREE.Group();
    group.userData.coIType=type;group.userData.coIProcedural=true;group.userData.coISpecial=true;
    // Two compact original silhouettes; use shared scene materials and disposable geometry.
    box(group,1.5,.15,1.5,mats.darkStone,0,.075,0);
    if(type==="dragon_nest"){
      addCylinder(group,.65,.7,.32,mats.stone,0,.27,0,10);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        const twig=box(group,.42,.12,.11,mats.wood,.58*Math.cos(a),.46,.58*Math.sin(a));
        if(twig)twig.rotation.y=-a+Math.PI/2;
      }
      for(const [x,z] of [[-.23,-.14],[.23,-.12],[0,.23]]){
        const egg=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),mats.gold);
        egg.scale.y=1.45;egg.position.set(x,.58,z);group.add(egg);
      }
    }else{
      box(group,1.14,.14,1.14,mats.stone,0,.22,0);
      for(const x of [-.48,.48])for(const z of [-.48,.48])addCylinder(group,.09,.12,.78,mats.stone,x,.68,z,6);
      box(group,1.2,.12,1.2,mats.gold,0,1.12,0);
      const crest=new THREE.Mesh(new THREE.OctahedronGeometry(.28),mats.window);
      crest.position.y=1.43;group.add(crest);
      box(group,.43,.28,.43,mats.roof,0,.42,0);
    }
    return group;
  }
  function frameCityBuildings(buildings) {
    if (!camera || !buildings.length) return;
    // Overview includes all special sites; center mode focuses regular buildings.
    const points = (cameraFocusCenter ? buildings : [...buildings,...currentSpecialLandmarks()]).map(cityWorldPoint);
    const xs = points.map(p => p.x), zs = points.map(p => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    camera.position.set(cx + 10, 13, cz + 11);
    camera.lookAt(cx, .2, cz);
    // On narrow Android screens world-space X/Z spans are insufficient: the
    // diagonal isometric projection can crop buildings at the left and right.
    // Fit the *camera-space* footprint to the actual orthographic viewport.
    camera.updateMatrixWorld(true);
    const projected = points.map(({ x, z }) =>
      new THREE.Vector3(x, .18, z).applyMatrix4(camera.matrixWorldInverse));
    const screenXs = projected.map(point => point.x);
    const screenYs = projected.map(point => point.y);
    const projectedWidth = Math.max(...screenXs) - Math.min(...screenXs) + 3.2;
    const projectedHeight = Math.max(...screenYs) - Math.min(...screenYs) + 5.3;
    const viewportWidth = Math.max(1, camera.right - camera.left);
    const viewportHeight = Math.max(1, camera.top - camera.bottom);
    // Player zoom remains view-only. A reset always restores the safe fit.
    const fitZoom = Math.min(1, viewportWidth / projectedWidth, viewportHeight / projectedHeight);
    camera.zoom = fitZoom * cameraZoomFactor;
    camera.updateProjectionMatrix();
  }
  function publishBuildingHitTargets(buildings = latestBuildings) {
    if (!host || !camera || !renderer || disposed) return;
    camera.updateMatrixWorld(true);
    const list = (Array.isArray(buildings) ? buildings : []).slice(0, Math.min(16, qualityProfile?.maxBuildings || 9));
    const positions = list.map((building, index) => {
      const { x, z } = cityWorldPoint(building, index);
      const projected = new THREE.Vector3(x, .18, z).project(camera);
      const visible = projected.z >= -1 && projected.z <= 1
        && projected.x >= -1 && projected.x <= 1
        && projected.y >= -1 && projected.y <= 1;
      return {
        type: building?.building_type || "",
        left: (projected.x * .5 + .5) * 100,
        top: (1 - (projected.y * .5 + .5)) * 100,
        visible
      };
    });
    window.dispatchEvent(new CustomEvent("coi:kingdom-projection", { detail: { positions } }));
  }
  function renderBuildings(buildings, castleSkinId = latestCastleSkinId) {
    latestBuildings = Array.isArray(buildings) ? buildings : [];
    latestCastleSkinId=Number(castleSkinId)||0;
    if (!renderer || !scene || !camera) return;
    for (const item of activeModels) {
      disposeCastleVisualUpgrades(item);
      scene.remove(item);
      if (item.userData.coIProcedural) item.traverse(node => {
        if (!node.isMesh) return;
        if (node.isInstancedMesh) node.dispose();
        node.geometry?.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(mat => { if (mat && !sharedMaterials.has(mat)) mat.dispose(); });
      });
    }
    activeModels = [];
    // Keep deterministic world-space building anchors. HTML hit targets are
    // projected into screen coordinates from this same camera below.
    const list = (Array.isArray(buildings) ? buildings : []).slice(0, Math.min(16, qualityProfile?.maxBuildings || 9));
    frameCityBuildings(list);
    list.forEach((b, i) => {
      const { x, z } = cityWorldPoint(b, i);
      const template = glbTemplates.get(b.building_type);
      const group = b.building_type==="castle"||!template
        ? createBuilding(b.building_type, b.level, x, z, latestCastleSkinId) : template.clone(true);
      group.position.set(x, 0, z); group.userData.coIType = b.building_type;
      const plot=serverCityFootprint(b.building_type);
      let artScale=1;
      if(plot){
        const bounds=new THREE.Box3().setFromObject(group);
        artScale=cityModelFit(b.building_type,plot,Math.max(Math.abs(bounds.min.x-x),Math.abs(bounds.max.x-x)),Math.max(Math.abs(bounds.min.z-z),Math.abs(bounds.max.z-z)));
      }
      group.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      // Adicionar acessórios depois das sombras: ornamentos mobile não projetam sombras.
      if (b.building_type === "castle") applyCastleVisualUpgrades(group, b.level, latestCastleVipLevel);
      group.scale.multiplyScalar(artScale);
      group.userData.coIArtScale=artScale;
      scene.add(group);
      activeModels.push(group);
    });
    for(const landmark of currentSpecialLandmarks()){
      const group=createSpecialLandmark(landmark.building_type);
      const {x,z}=cityWorldPoint(landmark,0);
      group.position.set(x,0,z);
      // Small decorations have no extra animation or shadow draw calls.
      scene.add(group);activeModels.push(group);
    }
    updateCityStreets();
    updateCityContactShadows();
    renderer.render(scene, camera);
    publishBuildingHitTargets(list);
  }
  // Defesas 4X são meshes leves; posições usam a mesma escala do castelo 3D.
  function renderCityDefenses(defenses = []) {
    if (!scene || !renderer || disposed) return;
    for (const object of activeDefenseModels) {
      scene.remove(object);
      disposeDetachedObject3D(object);
    }
    activeDefenseModels = [];
    const entries = (Array.isArray(defenses) ? defenses : []).slice(0, 32);
    const distantByType=new Map();
    for (const item of entries) {
      const type = item?.defense_type;
      const x = Number(item.grid_x), z = Number(item.grid_z);
      const w = Number(item.width), h = Number(item.height);
      if (!["tower","trap","gate"].includes(type) ||
          ![x,z,w,h].every(Number.isFinite) || w<1 || h<1 || w>5 || h>5) continue;
      const worldX=(x+w/2)*.53,worldZ=(z+h/2)*.53;
      const threshold=qualityProfile?.tier==="low"?22:30;
      if(camera.position.distanceToSquared(new THREE.Vector3(worldX,0,worldZ))>threshold*threshold){
        if(!distantByType.has(type))distantByType.set(type,[]);
        distantByType.get(type).push({x:worldX,z:worldZ,sx:w*.53,sz:h*.53});
        continue;
      }
      const group = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({color:"#89959c",roughness:.87});
      const wood = new THREE.MeshStandardMaterial({color:"#6d4834",roughness:.9});
      const accent = new THREE.MeshStandardMaterial({color:type==="trap"?"#a3694a":"#c4a45e",roughness:.75});
      const add = (geometry,material,px,py,pz) => {
        const mesh = new THREE.Mesh(geometry,material);
        mesh.position.set(px,py,pz);
        mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      };
      const sx=w*.53,sz=h*.53;
      add(new THREE.BoxGeometry(sx*.88,.12,sz*.88),stone,0,.06,0);
      if(type==="tower"){
        add(new THREE.CylinderGeometry(.28,.34,1.05,8),stone,0,.64,0);
        add(new THREE.CylinderGeometry(.38,.3,.16,8),accent,0,1.25,0);
      }else if(type==="gate"){
        const pillarHeight=.95;
        add(new THREE.BoxGeometry(.18,pillarHeight,.22),stone,-sx*.3,.55,0);
        add(new THREE.BoxGeometry(.18,pillarHeight,.22),stone,sx*.3,.55,0);
        add(new THREE.BoxGeometry(sx*.75,.18,.24),accent,0,1.08,0);
        add(new THREE.BoxGeometry(sx*.37,.6,.08),wood,0,.39,0);
      }else{
        for(const dx of [-.12,0,.12])for(const dz of [-.12,.12])
          add(new THREE.ConeGeometry(.072,.35,4),accent,dx,.29,dz);
      }
      group.position.set(worldX,0,worldZ);
      group.userData.coIDefenseId = item.id;
      scene.add(group); activeDefenseModels.push(group);
    }
    // Defesas distantes compartilham geometria e material por tipo (uma draw call por tipo).
    for(const [type,list] of distantByType){
      const geometry=new THREE.BoxGeometry(1,1,1);
      const material=new THREE.MeshStandardMaterial({
        color:type==="trap"?0xa3694a:type==="tower"?0x89959c:0xc4a45e,
        roughness:.9
      });
      const instanced=new THREE.InstancedMesh(geometry,material,list.length);
      const dummy=new THREE.Object3D();
      list.forEach((item,i)=>{
        const height=type==="tower" ? 1.45 : type==="gate" ? 0.98 : 0.22;
        dummy.position.set(item.x,height/2,item.z);
        dummy.scale.set(item.sx*.8,height,item.sz*.8);
        dummy.updateMatrix();
        instanced.setMatrixAt(i,dummy.matrix);
      });
      instanced.instanceMatrix.needsUpdate=true;
      instanced.computeBoundingSphere();
      scene.add(instanced);
      activeDefenseModels.push(instanced);
    }
    renderer.render(scene,camera);
  }
  function renderAssignedHeroFigures(assignments=[]) {
    if(!scene||!renderer||disposed)return;
    for(const figure of activeHeroFigures){
      scene.remove(figure);
      disposeDetachedObject3D(figure);
    }
    activeHeroFigures=[];
    // Até dois postos. Figuras procedurais evitam novos GLBs e luzes dinâmicas.
    for(const hero of (Array.isArray(assignments)?assignments:[]).filter(h=>
      h?.assigned_to==="industry:mill"||h?.assigned_to==="defense:tower").slice(0,2)){
      const role=hero.assigned_to,level=Math.min(100,Math.max(1,Number(hero.level)||1));
      let anchor=null;
      if(role==="industry:mill"){
        const idx=latestBuildings.findIndex(b=>b.building_type==="farm");
        if(idx>=0){const p=cityWorldPoint(latestBuildings[idx],idx);anchor={x:p.x+.9,z:p.z-.6};}
      }else{
        const tower=latestDefenses.find(d=>d.defense_type==="tower");
        if(tower)anchor={
          x:(Number(tower.grid_x)+Number(tower.width)/2)*.53+.6,
          z:(Number(tower.grid_z)+Number(tower.height)/2)*.53
        };
      }
      if(!anchor||![anchor.x,anchor.z].every(Number.isFinite))continue;
      const figure=new THREE.Group();
      const baseColor=role==="industry:mill"?0x88755a:0x3e5f85;
      const glowColor=role==="industry:mill"?0xffcb68:0x74c9ff;
      const armor=new THREE.MeshStandardMaterial({color:baseColor,roughness:.68,metalness:.22});
      const skin=new THREE.MeshStandardMaterial({color:0xd3aa85,roughness:.88});
      const spell=new THREE.MeshStandardMaterial({
        color:glowColor,emissive:glowColor,emissiveIntensity:level>=10 ? 0.65 : 0,
        roughness:.35,metalness:.45
      });
      const part=(geometry,material,x,y,z)=>{
        const mesh=new THREE.Mesh(geometry,material);
        mesh.position.set(x,y,z);
        mesh.castShadow=true;
        figure.add(mesh);
        return mesh;
      };
      part(new THREE.BoxGeometry(.38,.62,.24),armor,0,.52,0);
      part(new THREE.SphereGeometry(.17,8,6),skin,0,.99,0);
      part(new THREE.BoxGeometry(.09,.66,.09),spell,.30,.66,0);
      if(level>=20 && qualityProfile?.tier!=="low"){
        part(new THREE.ConeGeometry(.21,.23,6),armor,0,1.19,0);
        part(new THREE.BoxGeometry(.35,.45,.045),armor,0,.47,-.17);
      }
      // Sinalização de buff sem partículas nem luz dinâmica (até 2 heróis).
      // Removido e liberado com activeHeroFigures/disposeDetachedObject3D.
      const buffRing=new THREE.Mesh(
        new THREE.RingGeometry(.30,.40,16),
        new THREE.MeshBasicMaterial({
          color:glowColor,transparent:true,
          opacity:qualityProfile?.tier==="low"?.26:.40,
          side:THREE.DoubleSide,depthWrite:false
        })
      );
      buffRing.rotation.x=-Math.PI/2;
      buffRing.position.y=.025;
      figure.add(buffRing);
      figure.position.set(anchor.x,0,anchor.z);
      figure.userData.coIHeroKey=hero.hero_key;
      scene.add(figure);
      activeHeroFigures.push(figure);
    }
    renderer.render(scene,camera);
  }
  function updateDefensePreview(detail) {
    if (!scene || !renderer || disposed) return;
    if (defensePreviewMesh) {
      scene.remove(defensePreviewMesh);
      disposeDetachedObject3D(defensePreviewMesh);
      defensePreviewMesh = null;
    }
    const x=Number(detail?.gridX),z=Number(detail?.gridZ),
      w=Number(detail?.width),h=Number(detail?.height);
    if(!detail?.type||![x,z,w,h].every(Number.isFinite)||w<1||h<1||w>5||h>5){
      renderer.render(scene,camera);return;
    }
    const geometry=new THREE.PlaneGeometry(w*.53,h*.53);
    const material=new THREE.MeshBasicMaterial({
      color:detail.valid?0x36d47a:0xe04d57,transparent:true,opacity:.5,
      depthWrite:false,side:THREE.DoubleSide
    });
    defensePreviewMesh=new THREE.Mesh(geometry,material);
    defensePreviewMesh.rotation.x=-Math.PI/2;
    defensePreviewMesh.position.set((x+w/2)*.53,.16,(z+h/2)*.53);
    scene.add(defensePreviewMesh);
    renderer.render(scene,camera);
  }
  function renderEquippedDragon(row) {
    if(!scene || disposed)return;
    const visual=projectDragonVisual(row);
    const template=glbUnitTemplates.get("equipped_dragon");
    if(activeDragon && (!visual || activeDragon.key!==visual.key || activeDragon.level!==visual.level ||
       (template && !activeDragon.figure.imported))){
      scene.remove(activeDragon.figure.root);
      if(activeDragon.figure.imported)disposeImportedDragonFigure(activeDragon.figure);
      else disposeDetachedObject3D(activeDragon.figure.root);
      activeDragon=null;
    }
    if(!visual)return;
    if(!activeDragon){
      let figure;
      if(template){
        try { figure=makeImportedDragonFigure(THREE,cloneSkinned,template,visual); }
        catch(error){ console.info("Clash of Izzy: dragão GLB indisponível.",error); }
      }
      activeDragon={...visual,figure:figure || makeDragonFigure(THREE,visual,qualityProfile?.tier)};
      dragonTime=0;
      scene.add(activeDragon.figure.root);
      poseDragon(activeDragon.figure,0,false);
    }
    const castleIndex=latestBuildings.findIndex(b=>b.building_type==="castle");
    const anchor=castleIndex>=0?cityWorldPoint(latestBuildings[castleIndex],castleIndex):{x:0,z:0};
    activeDragon.figure.root.position.set(anchor.x+1.65,2.35,anchor.z-1.05);
  }
  function canAnimateDragon(){
    return !!activeDragon && qualityProfile?.tier==="high" && !qualityProfile?.prefersReducedMotion;
  }
  function canRunArmyAnimation() {
    return !disposed && !cinematicCaptureActive && !document.hidden && sceneInViewport;
  }
  function refreshArmyAnimationVisibility() {
    if (canRunArmyAnimation()) startArmyAnimationLoop();
    else stopArmyAnimationLoop();
  }
  function stopArmyAnimationLoop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastAnimationTime = 0;
    adaptivePixelScale.reset();
  }
  function renderArmyFrame(timestamp) {
    if (!canRunArmyAnimation() || !renderer || !scene || !camera || (!armyMixers.length && !advancedShaders && !canAnimateDragon())) {
      animationFrame = 0;
      lastAnimationTime = 0;
      return;
    }
    if (lastAnimationTime) {
      const interval = timestamp - lastAnimationTime;
      animationFrameTiming.record(interval);
      // Nao sobrescrever a escolha manual; reduzir DPR apenas apos lentidao
      // consistente. Sem animacao, nao temos amostras suficientes para inferir FPS.
      if (automaticGraphics && adaptivePixelScale.observe(interval) &&
          host.clientWidth && host.clientHeight) {
        const baseRatio = calculateKingdomPixelRatio({
          width: host.clientWidth, height: host.clientHeight,
          devicePixelRatio: window.devicePixelRatio || 1, profile: qualityProfile
        });
        renderer.setPixelRatio(Math.max(0.1, baseRatio * adaptivePixelScale.scale));
      }
    }
    const delta = lastAnimationTime ? Math.min(.05, Math.max(0, (timestamp - lastAnimationTime) / 1000)) : 0;
    lastAnimationTime = timestamp;
    for (const mixer of armyMixers) mixer.update(delta);
    advancedShaders?.update(delta);
    if(canAnimateDragon()){
      dragonTime+=delta;
      poseDragon(activeDragon.figure,dragonTime,true);
    }
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(renderArmyFrame);
  }
  function startArmyAnimationLoop() {
    if (!canRunArmyAnimation() || animationFrame || (!armyMixers.length && !advancedShaders && !canAnimateDragon()) || qualityProfile?.tier === "low" || qualityProfile?.prefersReducedMotion) return;
    lastAnimationTime = 0;
    animationFrameTiming.reset();
    adaptivePixelScale.reset();
    animationFrame = requestAnimationFrame(renderArmyFrame);
  }
  function normalizeGlbTemplate(gltf, asset) {
    const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
    const footprint = Math.max(sourceSize.x, sourceSize.z, .001);
    const height = Math.max(sourceSize.y, .001);
    const targetFootprint = Math.max(.25, Math.min(3.5, Number(asset.targetFootprint) || 2.05));
    const targetHeight = Math.max(.25, Math.min(4.5, Number(asset.targetHeight) || 2.4));
    const uniformScale = Math.min(targetFootprint / footprint, targetHeight / height);
    const template = new THREE.Group();
    const normalizedModel = new THREE.Group();
    normalizedModel.add(gltf.scene);
    normalizedModel.scale.setScalar(uniformScale);
    normalizedModel.position.set(
      -sourceCenter.x * uniformScale,
      -sourceBounds.min.y * uniformScale,
      -sourceCenter.z * uniformScale
    );
    template.add(normalizedModel);
    template.traverse(node => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    return template;
  }
  function safeAssetUrl(asset) {
    const url = new URL(asset.src, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/assets/3d/") || !url.pathname.toLowerCase().endsWith(".glb")) {
      throw new TypeError("Asset GLB fora da pasta local aprovada.");
    }
    return url.href;
  }
  async function loadManifestAsset(entry) {
    const { asset, kind } = entry;
    try {
      const assetUrl = safeAssetUrl(asset);
      const loadPromise = gltfLoader.loadAsync(assetUrl);
      const gltf = await loadPromise;
      if (disposed || !renderer) {
        disposeDetachedObject3D(gltf.scene);
        return;
      }
      const template = normalizeGlbTemplate(gltf, asset);
      if (kind === "building") {
        template.userData.coIAssetId = asset.id;
        glbTemplates.set(asset.type, template);
      }
      else if (kind === "prop") glbPropTemplates.set(asset.id, template);
      else if (kind === "unit") glbUnitTemplates.set(asset.unit_type, {
        template,
        animations: Array.isArray(gltf.animations) ? gltf.animations : [],
        animation: asset.animation || "idle",
        maxInstances: Math.max(1, Math.min(8, Number(asset.maxInstances) || 4))
      });
    } catch (assetError) {
      console.info(`Clash of Izzy: GLB ${asset.id || asset.type || asset.unit_type} indisponível; mantendo o fallback procedural.`, assetError);
    }
  }
  function scheduleManifestAsset(entry) {
    if (glbLoadPromises.has(entry.key)) return null;
    const lane = nextGlbLane++ % glbLoadLanes.length;
    const pending = glbLoadLanes[lane].then(() => {
      if (!disposed && renderer) return loadManifestAsset(entry);
    }).finally(() => glbLoadPromises.delete(entry.key));
    glbLoadPromises.set(entry.key, pending);
    glbLoadLanes[lane] = pending.catch(() => {});
    return pending;
  }
  function renderManifestProps() {
    for (const prop of activeProps) scene.remove(prop);
    activeProps = [];
    for (const asset of manifestProps) {
      const template = glbPropTemplates.get(asset.id);
      if (!template) continue;
      const positions = Array.isArray(asset.positions) && asset.positions.length ? asset.positions : [asset.position || [0, 0, 0]];
      // Limit optional textured trees per tier; existing instanced forest stays as baseline.
      const visiblePositions = asset.id === "kenney-tree-high"
        ? positions.slice(0, qualityProfile?.tier === "high" ? 6 : 3) : positions;
      for (let index = 0; index < visiblePositions.length; index += 1) {
        const position = visiblePositions[index];
        if (!Array.isArray(position) || position.length !== 3 || position.some(value => !Number.isFinite(Number(value)))) continue;
        const instance = template.clone(true);
        instance.position.fromArray(position.map(Number));
        if (Array.isArray(asset.rotation) && asset.rotation.length === 3) instance.rotation.set(...asset.rotation.map(Number));
        if (Number.isFinite(Number(asset.instanceScale))) instance.scale.multiplyScalar(Number(asset.instanceScale));
        instance.userData.coIAssetId = asset.id;
        scene.add(instance);
        activeProps.push(instance);
      }
    }
  }
  function renderKingdomTroops(troops = []) {
    stopArmyAnimationLoop();
    for (const instance of activeTroops) {
      instance.mixer?.stopAllAction();
      instance.mixer?.uncacheRoot(instance.root);
      scene.remove(instance.root);
      if (instance.procedural) disposeDetachedObject3D(instance.root);
    }
    activeTroops = [];
    armyMixers = [];
    const plan = planArmyFigures(troops, qualityProfile?.tier);
    const glbCounts = new Map();
    for (const entry of plan) {
      const asset = glbUnitTemplates.get(entry.type);
      const used = glbCounts.get(entry.type) || 0;
      const procedural = !asset || used >= asset.maxInstances;
      const root = procedural ? createProceduralUnit(THREE, entry.type, qualityProfile?.tier) : cloneSkinned(asset.template);
      root.position.set(entry.x, 0, entry.z);
      root.rotation.y = Math.PI;
      root.userData.coIUnitType = entry.type;
      scene.add(root);
      let mixer = null;
      if (!procedural) {
        glbCounts.set(entry.type, used + 1);
        mixer = new THREE.AnimationMixer(root);
        const clip = asset.animations.find(animation => animation.name.toLowerCase() === asset.animation.toLowerCase())
          || asset.animations.find(animation => animation.name.toLowerCase() === "static")
          || asset.animations[0];
        if (clip) {
          const action=mixer.clipAction(clip).play();
          action.time=troopAnimationPhase(activeTroops.length,clip.duration,qualityProfile?.tier==="low"||qualityProfile?.prefersReducedMotion);
          mixer.update(0);
          armyMixers.push(mixer);
        }
      }
      activeTroops.push({ root, mixer, procedural });
    }
    startArmyAnimationLoop();
    if (!animationFrame) renderer?.render(scene, camera);
  }
  async function loadOptionalGlbAssets(buildings = [], troops = []) {
    // Optional art is skipped in Data Saver mode; procedural models remain available.
    if (!qualityProfile?.loadOptionalAssets || disposed || !renderer) return Promise.resolve();
    try {
      if (!manifestLoad) {
        manifestLoad = (async () => {
          const response = await fetch("/assets/3d/manifest.json", { cache: "no-cache" });
          if (disposed || !renderer) return;
          if (!response.ok) throw new Error("Manifesto 3D indisponível.");
          const manifest = await response.json();
          if (disposed || !renderer) return;
          manifestAssets = Array.isArray(manifest.models) ? manifest.models.slice(0, 32).filter(asset => approvedManifestEntry(asset, manifest.files)) : [];
          manifestProps = Array.isArray(manifest.props) ? manifest.props.slice(0, 16).filter(asset => approvedManifestEntry(asset, manifest.files)) : [];
          manifestUnits = Array.isArray(manifest.units) ? manifest.units.slice(0, 16).filter(asset => approvedManifestEntry(asset, manifest.files)) : [];
        })().catch(error => {
          manifestLoad = null;
          throw error;
        });
      }
      await manifestLoad;
      if (disposed || !renderer) return;

      const neededTypes = new Set(
        (Array.isArray(buildings) ? buildings : [])
          .map(item => item?.building_type)
          .filter(type => typeof type === "string" && Object.hasOwn(palettes, type))
      );
      // The gate is an optional facade, never a replacement for the original keep.
      if (neededTypes.has("castle") && qualityProfile?.tier !== "low") neededTypes.add("castle_gate");
      // Optional GLBs replace only their own building type, never the original keep.
      const presentUnits = new Set(
        (Array.isArray(troops) ? troops : [])
          .filter(unit => Number(unit?.quantity) > 0)
          .map(unit => unit?.unit_type)
          .filter(type => typeof type === "string")
      );
      const queue = [
        ...manifestAssets
          .filter(asset => asset?.enabled === true && neededTypes.has(asset.type) && !glbTemplates.has(asset.type))
          .map(asset => ({ asset, kind: "building", key: `building:${asset.type}` })),
        ...manifestProps
          .filter(asset => asset?.enabled === true && typeof asset.id === "string" && !glbPropTemplates.has(asset.id))
          .map(asset => ({ asset, kind: "prop", key: `prop:${asset.id}` })),
        ...manifestUnits
          .filter(asset => asset?.enabled === true && !glbUnitTemplates.has(asset.unit_type) &&
            (asset.unit_type === "equipped_dragon" ? !!projectDragonVisual(window.__coiKingdomDragon) : presentUnits.has(asset.unit_type)))
          .map(asset => ({ asset, kind: "unit", key: `unit:${asset.unit_type}` }))
      ].filter(entry => !glbLoadPromises.has(entry.key));
      // Normal state refreshes already render the existing templates. Avoid a
      // second scene rebuild when this call has no new assets to decode.
      if (!queue.length) return;
      const pending = queue.map(scheduleManifestAsset).filter(Boolean);
      if (!pending.length) return;
      await Promise.all(pending);
      if (!disposed && renderer) {
        optionalSceneRefreshes += 1;
        renderBuildings(latestBuildings);
        renderManifestProps();
        renderEquippedDragon(window.__coiKingdomDragon);
        renderKingdomTroops(latestTroops);
      }
    } catch (error) {
      console.info("Clash of Izzy: GLB assets not ready; procedural models remain active.", error);
    }
  }
  try {
    const deviceMemory = Number(navigator.deviceMemory || 0);
    const preferredTier = readGraphicsChoice(getGraphicsStorage(window));
    automaticGraphics = preferredTier === "auto";
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const cores = Number(navigator.hardwareConcurrency || 0);
    const safeForHighGpu = connection?.saveData !== true
      && (deviceMemory === 0 || deviceMemory >= 6)
      && (cores === 0 || cores >= 6);
    const highGpuRequested = preferredTier === "high" && safeForHighGpu;
    renderer = new THREE.WebGLRenderer({
      alpha: true, antialias: highGpuRequested,
      powerPreference: highGpuRequested ? "high-performance" : "default",
      depth: true, stencil: false, preserveDrawingBuffer: false
    });
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    qualityProfile = selectKingdomQualityProfile({
      deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      viewportWidth: host.clientWidth || window.innerWidth,
      maxTextureSize: renderer.capabilities.maxTextureSize,
      saveData: connection?.saveData === true,
      preferredTier,
      prefersReducedMotion
    });
    window.__coiKingdomQuality = Object.freeze({
      tier: qualityProfile.tier,
      preference: preferredTier,
      dataSaver: !qualityProfile.loadOptionalAssets,
      prefersReducedMotion: qualityProfile.prefersReducedMotion
    });
    renderer.setPixelRatio(calculateKingdomPixelRatio({ width: host.clientWidth, height: host.clientHeight, devicePixelRatio: window.devicePixelRatio || 1, profile: qualityProfile }));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CITY_DAYLIGHT.exposure;
    renderer.shadowMap.enabled = qualityProfile.shadows;
    renderer.shadowMap.type = qualityProfile.tier === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.domElement.id = "kingdom3d";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none";
    host.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-8.2, 8.2, 6.4, -6.4, .1, 60);
    camera.position.set(10, 13, 11); camera.lookAt(0, .2, 0);
    kingdomHemisphereLight = new THREE.HemisphereLight("#e6efff", "#554638", CITY_DAYLIGHT.hemisphere);
    scene.add(kingdomHemisphereLight);
    kingdomSunLight = new THREE.DirectionalLight("#ffe3bd", CITY_DAYLIGHT.sun);
    kingdomSunLight.position.set(-7, 11, 6); kingdomSunLight.castShadow = renderer.shadowMap.enabled;
    kingdomSunLight.shadow.mapSize.set(qualityProfile.shadowMapSize, qualityProfile.shadowMapSize); kingdomSunLight.shadow.camera.left = -9; kingdomSunLight.shadow.camera.right = 9;
    kingdomSunLight.shadow.camera.top = 9; kingdomSunLight.shadow.camera.bottom = -9;
    kingdomSunLight.shadow.normalBias = .035;
    kingdomSunLight.shadow.bias = -.00015;
    scene.add(kingdomSunLight);
    window.__coiKingdomValhallaMode = setKingdomValhallaMode;
    setKingdomValhallaMode(valhallaModeActive);
    applyProceduralSurfaceMaps();
    buildGround();
    void loadScannedCityMaterials();
    if (qualityProfile.tier === "high" && !qualityProfile.prefersReducedMotion) {
      try {
        advancedShaders = new AdvancedShaders(scene, renderer, camera, THREE);
        waterFeature = advancedShaders.createRealisticWater(new THREE.Vector3(5.35, -.035, -4.15), 2.4);
        waterFeature.userData.coIOptionalFeature = "premium-water";
        scene.add(waterFeature);
      } catch (shaderError) {
        advancedShaders?.dispose();
        advancedShaders = null;
        waterFeature = null;
        console.info("Clash of Izzy: shader premium indisponível; mantendo renderização padrão.", shaderError);
      }
    }
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath("/vendor/three/examples/jsm/libs/basis/");
    ktx2.detectSupport(renderer);
    draco = new DRACOLoader();
    draco.setDecoderPath("/vendor/three/examples/jsm/libs/draco/");
    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(draco);
    gltfLoader.setKTX2Loader(ktx2);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    host.classList.add("has-3d");
    host.dataset.qualityTier = qualityProfile.tier;
    startDevelopmentStats();
    const diagnostics = () => {
      if (!renderer) return { available: false, tier: qualityProfile?.tier || "unavailable" };
      const info = renderer.info;
      return {
        available: true,
        tier: qualityProfile.tier,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        pixelRatio: renderer.getPixelRatio(),
        adaptivePixelScale: automaticGraphics ? adaptivePixelScale.scale : 1,
        maxTextureSize: renderer.capabilities.maxTextureSize,
        shadows: renderer.shadowMap.enabled,
        premiumWater: Boolean(waterFeature),
        contactShadowInstances:contactShadowBatch?.count||0,
        scannedMaterials:[...scannedSurfaceMaps.keys()].sort(),
        scannedMaterialsPending,
        cameraFocus:cameraFocusCenter?"center":"overview",
        cityArtLayout:activeModels.filter(m=>!m.userData.coISpecial).map(m=>({type:m.userData.coIType,x:m.position.x,z:m.position.z,scale:m.userData.coIArtScale})),
        surfaceTextureSize: qualityProfile.surfaceTextureSize,
        pbrMaps: qualityProfile.pbrMaps,
        loadedGlbTemplates: { buildings: glbTemplates.size, props: glbPropTemplates.size, units: glbUnitTemplates.size },
        pendingGlbLoads: glbLoadPromises.size,
        optionalSceneRefreshes,
        architecture:activeModels.filter(model=>model.userData.coIArchitecture).map(model=>({type:model.userData.coIType,design:model.userData.coIArchitecture,tier:model.userData.coIArchitectureTier||null})),
        castleGateAsset:activeModels.find(model=>model.userData.coIType==="castle")?.userData.coICastleGateAsset||null,
        importedBuildings:activeModels.filter(model=>model.userData.coIAssetId).map(model=>({type:model.userData.coIType,assetId:model.userData.coIAssetId})),
        specialLandmarks:activeModels.filter(model=>model.userData.coISpecial).map(model=>({type:model.userData.coIType,x:model.position.x,z:model.position.z})),
        troopFigures: activeTroops.map(entry => ({type:entry.root.userData.coIUnitType, procedural:entry.procedural})),
        dragonVisual: activeDragon ? {key:activeDragon.key,level:activeDragon.level,animated:canAnimateDragon(),imported:Boolean(activeDragon.figure.imported)} : null,
        animationLoop: { active: Boolean(animationFrame), ...animationFrameTiming.snapshot() }
      };
    };
    window.__coiKingdomDiagnostics = diagnostics;
    const restore2DFallback = () => {
      if (disposed) return;
      disposed = true;
      cinematicCaptureActive = false;
      if (window.__coiKingdomCinematic === cinematicApi) delete window.__coiKingdomCinematic;
      cinematicApi = null;
      stopArmyAnimationLoop();
      host.classList.remove("has-3d");
      window.dispatchEvent(new CustomEvent("coi:kingdom-2d-fallback"));
      delete host.dataset.qualityTier;
      if (window.__coiKingdomDiagnostics === diagnostics) delete window.__coiKingdomDiagnostics;
      resizeObserver?.disconnect();
      resizeObserver = null;
      sceneVisibilityObserver?.disconnect();
      sceneVisibilityObserver = null;
      if (visibilityChangeHandler) document.removeEventListener("visibilitychange", visibilityChangeHandler);
      visibilityChangeHandler = null;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (kingdomRenderHandler) window.removeEventListener("coi:kingdom-render", kingdomRenderHandler);
      if (kingdomZoomHandler) window.removeEventListener("coi:kingdom-zoom", kingdomZoomHandler);
      if (defensePreviewHandler) window.removeEventListener("coi:defense-preview", defensePreviewHandler);
      if (valhallaModeHandler) window.removeEventListener("coi:valhalla-mode", valhallaModeHandler);
      valhallaModeHandler = null;
      stopDevelopmentStats();
      disposeSceneResources();
      ktx2?.dispose();
      draco?.dispose();
      renderer?.domElement.remove();
      renderer?.dispose();
      renderer = null;
    };
    renderer.domElement.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      restore2DFallback();
      console.warn("Clash of Izzy: contexto WebGL perdido; arte 2D restaurada.");
    }, { once: true });
    kingdomRenderHandler = event => {
      const detail = event.detail || {};
      const list = detail.buildings || [];
      latestTroops = Array.isArray(detail.troops) ? detail.troops : [];
      latestDefenses = Array.isArray(detail.defenses) ? detail.defenses : [];
      latestHeroAssignments = Array.isArray(detail.heroes) ? detail.heroes : [];
      latestCastleSkinId=Number(detail.castleSkinId)||0;
      latestCastleVipLevel=Number(detail.castleVipLevel)||0;
      renderBuildings(list,latestCastleSkinId);
      renderCityDefenses(latestDefenses);
      renderAssignedHeroFigures(latestHeroAssignments);
      renderEquippedDragon(window.__coiKingdomDragon);
      renderManifestProps();
      renderKingdomTroops(latestTroops);
      if (!disposed) loadOptionalGlbAssets(list, latestTroops);
    };
    window.addEventListener("coi:kingdom-render", kingdomRenderHandler);
    kingdomZoomHandler = event => {
      if (disposed || cinematicCaptureActive || !renderer || !scene || !camera) return;
      const action = event.detail?.action;
      if (!["in", "out", "reset", "center"].includes(action)) return;
      if(action==="center"||action==="reset")cameraFocusCenter=action==="center";
      cameraZoomFactor = action === "reset" || action === "center" ? 1
        : Math.max(0.7, Math.min(1.6, Number((cameraZoomFactor + (action === "in" ? 0.2 : -0.2)).toFixed(2))));
      const visible = latestBuildings.slice(0, Math.min(16, qualityProfile?.maxBuildings || 9));
      if (!visible.length) return;
      frameCityBuildings(visible);
      renderer.render(scene, camera);
      publishBuildingHitTargets(visible);
    };
    window.addEventListener("coi:kingdom-zoom", kingdomZoomHandler);
    defensePreviewHandler=event=>updateDefensePreview(event.detail||{});
    window.addEventListener("coi:defense-preview",defensePreviewHandler);
    if (Array.isArray(window.__coiKingdomBuildings)) {
      latestTroops = Array.isArray(window.__coiKingdomTroops) ? window.__coiKingdomTroops : [];
      latestDefenses = Array.isArray(window.__coiKingdomDefenses) ? window.__coiKingdomDefenses : [];
      latestHeroAssignments = Array.isArray(window.__coiKingdomHeroAssignments) ? window.__coiKingdomHeroAssignments : [];
      latestCastleSkinId=Number(window.__coiKingdomCastleSkin)||0;
      latestCastleVipLevel=Number(window.__coiKingdomCastleVipLevel)||0;
      renderBuildings(window.__coiKingdomBuildings,latestCastleSkinId);
      renderCityDefenses(latestDefenses);
      renderAssignedHeroFigures(latestHeroAssignments);
      renderEquippedDragon(window.__coiKingdomDragon);
      renderManifestProps();
      renderKingdomTroops(latestTroops);
      loadOptionalGlbAssets(window.__coiKingdomBuildings, latestTroops);
    }
    const resize = () => {
      if (cinematicCaptureActive || !renderer || !host.clientWidth || !host.clientHeight) return;
      const aspect = host.clientWidth / host.clientHeight;
      const viewHeight = 12.8, viewWidth = viewHeight * aspect;
      camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
      camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
      // Refit after orientation/viewport changes; otherwise portrait mode can
      // clip outer buildings even when the initial landscape frame was valid.
      const visibleBuildings = latestBuildings.slice(0, Math.min(16, qualityProfile?.maxBuildings || 9));
      if (visibleBuildings.length) frameCityBuildings(visibleBuildings);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(calculateKingdomPixelRatio({ width: host.clientWidth, height: host.clientHeight, devicePixelRatio: window.devicePixelRatio || 1, profile: qualityProfile }) * (automaticGraphics ? adaptivePixelScale.scale : 1));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.render(scene, camera);
      publishBuildingHitTargets(latestBuildings);
    };
    cinematicApi = Object.freeze({
      getContext() {
        if (disposed || !renderer || !scene || !camera) return null;
        return { scene, camera, renderer };
      },
      setCaptureActive(active) {
        if (disposed || !renderer) return false;
        cinematicCaptureActive = Boolean(active);
        if (cinematicCaptureActive) {
          stopArmyAnimationLoop();
        } else {
          resize();
          refreshArmyAnimationVisibility();
        }
        return true;
      },
      setCaptureViewport(aspect) {
        if (disposed || !renderer || !camera || !Number.isFinite(aspect) || aspect <= 0) return false;
        if (camera.isOrthographicCamera) {
          const halfHeight = Math.max(0.1, (camera.top - camera.bottom) / 2);
          camera.left = -halfHeight * aspect;
          camera.right = halfHeight * aspect;
        } else if (camera.isPerspectiveCamera) {
          camera.aspect = aspect;
        }
        camera.updateProjectionMatrix();
        return true;
      },
      renderFrame(delta = 0) {
        if (disposed || !renderer || !scene || !camera) {
          throw new Error("A visualização 3D do reino deixou de estar disponível.");
        }
        const safeDelta = Math.min(0.05, Math.max(0, Number(delta) || 0));
        for (const mixer of armyMixers) mixer.update(safeDelta);
        advancedShaders?.update(safeDelta);
        renderer.render(scene, camera);
        return true;
      },
      setValhallaMode: setKingdomValhallaMode,
      getValhallaMode: () => valhallaModeActive
    });
    window.__coiKingdomCinematic = cinematicApi;
    window.dispatchEvent(new CustomEvent("coi:kingdom-cinematic-ready"));

    if ("ResizeObserver" in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); }
    else { resizeHandler = resize; window.addEventListener("resize", resizeHandler, { passive: true }); }
    visibilityChangeHandler = refreshArmyAnimationVisibility;
    document.addEventListener("visibilitychange", visibilityChangeHandler);
    if ("IntersectionObserver" in window) {
      sceneVisibilityObserver = new IntersectionObserver(entries => {
        const entry = entries[entries.length - 1];
        sceneInViewport = entry?.isIntersecting === true;
        refreshArmyAnimationVisibility();
      }, { threshold: 0.01 });
      sceneVisibilityObserver.observe(host);
    }
    resize();
    window.dispatchEvent(new CustomEvent("coi:kingdom-3d-ready"));
    if (advancedShaders) startArmyAnimationLoop();
  } catch (error) {
    // Initialization can fail after GPU resources or listeners were already created.
    // Run the same deterministic teardown used by the context-loss fallback.
    disposed = true;
    stopArmyAnimationLoop();
    resizeObserver?.disconnect();
    resizeObserver = null;
    sceneVisibilityObserver?.disconnect();
    sceneVisibilityObserver = null;
    if (visibilityChangeHandler) document.removeEventListener("visibilitychange", visibilityChangeHandler);
    visibilityChangeHandler = null;
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    if (kingdomRenderHandler) window.removeEventListener("coi:kingdom-render", kingdomRenderHandler);
    if (kingdomZoomHandler) window.removeEventListener("coi:kingdom-zoom", kingdomZoomHandler);
    if (defensePreviewHandler) window.removeEventListener("coi:defense-preview", defensePreviewHandler);
    if (valhallaModeHandler) window.removeEventListener("coi:valhalla-mode", valhallaModeHandler);
    valhallaModeHandler = null;
    stopDevelopmentStats();
    disposeSceneResources();
    ktx2?.dispose();
      draco?.dispose();
    renderer?.domElement.remove();
    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
    host.classList.remove("has-3d");
      window.dispatchEvent(new CustomEvent("coi:kingdom-2d-fallback"));
    delete host.dataset.qualityTier;
    delete window.__coiKingdomDiagnostics;
    if (window.__coiKingdomCinematic === cinematicApi) delete window.__coiKingdomCinematic;
    cinematicApi = null;
    cinematicCaptureActive = false;
    console.warn("Clash of Izzy: WebGL indisponível; mantendo arte procedural 2D.", error);
  }
}
