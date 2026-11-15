/* Progressive Three.js kingdom renderer. Canvas art remains as offline/WebGL fallback. */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/loaders/KTX2Loader.js";

const host = document.getElementById("city");
if (host && "WebGLRenderingContext" in window) {
  let renderer, scene, camera, resizeObserver, ktx2, gltfLoader;
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
  function box(parent, w, h, d, mat, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function addTree(x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.userData.coIType = type; group.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, .65, 5), mats.wood);
    trunk.position.y = .32; trunk.castShadow = true; group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.62, 1.45, 6), mats.leaf);
    crown.position.y = 1.22; crown.castShadow = true; group.add(crown);
    const crown2 = new THREE.Mesh(new THREE.ConeGeometry(.43, 1.05, 6), mats.leafLight);
    crown2.position.y = 1.72; crown2.castShadow = true; group.add(crown2); scene.add(group);
  }
  function createBuilding(type, level, x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const colors = palettes[type] || palettes.warehouse;
    const wall = material(colors[0]), roof = material(colors[1]);
    const height = 1.0 + Math.min(30, Math.max(1, Number(level) || 1)) * .035;
    const base = box(group, 1.42, height, 1.18, wall, 0, height / 2, 0);
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
    scene.add(group); return group;
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
    // Rock clusters and forest border, deterministic and inexpensive.
    for (let i = 0; i < 18; i++) {
      const x = ((i * 37) % 125) / 10 - 6.2, z = ((i * 23) % 95) / 10 - 4.7;
      if (Math.abs(x) < 2.2 && Math.abs(z) < 1.8) continue;
      addTree(x, z, .72 + (i % 4) * .12);
    }
  }
  function renderBuildings(buildings) {
    for (const item of activeModels) scene.remove(item);
    activeModels.forEach(item => item.traverse?.(node => {
      if (node.isMesh && node.geometry && node.geometry.userData?.coiOwned) node.geometry.dispose();
    }));
    activeModels = [];
    const list = (Array.isArray(buildings) ? buildings : []).slice(0, 9);
    list.forEach((b, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = (col - 1) * 3.7, z = (row - 1) * 2.85;
      const template = glbTemplates.get(b.building_type);
      const group = template ? template.clone(true) : createBuilding(b.building_type, b.level, x, z);
      group.position.set(x, 0, z); group.userData.coIType = b.building_type;
      group.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
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
        for (const asset of (manifest.models || [])) {
          if (asset.enabled !== true || !asset.type || !asset.src) continue;
          const gltf = await gltfLoader.loadAsync(asset.src);
          const template = gltf.scene;
          template.traverse(node => {
            if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
          });
          glbTemplates.set(asset.type, template);
        }
        if (glbTemplates.size) renderBuildings(buildings);
      } catch (error) {
        console.info("Clash of Izzy: GLB asset not ready; procedural 3D models remain active.", error);
      }
    })();
    return manifestLoad;
  }
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true, antialias: false, powerPreference: "low-power",
      depth: true, stencil: false, preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = host.clientWidth > 680;
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
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; scene.add(sun);
    buildGround();
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/basis/");
    ktx2.detectSupport(renderer);
    gltfLoader = new GLTFLoader(); gltfLoader.setKTX2Loader(ktx2);
    host.classList.add("has-3d");
    window.addEventListener("coi:kingdom-render", event => { const list = event.detail?.buildings || []; renderBuildings(list); loadOptionalGlbAssets(list); });
    const resize = () => {
      if (!renderer || !host.clientWidth || !host.clientHeight) return;
      const aspect = host.clientWidth / host.clientHeight;
      const viewHeight = 12.8, viewWidth = viewHeight * aspect;
      camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
      camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.render(scene, camera);
    };
    if ("ResizeObserver" in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); }
    else window.addEventListener("resize", resize, { passive: true });
    resize();
  } catch (error) {
    console.warn("Clash of Izzy: WebGL indisponível; mantendo arte procedural 2D.", error);
    host.classList.remove("has-3d");
    renderer?.dispose();
    renderer?.domElement.remove();
  }
}
