/* Progressive Three.js kingdom renderer. Canvas art remains as offline/WebGL fallback. */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/loaders/KTX2Loader.js";
import { selectKingdomQualityProfile, calculateKingdomPixelRatio } from "./kingdom-quality.js";

const host = document.getElementById("city");
if (host && "WebGLRenderingContext" in window) {
  let renderer, scene, camera, resizeObserver, ktx2, gltfLoader, resizeHandler, qualityProfile;
  let latestBuildings = [];
  let activeModels = [];
  const glbTemplates = new Map();
  let manifestLoad = null;
  const material = (color, roughness = 0.92) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
  const mats = {
    grass: material("#577a49"), grassLight: material("#78945a"),
    road: material("#b8a57d"), roadEdge: material("#76664c"),
    stone: material("#9c9b8b"), darkStone: material("#555d5c"),
    wood: material("#745039"), roof: material("#8b4636"),
    gold: material("#d5b16b", 0.55), window: new THREE.MeshBasicMaterial({ color: "#f4d68b" }),
    leaf: material("#3d7043"), leafLight: material("#628a4d")
  };
  const palettes = {
    castle: ["#a69a80", "#a78a54"], barracks: ["#92704f", "#874b3e"],
    farm: ["#9b9a62", "#9c7542"], quarry: ["#929a9a", "#58636a"],
    lumber_mill: ["#795a3e", "#744632"], iron_mine: ["#75818a", "#4b5962"],
    market: ["#a78b61", "#a44f3f"], academy: ["#8c8ba2", "#514c77"],
    wall: ["#a1a69c", "#6e7774"], hospital: ["#c9c2aa", "#a65a50"],
    watchtower: ["#9c927b", "#74543d"], stable: ["#98734e", "#76503a"],
    archery_range: ["#a49a6c", "#6b7e49"], siege_workshop: ["#827466", "#625044"],
    embassy: ["#b0a18a", "#526e82"], warehouse: ["#9b886a", "#70543d"]
  };
  const sharedMaterials = new Set(Object.values(mats));
  const surfaceTextureCache = new Map();
  // Small, deterministic, tileable procedural albedo maps add material identity
  // without shipping large image files or creating per-building texture copies.
  function makeSurfaceTexture(base, kind, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d", { alpha: false });
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
        ctx.fillStyle = rand() > .5 ? "rgba(255,210,170,.12)" : "rgba(35,15,12,.14)";
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
    for (let i = 0; i < 1200; i++) {
      const alpha = .025 + rand() * .07;
      ctx.fillStyle = rand() > .5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(rand() * 128, rand() * 128, 1 + rand() * 2, 1 + rand() * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === "grass" ? 9 : 3, kind === "grass" ? 7 : 3);
    texture.anisotropy = Math.min(qualityProfile?.anisotropy || 2, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    texture.needsUpdate = true;
    return texture;
  }
  function getSurfaceTexture(base, kind, seed) {
    const key = `${base}:${kind}:${seed}`;
    if (!surfaceTextureCache.has(key)) surfaceTextureCache.set(key, makeSurfaceTexture(base, kind, seed));
    return surfaceTextureCache.get(key);
  }
  function surfaceMaterial(base, kind, seed) {
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: getSurfaceTexture(base, kind, seed),
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
      [mats.roof, "#8b4636", "roof", 47]
    ];
    for (const [mat, base, kind, seed] of maps) {
      mat.map = makeSurfaceTexture(base, kind, seed);
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
  function createBuilding(type, level, x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.userData.coIType = type; group.userData.coIProcedural = true;
    const colors = palettes[type] || palettes.warehouse;
    const seed = [...String(type)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const wall = surfaceMaterial(colors[0], "stone", seed);
    const roof = surfaceMaterial(colors[1], "roof", seed + 101);
    const height = 1.0 + Math.min(30, Math.max(1, Number(level) || 1)) * .035;
    box(group, 1.42, height, 1.18, wall, 0, height / 2, 0);
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(.98, .88, 4), roof);
    roofMesh.rotation.y = Math.PI / 4; roofMesh.position.y = height + .42; roofMesh.castShadow = true; group.add(roofMesh);
    // Front door and warm windows improve readability at the isometric camera angle.
    box(group, .23, .48, .035, mats.wood, 0, .24, .61);
    for (const wx of [-.43, .43]) box(group, .16, .2, .04, mats.window, wx, height * .63, .61);
    if (type === "castle") {
      for (const tx of [-.56, .56]) for (const tz of [-.43, .43]) {
        box(group, .34, 1.48, .34, mats.stone, tx, .74, tz);
        const turret = new THREE.Mesh(new THREE.ConeGeometry(.25, .5, 4), mats.roof);
        turret.position.set(tx, 1.72, tz); turret.rotation.y = Math.PI / 4; turret.castShadow = true; group.add(turret);
        box(group, .38, .09, .38, mats.gold, tx, 1.47, tz);
      }
      // Small gatehouse makes the keep distinct from ordinary buildings.
      box(group, .58, .22, .24, mats.gold, 0, height + .08, .72);
    } else if (type === "watchtower") {
      box(group, .16, .95, .16, mats.wood, 0, height + .42, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(.48, .28), material("#b64b3e"));
      flag.position.set(.25, height + .78, 0); flag.rotation.y = Math.PI / 2; group.add(flag);
    } else if (type === "farm") {
      for (let i = -1; i <= 1; i++) {
        const row = box(group, .16, .04, .9, material("#b4a45d"), i * .42, .05, -.82);
        row.rotation.y = .08;
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
  function renderBuildings(buildings) {
    latestBuildings = Array.isArray(buildings) ? buildings : [];
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
    const list = (Array.isArray(buildings) ? buildings : []).slice(0, qualityProfile?.maxBuildings || 16);
    list.forEach((b, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = (col - 1.5) * 2.9, z = (row - 1.5) * 2.3;
      const template = glbTemplates.get(b.building_type);
      const group = template ? template.clone(true) : createBuilding(b.building_type, b.level, x, z);
      group.position.set(x, 0, z); group.userData.coIType = b.building_type;
      group.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      scene.add(group);
      activeModels.push(group);
    });
    renderer.render(scene, camera);
  }
  async function loadOptionalGlbAssets(buildings = []) {
    if (manifestLoad) return manifestLoad;
    manifestLoad = (async () => {
      try {
        const response = await fetch("/assets/3d/manifest.json", { cache: "no-cache" });
        if (!response.ok) return;
        const manifest = await response.json();
        for (const asset of (Array.isArray(manifest.models) ? manifest.models.slice(0, 32) : [])) {
          if (asset.enabled !== true || typeof asset.type !== "string" || !Object.hasOwn(palettes, asset.type) || typeof asset.src !== "string") continue;
          try {
            const assetUrl = new URL(asset.src, window.location.origin);
            if (assetUrl.origin !== window.location.origin || !assetUrl.pathname.startsWith("/assets/3d/") || !assetUrl.pathname.toLowerCase().endsWith(".glb")) continue;
            const gltf = await gltfLoader.loadAsync(assetUrl.href);
            const template = gltf.scene;
            template.traverse(node => {
              if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
            });
            glbTemplates.set(asset.type, template);
          } catch (assetError) {
            console.info(`Clash of Izzy: GLB ${asset.type} indisponível; mantendo modelo procedural.`, assetError);
          }
        }
        if (glbTemplates.size) renderBuildings(latestBuildings);
      } catch (error) {
        console.info("Clash of Izzy: GLB asset not ready; procedural 3D models remain active.", error);
      }
    })();
    return manifestLoad;
  }
  try {
    const deviceMemory = Number(navigator.deviceMemory || 0);
    renderer = new THREE.WebGLRenderer({
      alpha: true, antialias: false, powerPreference: "low-power",
      depth: true, stencil: false, preserveDrawingBuffer: false
    });
    qualityProfile = selectKingdomQualityProfile({
      deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      viewportWidth: host.clientWidth,
      maxTextureSize: renderer.capabilities.maxTextureSize
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
    scene.add(new THREE.HemisphereLight("#e6f0d6", "#43513b", 2.05));
    const sun = new THREE.DirectionalLight("#ffe0a4", 2.4);
    sun.position.set(-5, 10, 6); sun.castShadow = renderer.shadowMap.enabled;
    sun.shadow.mapSize.set(qualityProfile.shadowMapSize, qualityProfile.shadowMapSize); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; scene.add(sun);
    applyProceduralSurfaceMaps();
    buildGround();
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/basis/");
    ktx2.detectSupport(renderer);
    gltfLoader = new GLTFLoader(); gltfLoader.setKTX2Loader(ktx2);
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
        maxTextureSize: renderer.capabilities.maxTextureSize,
        shadows: renderer.shadowMap.enabled
      };
    };
    window.__coiKingdomDiagnostics = diagnostics;
    const restore2DFallback = () => {
      host.classList.remove("has-3d");
      delete host.dataset.qualityTier;
      if (window.__coiKingdomDiagnostics === diagnostics) delete window.__coiKingdomDiagnostics;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      renderer?.domElement.remove();
      renderer?.dispose();
      renderer = null;
    };
    renderer.domElement.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      restore2DFallback();
      console.warn("Clash of Izzy: contexto WebGL perdido; arte 2D restaurada.");
    }, { once: true });
    window.addEventListener("coi:kingdom-render", event => { const list = event.detail?.buildings || []; renderBuildings(list); loadOptionalGlbAssets(list); });
    if (Array.isArray(window.__coiKingdomBuildings)) { renderBuildings(window.__coiKingdomBuildings); loadOptionalGlbAssets(window.__coiKingdomBuildings); }
    const resize = () => {
      if (!renderer || !host.clientWidth || !host.clientHeight) return;
      const aspect = host.clientWidth / host.clientHeight;
      const viewHeight = 12.8, viewWidth = viewHeight * aspect;
      camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
      camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(calculateKingdomPixelRatio({ width: host.clientWidth, height: host.clientHeight, devicePixelRatio: window.devicePixelRatio || 1, profile: qualityProfile }));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.render(scene, camera);
    };
    if ("ResizeObserver" in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); }
    else { resizeHandler = resize; window.addEventListener("resize", resizeHandler, { passive: true }); }
    resize();
  } catch (error) {
    console.warn("Clash of Izzy: WebGL indisponível; mantendo arte procedural 2D.", error);
    host.classList.remove("has-3d");
    renderer?.dispose();
    renderer?.domElement.remove();
  }
}
