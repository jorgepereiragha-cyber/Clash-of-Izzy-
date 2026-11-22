/* Progressive Three.js kingdom renderer. Canvas art remains as offline/WebGL fallback. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { selectKingdomQualityProfile, calculateKingdomPixelRatio, createFrameTimingSampler, createAdaptivePixelScaleController } from "./kingdom-quality.js";
import { readGraphicsChoice } from "./kingdom-visual-preferences.js";
import { derivePbrTextureData } from "./kingdom-materials.js";
import { AdvancedShaders } from "./advanced-shaders.js";

const host = document.getElementById("city");
if (host && "WebGLRenderingContext" in window) {
  let renderer, scene, camera, resizeObserver, sceneVisibilityObserver, visibilityChangeHandler, ktx2, draco, gltfLoader, resizeHandler, qualityProfile;
  let latestBuildings = [];
  let latestTroops = [];
  let latestCastleSkinId = 0;
  let activeModels = [];
  let activeProps = [];
  let activeTroops = [];
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
  let manifestAssets = [];
  let manifestProps = [];
  let manifestUnits = [];
  let manifestLoad = null;
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
  let disposed = false;
  let kingdomRenderHandler = null;
  let cinematicCaptureActive = false;
  let cinematicApi = null;
  let valhallaModeActive = window.__COI_VALHALLA_ACTIVE === true;
  let valhallaAuroraLight = null;
  let kingdomHemisphereLight = null;
  let kingdomSunLight = null;
  let advancedShaders = null;
  let waterFeature = null;

  function setKingdomValhallaMode(active) {
    valhallaModeActive = Boolean(active);
    if (!scene) return;
    scene.background = valhallaModeActive ? new THREE.Color(0x0a0510) : null;
    scene.fog = valhallaModeActive ? new THREE.FogExp2(0x1a0f25, 0.035) : null;
    if (kingdomHemisphereLight) kingdomHemisphereLight.intensity = valhallaModeActive ? 0.95 : 2.05;
    if (kingdomSunLight) kingdomSunLight.intensity = valhallaModeActive ? 1.15 : 2.4;
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
  window.addEventListener("coi:valhalla-mode", event => {
    setKingdomValhallaMode(event.detail?.active === true);
  });

  // Explicitly release GPU-backed resources on WebGL context loss. Three.js
  // resources are not reclaimed by the browser's garbage collector.
  function disposeObject3D(root, resources) {
    if (!root) return;
    root.traverse(node => {
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
    for (const geometry of resources.geometries) geometry.dispose();
    for (const texture of resources.textures) texture.dispose();
    for (const mat of resources.materials) mat.dispose();
    for (const bitmap of resources.imageBitmaps) bitmap.close();
  }
  function disposeDetachedObject3D(root) {
    const resources = { geometries: new Set(), materials: new Set(), textures: new Set(), imageBitmaps: new Set() };
    disposeObject3D(root, resources);
    disposeResourceSet(resources);
  }
  function disposeSceneResources() {
    const resources = { geometries: new Set(), materials: new Set(), textures: new Set(), imageBitmaps: new Set() };
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
    disposeResourceSet(resources);
    scene?.clear();
    surfaceTextureCache.clear();
    glbTemplates.clear();
    glbPropTemplates.clear();
    glbUnitTemplates.clear();
    activeModels = [];
    activeProps = [];
    activeTroops = [];
    armyMixers = [];
    manifestAssets = [];
    manifestProps = [];
    manifestUnits = [];
    stopArmyAnimationLoop();
    advancedShaders?.dispose();
    advancedShaders = null;
    waterFeature = null;
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
      for (let y = 0; y < 128; y += 22) {
        const offset = (Math.floor(y / 22) % 2) * 16;
        for (let x = -16; x < 144; x += 32) {
          ctx.strokeStyle = "rgba(35,39,37,.22)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + offset + 1, y + 1, 30, 20);
        }
      }
    } else if (kind === "roof") {
      for (let y = 0; y < 128; y += 12) for (let x = 0; x < 128; x += 16) {
        ctx.fillStyle = rand() > .5 ? "rgba(210,225,245,.20)" : "rgba(8,18,34,.22)";
        ctx.fillRect(x + ((y / 12) % 2) * 8, y, 14, 9);
      }
    } else if (kind === "grass") {
      for (let i = 0; i < 700; i++) {
        ctx.strokeStyle = rand() > .5 ? "rgba(25,65,28,.20)" : "rgba(210,220,135,.16)";
        ctx.lineWidth = 1;
        const x = rand() * 128, y = rand() * 128;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand() * 3, y - 2 - rand() * 5); ctx.stroke();
      }
    } else if (kind === "road") {
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
    const repeat = kind === "grass" ? 9 : 3;
    const repeatY = kind === "grass" ? 7 : 3;
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
    const maps = getSurfaceMaps(base, kind, seed);
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      ...maps,
      roughness: kind === "roof" ? .86 : .96,
      metalness: 0.01
    });
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
    const count = 18;
    const trunkGeometry = new THREE.CylinderGeometry(.09, .13, .65, 5);
    const crownGeometry = new THREE.ConeGeometry(.62, 1.45, 6);
    const crownTopGeometry = new THREE.ConeGeometry(.43, 1.05, 6);
    const trunks = new THREE.InstancedMesh(trunkGeometry, mats.wood, count);
    const crowns = new THREE.InstancedMesh(crownGeometry, mats.leaf, count);
    const crownTops = new THREE.InstancedMesh(crownTopGeometry, mats.leafLight, count);
    trunks.castShadow = crowns.castShadow = crownTops.castShadow = true;
    trunks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let added = 0;
    for (let i = 0; i < count; i++) {
      const x = ((i * 37) % 125) / 10 - 6.2;
      const z = ((i * 23) % 95) / 10 - 4.7;
      if (Math.abs(x) < 5 && Math.abs(z) < 4) continue;
      const scale = .72 + (i % 4) * .12;
      dummy.position.set(x, .32 * scale, z);
      dummy.scale.setScalar(scale); dummy.updateMatrix(); trunks.setMatrixAt(added, dummy.matrix);
      dummy.position.set(x, 1.22 * scale, z);
      dummy.scale.setScalar(scale); dummy.updateMatrix(); crowns.setMatrixAt(added, dummy.matrix);
      dummy.position.set(x, 1.72 * scale, z);
      dummy.scale.setScalar(scale); dummy.updateMatrix(); crownTops.setMatrixAt(added, dummy.matrix);
      added++;
    }
    for (const mesh of [trunks, crowns, crownTops]) {
      mesh.count = added;
      mesh.instanceMatrix.needsUpdate = true;
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
    const height = 1.0 + Math.min(30, Math.max(1, Number(level) || 1)) * .035;

    // Shared architectural language: visible stone footing, timber eaves and a
    // readable roof silhouette, while each building keeps its own landmark.
    box(group, 1.56, .14, 1.32, mats.darkStone, 0, .05, 0);
    box(group, 1.48, height, 1.22, wall, 0, height / 2, 0);
    box(group, 1.55, .09, 1.29, mats.wood, 0, height + .035, 0);
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.02, .88, 4), roof);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.position.y = height + .48;
    roofMesh.castShadow = true;
    group.add(roofMesh);

    // Warm emissive windows stay legible in the isometric view without adding
    // real-time point lights to every building.
    box(group, .23, .48, .04, mats.wood, 0, .24, .635);
    for (const wx of [-.45, .45]) {
      box(group, .18, .22, .045, mats.window, wx, height * .63, .635);
      box(group, .035, .25, .055, mats.wood, wx, height * .63, .66);
      box(group, .2, .035, .055, mats.wood, wx, height * .63, .66);
    }

    if (type === "castle") {
      // Four corner keeps, crenellated parapet, royal standards and a heraldic seal.
      for (const tx of [-.56, .56]) for (const tz of [-.43, .43]) {
        box(group, .36, 1.5, .36, castleStone, tx, .75, tz);
        const turret = new THREE.Mesh(new THREE.ConeGeometry(.27, .54, 4), castleRoof);
        turret.position.set(tx, 1.78, tz);
        turret.rotation.y = Math.PI / 4;
        turret.castShadow = true;
        group.add(turret);
        box(group, .4, .09, .4, castleAccent, tx, 1.51, tz);
      }
      for (let i = -2; i <= 2; i++) {
        box(group, .18, .22, .18, castleStone, i * .24, height + .16, -.58);
        box(group, .18, .22, .18, castleStone, i * .24, height + .16, .58);
      }
      for (const tx of [-.56, .56]) {
        box(group, .045, .52, .045, castleAccent, tx, 1.92, .49);
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(.34, .42), new THREE.MeshStandardMaterial({
          color: castleSkin ? castleSkin.banner : "#E7BD68", roughness: .82, side: THREE.DoubleSide
        }));
        banner.position.set(tx + .18, 1.86, .515);
        banner.castShadow = true;
        group.add(banner);
      }
      const seal = new THREE.Mesh(new THREE.CircleGeometry(.2, 8), castleAccent);
      seal.position.set(0, 1.02, .66);
      seal.castShadow = true;
      group.add(seal);
      const sealCore = new THREE.Mesh(new THREE.CircleGeometry(.12, 8), material(castleSkin ? castleSkin.seal : "#24476B", .58));
      sealCore.position.set(0, 1.02, .668);
      group.add(sealCore);
      box(group, .62, .24, .24, castleAccent, 0, height + .08, .76);
    } else if (type === "watchtower") {
      box(group, .16, .95, .16, mats.wood, 0, height + .42, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(.48, .28), material("#A9433B"));
      flag.position.set(.25, height + .78, 0);
      flag.rotation.y = Math.PI / 2;
      group.add(flag);
      box(group, .48, .12, .48, mats.gold, 0, height + .82, 0);
    } else if (type === "farm") {
      // Crop beds with raised furrows and golden grain heads.
      for (let i = -1; i <= 1; i++) {
        const row = box(group, .17, .045, .96, material("#9A682D"), i * .42, .06, -.82);
        row.rotation.y = .08;
        for (let j = 0; j < 3; j++) {
          addCylinder(group, .018, .025, .22, material("#D6BD65"), i * .42, .2, -.48 - j * .22, 5);
        }
      }
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
    } else if (type === "quarry") {
      for (const [sx, sz, scale] of [[-.48, -.72, .22], [0, -.78, .3], [.48, -.7, .2]]) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), mats.darkStone);
        rock.position.set(sx, scale * .72, sz);
        rock.rotation.set(.2, sx * 2, .35);
        rock.castShadow = true;
        group.add(rock);
      }
      addCylinder(group, .035, .035, .7, mats.gold, .55, .48, .72, 6);
    } else if (type === "lumber_mill") {
      for (let i = 0; i < 4; i++) {
        const log = addCylinder(group, .11, .11, .82, mats.wood, -.52 + i * .28, .2, -.76, 7);
        log.rotation.z = Math.PI / 2;
      }
      box(group, .12, .82, .12, mats.darkStone, .58, .48, .65);
      const saw = new THREE.Mesh(new THREE.TorusGeometry(.22, .045, 6, 12), mats.gold);
      saw.position.set(.58, .76, .73);
      group.add(saw);
    } else if (type === "iron_mine") {
      for (const [sx, sz, scale] of [[-.4, -.72, .2], [0, -.8, .27], [.42, -.72, .18]]) {
        const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 0), material("#8798A5", .32));
        ore.position.set(sx, scale * .72, sz);
        ore.castShadow = true;
        group.add(ore);
      }
      box(group, .62, .08, .12, mats.wood, 0, .32, .75);
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
  function buildGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 11), mats.grass);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.08; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(14, 14, "#91a36d", "#91a36d");
    grid.position.y = -.055; grid.material.transparent = true; grid.material.opacity = .12; scene.add(grid);
    // A winding stone road crosses the settlement.
    const points = [
      new THREE.Vector3(-6.4, .015, 4.2), new THREE.Vector3(-3.8, .015, 3.3),
      new THREE.Vector3(-1.5, .015, 2.5), new THREE.Vector3(.5, .015, .9),
      new THREE.Vector3(2.8, .015, -.8), new THREE.Vector3(5.8, .015, -3.7)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const road = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, .32, 6, false), mats.road);
    road.receiveShadow = true; scene.add(road);
    const verge = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, .38, 6, false), mats.roadEdge);
    verge.position.y = -.025; scene.add(verge);
    // Forest is batched into three instanced draw calls instead of one per tree part.
    addForestInstances();
  }
  function publishBuildingHitTargets(buildings = latestBuildings) {
    if (!host || !camera || !renderer || disposed) return;
    camera.updateMatrixWorld(true);
    const list = (Array.isArray(buildings) ? buildings : []).slice(0, Math.min(9, qualityProfile?.maxBuildings || 9));
    const positions = list.map((building, index) => {
      const col = index % 3, row = Math.floor(index / 3);
      const x = (col - 1) * 4.15, z = (row - 1) * 3.15;
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
      scene.remove(item);
      if (item.userData.coIProcedural) item.traverse(node => {
        if (!node.isMesh) return;
        node.geometry?.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(mat => { if (mat && !sharedMaterials.has(mat)) mat.dispose(); });
      });
    }
    activeModels = [];
    // Keep deterministic world-space building anchors. HTML hit targets are
    // projected into screen coordinates from this same camera below.
    const list = (Array.isArray(buildings) ? buildings : []).slice(0, Math.min(9, qualityProfile?.maxBuildings || 9));
    list.forEach((b, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = (col - 1) * 4.15, z = (row - 1) * 3.15;
      const template = glbTemplates.get(b.building_type);
      const group = template ? template.clone(true) : createBuilding(b.building_type, b.level, x, z, latestCastleSkinId);
      group.position.set(x, 0, z); group.userData.coIType = b.building_type;
      group.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      scene.add(group);
      activeModels.push(group);
    });
    renderer.render(scene, camera);
    publishBuildingHitTargets(list);
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
    if (!canRunArmyAnimation() || !renderer || !scene || !camera || (!armyMixers.length && !advancedShaders)) {
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
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(renderArmyFrame);
  }
  function startArmyAnimationLoop() {
    if (!canRunArmyAnimation() || animationFrame || (!armyMixers.length && !advancedShaders) || qualityProfile?.tier === "low" || qualityProfile?.prefersReducedMotion) return;
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
    const { asset, kind, key } = entry;
    try {
      const assetUrl = safeAssetUrl(asset);
      const loadPromise = gltfLoader.loadAsync(assetUrl);
      glbLoadPromises.set(key, loadPromise);
      const gltf = await loadPromise;
      if (disposed || !renderer) {
        disposeDetachedObject3D(gltf.scene);
        return;
      }
      const template = normalizeGlbTemplate(gltf, asset);
      if (kind === "building") glbTemplates.set(asset.type, template);
      else if (kind === "prop") glbPropTemplates.set(asset.id, template);
      else if (kind === "unit") glbUnitTemplates.set(asset.unit_type, {
        template,
        animations: Array.isArray(gltf.animations) ? gltf.animations : [],
        animation: asset.animation || "idle",
        maxInstances: Math.max(1, Math.min(8, Number(asset.maxInstances) || 4))
      });
    } catch (assetError) {
      console.info(`Clash of Izzy: GLB ${asset.id || asset.type || asset.unit_type} indisponível; mantendo o fallback procedural.`, assetError);
    } finally {
      glbLoadPromises.delete(key);
    }
  }
  function renderManifestProps() {
    for (const prop of activeProps) scene.remove(prop);
    activeProps = [];
    for (const asset of manifestProps) {
      const template = glbPropTemplates.get(asset.id);
      if (!template) continue;
      const positions = Array.isArray(asset.positions) && asset.positions.length ? asset.positions : [asset.position || [0, 0, 0]];
      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index];
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
      instance.mixer.stopAllAction();
      instance.mixer.uncacheRoot(instance.root);
      scene.remove(instance.root);
    }
    activeTroops = [];
    armyMixers = [];
    const archerCount = (Array.isArray(troops) ? troops : [])
      .filter(unit => unit?.unit_type === "archer")
      .reduce((sum, unit) => sum + Math.max(0, Number(unit.quantity) || 0), 0);
    const asset = glbUnitTemplates.get("archer");
    if (!asset || archerCount <= 0) {
      renderer?.render(scene, camera);
      return;
    }
    const tierLimit = qualityProfile?.tier === "low" ? 2 : qualityProfile?.tier === "high" ? 5 : 3;
    const count = Math.min(tierLimit, asset.maxInstances, Math.max(1, Math.ceil(Math.log2(archerCount + 1))));
    const spacing = .72;
    for (let index = 0; index < count; index += 1) {
      const root = cloneSkinned(asset.template);
      root.position.set((index - (count - 1) / 2) * spacing, 0, 4.25 + (index % 2) * .22);
      root.rotation.y = Math.PI;
      root.userData.coIUnitType = "archer";
      scene.add(root);
      const mixer = new THREE.AnimationMixer(root);
      const clip = asset.animations.find(animation => animation.name.toLowerCase() === asset.animation.toLowerCase())
        || asset.animations.find(animation => animation.name.toLowerCase() === "static")
        || asset.animations[0];
      if (clip) mixer.clipAction(clip).play();
      activeTroops.push({ root, mixer });
      armyMixers.push(mixer);
      if (qualityProfile?.tier === "low" || qualityProfile?.prefersReducedMotion) mixer.update(0);
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
          manifestAssets = Array.isArray(manifest.models) ? manifest.models.slice(0, 32) : [];
          manifestProps = Array.isArray(manifest.props) ? manifest.props.slice(0, 16) : [];
          manifestUnits = Array.isArray(manifest.units) ? manifest.units.slice(0, 8) : [];
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
          .filter(asset => asset?.enabled === true && presentUnits.has(asset.unit_type) && !glbUnitTemplates.has(asset.unit_type))
          .map(asset => ({ asset, kind: "unit", key: `unit:${asset.unit_type}` }))
      ].filter(entry => !glbLoadPromises.has(entry.key));
      let cursor = 0;
      const worker = async () => {
        while (!disposed && cursor < queue.length) {
          await loadManifestAsset(queue[cursor++]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
      if (!disposed && renderer) {
        renderBuildings(latestBuildings);
        renderManifestProps();
        renderKingdomTroops(latestTroops);
      }
    } catch (error) {
      console.info("Clash of Izzy: GLB assets not ready; procedural models remain active.", error);
    }
  }
  try {
    const deviceMemory = Number(navigator.deviceMemory || 0);
    const preferredTier = readGraphicsChoice(window.localStorage);
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
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = qualityProfile.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.id = "kingdom3d";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none";
    host.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-8.2, 8.2, 6.4, -6.4, .1, 60);
    camera.position.set(10, 13, 11); camera.lookAt(0, .2, 0);
    kingdomHemisphereLight = new THREE.HemisphereLight("#e6f0d6", "#43513b", 2.05);
    scene.add(kingdomHemisphereLight);
    kingdomSunLight = new THREE.DirectionalLight("#ffe0a4", 2.4);
    kingdomSunLight.position.set(-5, 10, 6); kingdomSunLight.castShadow = renderer.shadowMap.enabled;
    kingdomSunLight.shadow.mapSize.set(qualityProfile.shadowMapSize, qualityProfile.shadowMapSize); kingdomSunLight.shadow.camera.left = -9; kingdomSunLight.shadow.camera.right = 9;
    kingdomSunLight.shadow.camera.top = 9; kingdomSunLight.shadow.camera.bottom = -9; scene.add(kingdomSunLight);
    window.__coiKingdomValhallaMode = setKingdomValhallaMode;
    setKingdomValhallaMode(valhallaModeActive);
    applyProceduralSurfaceMaps();
    buildGround();
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
        surfaceTextureSize: qualityProfile.surfaceTextureSize,
        pbrMaps: qualityProfile.pbrMaps,
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
      latestCastleSkinId=Number(detail.castleSkinId)||0;
      renderBuildings(list,latestCastleSkinId);
      renderManifestProps();
      renderKingdomTroops(latestTroops);
      if (!disposed) loadOptionalGlbAssets(list, latestTroops);
    };
    window.addEventListener("coi:kingdom-render", kingdomRenderHandler);
    if (Array.isArray(window.__coiKingdomBuildings)) {
      latestTroops = Array.isArray(window.__coiKingdomTroops) ? window.__coiKingdomTroops : [];
      latestCastleSkinId=Number(window.__coiKingdomCastleSkin)||0;
      renderBuildings(window.__coiKingdomBuildings,latestCastleSkinId);
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
